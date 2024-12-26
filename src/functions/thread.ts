import {app, HttpRequest} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {streamingAiFunction, StreamingFunctionResponse} from "../common/ai-function"
import {assistantStreamToSSE} from "../common/sse"

const role = "user"
const assistantId = "asst_4QNzCgFQvvfevSBN851G3waR"

async function generateThreadResponse(aiClient: AIClient, threadId: string, message: string): Promise<StreamingFunctionResponse> {
    await aiClient.beta.threads.messages.create(threadId, {role, content: message})
    const stream = await aiClient.beta.threads.runs.create(threadId, {assistant_id: assistantId, stream: true})
    return {
        stream: assistantStreamToSSE(stream),
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