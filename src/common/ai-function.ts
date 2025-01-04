import {HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import {aiClient, AIClient} from "./ai-client"
import {corsHeaders} from "./cors"

const standardHeaders = {
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    ...corsHeaders, // required locally and ignored in production
}

export type  SSEStream = AsyncIterable<Uint8Array>
type AzureFunction = (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>
export type StreamingFunctionResponse = {
    stream: SSEStream
    additionalHeaders: Record<string, string>
}
type StreamingFunction = (aiClient: AIClient, message: string, request: HttpRequest) => Promise<SSEStream | StreamingFunctionResponse>

function isStreamingFunctionResponse(value: SSEStream | StreamingFunctionResponse): value is StreamingFunctionResponse {
    return (
        typeof value === "object" &&
        value !== null &&
        "stream" in value &&
        "additionalHeaders" in value &&
        typeof value.additionalHeaders === "object"
    )
}

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
            const response = await f(aiClient, message, request)
            const isResponseObject = isStreamingFunctionResponse(response)
            const body = isResponseObject ? response.stream : response
            const headers = isResponseObject ? {...standardHeaders, ...response.additionalHeaders} : standardHeaders
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