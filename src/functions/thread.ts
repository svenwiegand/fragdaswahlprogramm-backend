import {app, HttpRequest} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {SSEStream, streamingAiFunction, StreamingFunctionResponse} from "../common/ai-function"
import {AssistantStreamEvent} from "openai/resources/beta"

const role = "user"
const assistantId = "asst_4QNzCgFQvvfevSBN851G3waR"

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
        if (event.event === "thread.message.delta") {
            yield encoder.encode("event: message\n")
            for (const delta of event.data.delta.content) {
                if (delta.type === "text") {
                    const lines = delta.text.value.split("\n")
                    for (const line of lines) {
                        yield encoder.encode(`data: ${line}\n`)
                    }
                }
            }
            yield encoder.encode("\n")
        } else if (event.event === "thread.run.requires_action") {
            for await (const toolCall of event.data.required_action.submit_tool_outputs.tool_calls) {
                console.log(`Tool call: ${toolCall.function.name}`)
                if (toolCall.function.name === "get_instructions") {
                    console.log(toolCall.function.arguments)
                    const query = JSON.parse(toolCall.function.arguments) as Query
                    const instructions = getInstructions(query)
                    console.log(instructions)
                    const stream = aiClient.beta.threads.runs.submitToolOutputsStream(
                        event.data.thread_id,
                        event.data.id,
                        {
                            tool_outputs: [{
                                tool_call_id: toolCall.id,
                                output: instructions,
                            }]
                        },
                    )
                    yield* assistantStreamToSSE(aiClient, stream)
                }
            }
        } else {
            console.log(`Event: ${event.event}`)
        }
    }
}

type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "spd"
const supportedParties: Party[] = ["afd", "cdu-csu", "fdp", "gruene", "spd"]
const maxNumberParties = 3

type Query = {
    queriedParties: Party[]
    queryType: "program" | "assessment" | "quote" | "inquiry" | "inappropriate"
    followUpQuestions: string[]
}

function getInstructions(query: Query): string {
    switch (query.queryType) {
        case "program":
            return detailedInstructions(query.queriedParties, `
                Beantworte die Frage des Nutzer ausschließlich auf Basis der Dir vorliegenden Wahlprogramme der Parteien.
                Gib die relevanten Kernpunkte als kompakte Aufzählung aus.
            `)
        case "assessment":
            return detailedInstructions(query.queriedParties, `
                Nimm die angefragte Bewertung vor.
                Gib die Kernpunkte der Bewertung als kompakte Aufzählung aus.
            `)
        case "quote":
            return detailedInstructions(query.queriedParties, `
                Zitiere die relevanten Ausschnitte ausschließlich auf Basis der Dir vorliegenden Wahlprogramme der Parteien. 
            `)
        case "inquiry":
            return detailedInstructions(query.queriedParties, `
                Beantworte die Rückfrage des Nutzers.
            `)
        case "inappropriate":
            return "Weise den Nutzer darauf hin, dass die Frage unangemessen ist. Du beantwortest ihm gerne Fragen zu den Wahlprogrammen der Parteien zur Bundestagswahl 2025."
    }
}

function detailedInstructions(parties: Party[], instruction: string): string {
    // No parties specified at all or too many parties specified
    if (parties.length === 0 || parties.length > maxNumberParties) {
        return `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`
    }

    // All specified parties do not have a program
    const supportedQueriedParties = parties.filter(party => supportedParties.includes(party))
    if (supportedQueriedParties.length === 0) {
        return `
            Weise den Nutzer darauf hin, dass Dir für keine der von ihm angefragten Parteien Wahlprogramme vorliegen.
        `
    }

    // Some specified parties do not have a program
    if (supportedQueriedParties.length !== parties.length) {
        const unsupportedParties = parties.filter(party => !supportedParties.includes(party))
        return `
            ${instruction}
            Beantworte die Frage für die folgenden Parteien: ${supportedQueriedParties.join(", ")}
            Weise den Nutzer darauf hin, dass Dir für die folgenden Parteien keine Wahlprogramme vorliegen: ${unsupportedParties.join(", ")}                
        `
    }

    // All requested parties are supported
    return `
        ${instruction}
        Beantworte die Frage für die folgenden Parteien: ${supportedQueriedParties.join(", ")}
    `
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