import {HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import {OpenAI} from "openai"
import {aiClient, AIClient} from "./ai-client"

const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*", //todo: remove
}

export type ChatCompletionStream = AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
type SSEStream = AsyncIterable<Uint8Array>

async function streamResponse(stream: ChatCompletionStream): Promise<HttpResponseInit> {
    const body = openAIStreamToSSE(stream)
    return {headers, body}
}

async function* openAIStreamToSSE(stream: ChatCompletionStream): SSEStream {
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

type AzureFunction = (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
type StreamingFunction = (aiClient: AIClient, message: string) => Promise<ChatCompletionStream>

export function streamingAiFunction(f: StreamingFunction): AzureFunction {
    return async (request: HttpRequest, context: InvocationContext) => {
        const message = await request.text()
        if (!message) {
            return {
                status: 400,
                body: "Bitte übermittle eine gültige Anfrage mit Nachrichten.",
            }
        }

        try {
            const stream = await f(aiClient, message)
            return streamResponse(stream)
        } catch (error) {
            context.error("Fehler beim Abrufen der Antwort von OpenAI:", error)
            return {
                status: 500,
                body: "Interner Serverfehler.",
            }
        }
    }
}