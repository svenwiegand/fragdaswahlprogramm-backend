import {HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import {aiClient, AIClient} from "./ai-client"
import {SSEStream} from "./sse"

export const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*", //todo: remove
}

type AzureFunction = (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
type StreamingFunction<StreamType> = (aiClient: AIClient, message: string) => Promise<StreamType>
type SSEGenerator<StreamType> = (stream: StreamType) => SSEStream

export function streamingAiFunction<StreamType>(f: StreamingFunction<StreamType>, sseGenerator: SSEGenerator<StreamType>): AzureFunction {
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
            const body = sseGenerator(stream)
            return {headers, body}
        } catch (error) {
            context.error("Fehler beim Abrufen der Antwort von OpenAI:", error)
            return {
                status: 500,
                body: "Interner Serverfehler.",
            }
        }
    }
}