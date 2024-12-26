import {OpenAI} from "openai"
import {AssistantStreamEvent} from "openai/resources/beta"
import {Stream} from "openai/streaming"

export type  SSEStream = AsyncIterable<Uint8Array>

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

export type AssistantStream = Stream<AssistantStreamEvent>
export async function* assistantStreamToSSE(stream: AssistantStream): SSEStream {
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
        }
    }
}