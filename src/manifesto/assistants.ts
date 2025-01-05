import {HttpRequest} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {SSEStream, StreamingFunctionResponse} from "../common/ai-function"
import {AssistantStreamEvent} from "openai/resources/beta"
import {TextEncoder} from "node:util"
import {RequiredActionFunctionToolCall} from "openai/resources/beta/threads"
import {AssistantStream} from "openai/lib/AssistantStream"
import {maxNumberParties, party, Party, parties} from "./parties"
import {metaAssistantId} from "./assistant-setup"
import {EventBuilder, getMixpanelEvent, MixpanelEvent} from "../common/mixpanel"

type Query = {
    queriedParties: Party[]
    queryType: "program" | "partySearch" | "assessment" | "quote" | "inquiry" | "inappropriate"
    subPrompt: string
    category: string,
    followUpQuestions: string[]
}

type ThreadEvent = MixpanelEvent & Query & {
    threadId: string
    command?: Command
    inputTokensStandard: number
    outputTokensStandard: number
    inputTokensMini: number
    outputTokensMini: number
    result?: "success" | "failure"
    duration?: number
    errorCode?: string
    errorMessage?: string
}

type ThreadEventBuilder = EventBuilder<ThreadEvent>

const initThreadEvent = (request: HttpRequest): ThreadEventBuilder => new EventBuilder("Question Processed", {
    ...getMixpanelEvent(request),
    threadId: request.params.threadId,
    queriedParties: [],
    queryType: "program",
    subPrompt: "",
    category: "",
    followUpQuestions: [],
    inputTokensStandard: 0,
    outputTokensStandard: 0,
    inputTokensMini: 0,
    outputTokensMini: 0,
})

const role = "user"

async function generateThreadResponse(
    aiClient: AIClient,
    threadId: string,
    message: string,
    trackingEvent: ThreadEventBuilder
): Promise<StreamingFunctionResponse> {
    await aiClient.beta.threads.messages.create(threadId, {role, content: message})
    const stream = await aiClient.beta.threads.runs.create(threadId, {
        assistant_id: metaAssistantId,
        tool_choice: "required",//{type: "function", function: {name: "get_instructions"}},
        stream: true,
    })
    return {
        stream: assistantStreamToSSE(aiClient, stream, trackingEvent),
        additionalHeaders: {
            "Thread-ID": threadId,
        }
    }
}

export async function createThread(aiClient: AIClient, message: string, request: HttpRequest): Promise<StreamingFunctionResponse> {
    const thread = await aiClient.beta.threads.create({})
    console.log(`creating new thread ${thread.id}`)
    return generateThreadResponse(aiClient, thread.id, message, initThreadEvent(request))
}

export async function postToThread(aiClient: AIClient, message: string, request: HttpRequest): Promise<StreamingFunctionResponse> {
    const threadId = request.params.threadId
    console.log(`posting message to existing thread ${threadId}`)
    return generateThreadResponse(aiClient, threadId, message, initThreadEvent(request))
}

function finalizeAndSendThreadEvent(trackingEvent: ThreadEventBuilder, event: AssistantStreamEvent.ThreadRunCompleted | AssistantStreamEvent.ThreadRunFailed) {
    const safeDuration = (start: number | null, end: number | null): number | undefined => start && end ? end-start : undefined
    trackingEvent.update(() => ({
        result: event.event === "thread.run.completed" ? "success" : "failure",
        duration: safeDuration(event.data.created_at, event.data.completed_at ?? event.data.failed_at ?? event.data.cancelled_at),
        errorCode: event.data.last_error?.code,
        errorMessage: event.data.last_error?.message,
        inputTokensStandard: event.data.usage.prompt_tokens,
        outputTokensStandard: event.data.usage.completion_tokens,
    }))
    trackingEvent.send()
}

async function* assistantStreamToSSE(
    aiClient: AIClient,
    stream: AsyncIterable<AssistantStreamEvent>,
    trackingEvent: ThreadEventBuilder
): SSEStream {
    console.log("Converting assistant stream to SSE")
    const encoder = new TextEncoder()

    for await (const event of stream) {
        if (event.event === "thread.run.requires_action") {
            yield* processFunctionCalls(aiClient, encoder, event, trackingEvent)
        } else if (event.event === "thread.message.delta") {
            yield* sendMessageDelta(encoder, event)
        } else if (event.event === "thread.run.completed") {
            console.log(`GPT meta-run completed for. input-tokens: ${event.data.usage.prompt_tokens},  input-tokens: ${event.data.usage.completion_tokens}`)
            finalizeAndSendThreadEvent(trackingEvent, event)
        } else if (event.event === "thread.run.failed") {
            console.error(`GPT meta-run failed: ${event.data.last_error.code} (${event.data.last_error.message})`)
            finalizeAndSendThreadEvent(trackingEvent, event)
        } else {
            console.log(`Event: ${event.event}`)
        }
    }
}

type Command = "partySelector" | "followUpQuestions"
type Instruction = {
    instruction: string
    command?: Command
    inputTokens: number
    outputTokens: number
}
const instruction = (command: Command | undefined, instruction: string): Instruction => ({
    instruction,
    command,
    inputTokens: 0,
    outputTokens: 0,
})

async function* processFunctionCalls(
    aiClient: AIClient,
    encoder: TextEncoder,
    event: AssistantStreamEvent.ThreadRunRequiresAction,
    trackingEvent: ThreadEventBuilder
): SSEStream {
    console.log(`Event: ${event.event} (${event.data.required_action.submit_tool_outputs.tool_calls.length} tool calls)`)
    for await (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
        console.log(`Tool call: ${toolCall.function.name}`)
        if (toolCall.function.name === "get_instructions") {
            console.log(toolCall.function.arguments)
            const query = JSON.parse(toolCall.function.arguments) as Query
            const instruction = await getInstructions(aiClient, query)
            console.log(instruction.instruction)
            console.log(instruction.command)
            trackingEvent.patch(query)
            trackingEvent.patch({
                command: instruction.command,
                inputTokensMini: instruction.inputTokens,
                outputTokensMini: instruction.outputTokens,
            })

            if (instruction.command === "partySelector") {
                yield* requestPartySelector(encoder)
            } else if (instruction.command === "followUpQuestions") {
                yield* sendFollowUpQuestions(encoder, query.followUpQuestions)
            }
            const stream = submitFunctionOutput(aiClient, event, toolCall, instruction.instruction)
            yield* assistantStreamToSSE(aiClient, stream, trackingEvent)
        }
    }
}

function submitFunctionOutput(
    aiClient: AIClient,
    event: AssistantStreamEvent.ThreadRunRequiresAction,
    toolCall:  RequiredActionFunctionToolCall,
    output: string
): AssistantStream {
    return aiClient.beta.threads.runs.submitToolOutputsStream(
        event.data.thread_id,
        event.data.id,
        {
            tool_outputs: [{
                tool_call_id: toolCall.id,
                output: output,
            }]
        },
    )
}

async function* sendMessageDelta(encoder: TextEncoder, event: AssistantStreamEvent.ThreadMessageDelta): SSEStream {
    for (const delta of event.data.delta.content) {
        if (delta.type === "text") {
            yield* sendEvent(encoder, "message", delta.text.value)
        }
    }
}

async function* sendFollowUpQuestions(encoder: TextEncoder, questions: string[]): SSEStream {
    for (const question of questions) {
        yield* sendEvent(encoder, "followUpQuestion", question)
    }
}

async function* requestPartySelector(encoder: TextEncoder): SSEStream {
    yield* sendEvent(encoder, "command", "selectParties")
}

async function* sendEvent(encoder: TextEncoder, event: string, data: string): SSEStream {
    yield encoder.encode(`event: ${event}\n`)
    const lines = data.split("\n")
    for (const line of lines) {
        yield encoder.encode(`data: ${line}\n`)
    }
    yield encoder.encode("\n")
}

async function getInstructions(aiClient: AIClient, query: Query): Promise<Instruction> {
    switch (query.queryType) {
        case "program":
            return detailedInstructions(aiClient, query.subPrompt, query.queriedParties, true, `
                Beantworte die Frage des Nutzer ausschließlich auf Basis der unten bereitgestellten Auszüge aus den Wahlprogrammen.
            `)
        case "partySearch":
            return detailedInstructions(aiClient, query.subPrompt, parties, true, `
                Nenne dem Nutzer die Parteien, die laut den unten bereitgestellten Auszügen der Wahlprogrammen die gefragten Positionen vertreten.
                Führe die zur Position gehörenden Kernpunkte als kompakte Aufzählung auf.
            `)
        case "assessment":
            return detailedInstructions(aiClient, query.subPrompt, query.queriedParties, true, `
                Nimm die angefragte Bewertung vor.
            `)
        case "quote":
            return detailedInstructions(aiClient, query.subPrompt, query.queriedParties, false, `
                Zitiere die relevanten Ausschnitte ausschließlich auf Basis der unten bereitgestellten Auszüge der Wahlprogramme. 
            `)
        case "inquiry":
            return detailedInstructions(aiClient, query.subPrompt, query.queriedParties, true, `
                Beantworte die Rückfrage des Nutzers.
            `)
        case "inappropriate":
            return instruction(undefined, "Weise den Nutzer darauf hin, dass die Frage unangemessen ist. Du beantwortest ihm gerne Fragen zu den Wahlprogrammen der Parteien zur Bundestagswahl 2025.")
    }
}

async function detailedInstructions(
    aiClient: AIClient,
    prompt: string,
    parties: Party[],
    followUpQuestions: boolean,
    instruct: string)
    : Promise<Instruction> {
    // No parties specified at all or too many parties specified
    if (parties.length === 0 || parties.length > maxNumberParties) {
        return instruction("partySelector", `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`)
    }

    // All requested parties are supported
    const manifestoContent = await getRequestedManifestoContent(aiClient, parties, prompt)
    return {
        command: followUpQuestions ? "followUpQuestions" : undefined,
        instruction: `${instruct}\n\n${manifestoContent.content}`,
        inputTokens: manifestoContent.inputTokens,
        outputTokens: manifestoContent.outputTokens
    }
}

type ManifestoContentResult = {
    content: string
    inputTokens: number
    outputTokens: number
}

async function getRequestedManifestoContent(aiClient: AIClient, parties: Party[], prompt: string): Promise<ManifestoContentResult> {
    const result = await Promise.all(parties.map(party => getManifestoContent(aiClient, party, prompt)))
    return {
        content: result.map(r => r.content).join("\n\n"),
        inputTokens: result.reduce((acc, r) => acc + r.inputTokens, 0),
        outputTokens: result.reduce((acc, r) => acc + r.outputTokens, 0),
    }
}

async function getManifestoContent(aiClient: AIClient, party: Party, prompt: string): Promise<ManifestoContentResult> {
    const thread = await aiClient.beta.threads.create({})
    await aiClient.beta.threads.messages.create(thread.id, {role, content: prompt})
    const stream = await aiClient.beta.threads.runs.create(thread.id, {
        assistant_id: party[party].assistantId,
        tool_choice: "required",
        stream: true,
    })

    let content = `# ${party[party].name}\n`
    let inputTokens = 0
    let outputTokens = 0
    for await (const event of stream) {
        if (event.event === "thread.message.completed") {
            const msg = event.data.content[0]
            if (msg.type === "text") {
                content += msg.text.value
            }
        } else if (event.event === "thread.run.completed") {
            inputTokens = event.data.usage.prompt_tokens
            outputTokens = event.data.usage.completion_tokens
            console.log(`GPT mini run completed for ${party}. input-tokens: ${inputTokens},  input-tokens: ${outputTokens}`)
        }
    }
    return {content, inputTokens, outputTokens}
}