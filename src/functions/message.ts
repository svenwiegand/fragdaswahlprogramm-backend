import {app} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {streamingAiFunction} from "../common/ai-function"
import {chatCompletionStreamToSSE, SSEStream} from "../common/sse"

async function generateResponse(aiClient: AIClient, message: string): Promise<SSEStream> {
    const stream = await aiClient.chat.completions.create({
        model: "",
        messages: [{role: "user", content: message}],
        stream: true,
    })
    return chatCompletionStreamToSSE(stream)
}

const message = streamingAiFunction(generateResponse)

app.setup({enableHttpStream: true})
app.http('message', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: message,
})