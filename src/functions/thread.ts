import {app} from "@azure/functions"
import {AIClient} from "./common/ai-client"
import {streamingAiFunction} from "./common/ai-function"
import {AssistantStream, assistantStreamToSSE} from "./common/sse"
import {Thread} from "openai/resources/beta"

const role = "user"
const assistantId = "asst_4QNzCgFQvvfevSBN851G3waR"

async function generateThreadResponse(aiClient: AIClient, thread: Thread, message: string): Promise<AssistantStream> {
    await aiClient.beta.threads.messages.create(thread.id, {role, content: message})
    return aiClient.beta.threads.runs.create(thread.id, {assistant_id: assistantId, stream: true})
}

async function createThread(aiClient: AIClient, message: string): Promise<AssistantStream> {
    const thread = await aiClient.beta.threads.create({})
    return generateThreadResponse(aiClient, thread, message)
}

const postThread = streamingAiFunction(createThread, assistantStreamToSSE)

app.setup({enableHttpStream: true})
app.http('thread', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: postThread,
})