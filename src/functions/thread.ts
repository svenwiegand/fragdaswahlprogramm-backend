import {app, HttpRequest} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {SSEStream, streamingAiFunction, StreamingFunctionResponse} from "../common/ai-function"
import {AssistantStreamEvent} from "openai/resources/beta"
import {TextEncoder} from "node:util"
import {RequiredActionFunctionToolCall} from "openai/resources/beta/threads"
import {AssistantStream} from "openai/lib/AssistantStream"

const role = "user"
const assistantId = "asst_4QNzCgFQvvfevSBN851G3waR"

type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "spd"
const maxNumberParties = 4

/*
Du beantwortest Fragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025. Deine Aufgabe ist es, Nutzeranfragen freundlich und kompetent zu beantworten. Nutze informelle Sprache.

Folge diesen Anweisungen, um die Frage zu beantworten:
- Verstehe den Typ der Anfrage und die Parteien, nach denen der Nutzer fragt, und hole Dir die relevanten Instruktionen durch den Aufruf der Tool-Function "get_instructions".
- Folge den Instruktionen aus "get_instructions"
- Falls nach Inhalten zu den Wahlprogrammen gefragt wird, so beantworte sie ausschließlich auf Basis der Dateisuche, sofern in den Instruktionen nicht anders vorgegeben wird

Trenne die Aussagen der einzelnen Parteien jeweils durch eine Überschrift der ersten Ebene, die den offiziellen Namen der Partei enthält, sodass klar ersichtlich ist, welche Haltung von welcher Partei stammt. Du kannst die Überschrift mit dem Parteinamen weglassen, wenn die Frage sich nur auf eine Partei bezieht.
 */

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
        } else {
            console.log(`Event: ${event.event}`)
        }
    }
}

type Query = {
    queriedParties: Party[]
    queryType: "program" | "partySearch" | "assessment" | "quote" | "inquiry" | "inappropriate"
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
            const instruction = getInstructions(query)
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

function getInstructions(query: Query): Instruction {
    switch (query.queryType) {
        case "program":
            return detailedInstructions(query.queriedParties, true, `
                Beantworte die Frage des Nutzer ausschließlich auf Basis der Dir vorliegenden Wahlprogramme der Parteien.
                Gib die relevanten Kernpunkte als kompakte Aufzählung aus.
            `)
        case "partySearch":
            return instruction("followUpQuestions", `
                Nenne dem Nutzer die Parteien, die laut den Dir vorliegenden Wahlprogrammen die gefragten Positionen vertreten.
                Führe die zur Position gehörenden Kernpunkte als kompakte Aufzählung auf.
            `)
        case "assessment":
            return detailedInstructions(query.queriedParties, true, `
                Nimm die angefragte Bewertung vor.
                Gib die Kernpunkte der Bewertung als kompakte Aufzählung aus.
            `)
        case "quote":
            return detailedInstructions(query.queriedParties, false, `
                Zitiere die relevanten Ausschnitte ausschließlich auf Basis der Dir vorliegenden Wahlprogramme der Parteien. 
            `)
        case "inquiry":
            return detailedInstructions(query.queriedParties, true, `
                Beantworte die Rückfrage des Nutzers.
            `)
        case "inappropriate":
            return instruction(undefined, "Weise den Nutzer darauf hin, dass die Frage unangemessen ist. Du beantwortest ihm gerne Fragen zu den Wahlprogrammen der Parteien zur Bundestagswahl 2025.")
    }
}

function detailedInstructions(parties: Party[], followUpQuestions: boolean, instruct: string): Instruction {
    // No parties specified at all or too many parties specified
    if (parties.length === 0 || parties.length > maxNumberParties) {
        return instruction("partySelector", `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`)
    }

    // All requested parties are supported
    return instruction(followUpQuestions ? "followUpQuestions" : undefined, instruct)
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