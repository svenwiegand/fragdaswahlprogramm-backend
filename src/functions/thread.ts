import {app, HttpRequest} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {SSEStream, streamingAiFunction, StreamingFunctionResponse} from "../common/ai-function"
import {AssistantStreamEvent} from "openai/resources/beta"
import {TextEncoder} from "node:util"
import {RequiredActionFunctionToolCall} from "openai/resources/beta/threads"
import {AssistantStream} from "openai/lib/AssistantStream"

const role = "user"
const assistantId = "asst_iDqo1jpKOaCxsWkqBDe45sO7"

const maxNumberParties = 4
type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "spd"
type PartyProps = {
    name: string
    symbol: string
    assistantId: string
}

const parties: Record<Party, PartyProps> = {
    afd: {name: "AfD", symbol: "afd", assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ"},
    "cdu-csu": {name: "CDU/CSU", symbol: "cdu-csu", assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao"},
    fdp: {name: "FDP", symbol: "fdp", assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH"},
    gruene: {name: "Bündnis 90/Die Grünen", symbol: "gruene", assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2"},
    spd: {name: "SPD", symbol: "spd", assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ"},
}
const supportedParties = Object.keys(parties) as Party[]

async function generateThreadResponse(aiClient: AIClient, threadId: string, message: string): Promise<StreamingFunctionResponse> {
    await aiClient.beta.threads.messages.create(threadId, {role, content: message})
    const stream = await aiClient.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
        tool_choice: "required",//{type: "function", function: {name: "get_instructions"}},
        stream: true,
    })
    return {
        stream: assistantStreamToSSE(aiClient, stream),
        additionalHeaders: {
            "Thread-ID": threadId,
            "Access-Control-Expose-Headers": "Thread-ID",
        }
    }
}

async function createThread(aiClient: AIClient, message: string): Promise<StreamingFunctionResponse> {
    const thread = await aiClient.beta.threads.create({})
    console.log(`creating new thread ${thread.id}`)
    return generateThreadResponse(aiClient, thread.id, message)
}

async function postToThread(aiClient: AIClient, message: string, request: HttpRequest): Promise<StreamingFunctionResponse> {
    const threadId = request.params.threadId
    console.log(`posting message to existing thread ${threadId}`)
    return generateThreadResponse(aiClient, threadId, message)
}

async function* assistantStreamToSSE(aiClient: AIClient, stream: AsyncIterable<AssistantStreamEvent>): SSEStream {
    console.log("Converting assistant stream to SSE")
    const encoder = new TextEncoder()

    for await (const event of stream) {
        if (event.event === "thread.run.requires_action") {
            yield* processFunctionCalls(aiClient, encoder, event)
        } else if (event.event === "thread.message.delta") {
            yield* sendMessageDelta(encoder, event)
        } else if (event.event === "thread.run.completed") {
            console.log(`GPT 4o meta-run completed for. input-tokens: ${event.data.usage.prompt_tokens},  input-tokens: ${event.data.usage.completion_tokens}`)
        } else {
            console.log(`Event: ${event.event}`)
        }
    }
}

type Query = {
    queriedParties: Party[]
    queryType: "program" | "partySearch" | "assessment" | "quote" | "inquiry" | "inappropriate"
    subPrompt: string
    followUpQuestions: string[]
}

type Command = "partySelector" | "followUpQuestions"
type Instruction = {
    instruction: string
    command?: Command
}
const instruction = (command: Command | undefined, instruction: string): Instruction => ({
    instruction, command
})

async function* processFunctionCalls(aiClient: AIClient, encoder: TextEncoder, event: AssistantStreamEvent.ThreadRunRequiresAction): SSEStream {
    console.log(`Event: ${event.event} (${event.data.required_action.submit_tool_outputs.tool_calls.length} tool calls)`)
    for await (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
        console.log(`Tool call: ${toolCall.function.name}`)
        if (toolCall.function.name === "get_instructions") {
            console.log(toolCall.function.arguments)
            const query = JSON.parse(toolCall.function.arguments) as Query
            const instruction = await getInstructions(aiClient, query)
            console.log(instruction.instruction)
            console.log(instruction.command)
            if (instruction.command === "partySelector") {
                yield* requestPartySelector(encoder)
            } else if (instruction.command === "followUpQuestions") {
                yield* sendFollowUpQuestions(encoder, query.followUpQuestions)
            }
            const stream = submitFunctionOutput(aiClient, event, toolCall, instruction.instruction)
            yield* assistantStreamToSSE(aiClient, stream)
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
            return detailedInstructions(aiClient, query.subPrompt, supportedParties, true, `
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
    return instruction(followUpQuestions ? "followUpQuestions" : undefined, `${instruct}\n\n${manifestoContent}`)
}

async function getRequestedManifestoContent(aiClient: AIClient, parties: Party[], prompt: string): Promise<string> {
    const content = await Promise.all(parties.map(party => getManifestoContent(aiClient, party, prompt)))
    return content.join("\n\n")
}

async function getManifestoContent(aiClient: AIClient, party: Party, prompt: string): Promise<string> {
    const thread = await aiClient.beta.threads.create({})
    await aiClient.beta.threads.messages.create(thread.id, {role, content: prompt})
    const stream = await aiClient.beta.threads.runs.create(thread.id, {
        assistant_id: parties[party].assistantId,
        tool_choice: "required",
        stream: true,
    })

    let content = `# ${parties[party].name}\n`
    for await (const event of stream) {
        if (event.event === "thread.message.completed") {
            const msg = event.data.content[0]
            if (msg.type === "text") {
                content += msg.text.value
            }
        } else if (event.event === "thread.run.completed") {
            console.log(`GPT 4o-mini run completed for ${party}. input-tokens: ${event.data.usage.prompt_tokens},  input-tokens: ${event.data.usage.completion_tokens}`)
        }
    }
    return content
}

const createThreadFunction = streamingAiFunction(createThread)
const postToThreadFunction = streamingAiFunction(postToThread)

app.setup({enableHttpStream: true})
app.http("createThread", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "thread",
    handler: createThreadFunction,
})
app.http("postToThread", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: postToThreadFunction,
})