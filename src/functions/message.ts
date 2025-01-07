import {app} from "@azure/functions"
import {AIClient} from "../common/ai-client"
import {SSEStream, streamingAiFunction} from "../common/ai-function"
import {OpenAI} from "openai"
import {devMode} from "../common/mode"

async function generateResponse(aiClient: AIClient, message: string): Promise<SSEStream> {
    const stream = await aiClient.chat.completions.create({
        model: "",
        messages: [{role: "user", content: message}],
        stream: true,
    })
    return chatCompletionStreamToSSE(stream)
}

export type ChatCompletionStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
export async function* chatCompletionStreamToSSE(stream: ChatCompletionStream): SSEStream {
    const encoder = new TextEncoder()

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
            const lines = content.split("\n")
            for (const line of lines) {
                yield encoder.encode(`data: ${line}\n`)
            }
            yield encoder.encode("\n")
        }
    }
}

const message = streamingAiFunction(generateResponse)

if (devMode) {
    app.setup({enableHttpStream: true})
    app.http('message', {
        methods: ['POST'],
        authLevel: 'anonymous',
        handler: message,
    })
}