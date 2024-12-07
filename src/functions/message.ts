import {app, HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import { AzureOpenAI, OpenAI } from "openai"

const aiClient = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.MESSAGE_AZURE_OPENAI_API_VERSION,
    deployment: process.env.MESSAGE_AZURE_OPENAI_DEPLOYMENT,
})

const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*", //todo: remove
}

export async function message(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('HTTP trigger function processed a request.')

    const message = await request.text()

    if (!message) {
        return {
            status: 400,
            body: "Bitte übermittle eine gültige Anfrage mit Nachrichten.",
        }
    }

    try {
        const stream = await aiClient.chat.completions.create({
            model: "",
            messages: [{role: "user", content: message}],
            stream: true,
        })

        const body = openAIStreamToSSE(stream)

        return {
            headers,
            body,
        }
    } catch (error) {
        context.error("Fehler beim Abrufen der Antwort von OpenAI:", error)
        return {
            status: 500,
            body: "Interner Serverfehler.",
        }
    }
}

async function* openAIStreamToSSE(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
): AsyncIterable<Uint8Array> {
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

app.setup({enableHttpStream: true})
app.http('message', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: message,
})