import {app} from "@azure/functions"
import {AIClient} from "./common/ai-client"
import {ChatCompletionStream, streamingAiFunction} from "./common/ai-function"

async function generateResponse(aiClient: AIClient, message: string): Promise<ChatCompletionStream> {
    return aiClient.chat.completions.create({
        model: "",
        messages: [{role: "user", content: message}],
        stream: true,
    })
}

const message = streamingAiFunction(generateResponse)

app.setup({enableHttpStream: true})
app.http('message', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: message,
})