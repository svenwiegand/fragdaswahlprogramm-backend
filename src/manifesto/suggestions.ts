import {AIClient} from "../common/ai-client"
import OpenAI from "openai"
import {ResponseFormatJSONSchema} from "openai/resources"
import JSONSchema = ResponseFormatJSONSchema.JSONSchema
import {Stream} from "openai/streaming"

const prompt = `
Du bist Teil eines Assistenten, der dem Nutzer hilft, mehr über die Wahlprogramme der Parteien zur Bundestagswahl 2025 zu erfahren.
Erstelle für die bereitgestellte, vom System generierte Antwort Folgefragen, die dem Nutzer helfen, das Thema zu vertiefen.

Halte Dich dabei an folgende Regeln:

1. Prüfe, ob für die Antwort weitere Nachfragen überhaupt sinnvoll sind oder ob es sich etwa nur um Smalltalk handelt. Generiere in diesem Fall einen leeren Array.
2. Wenn Nachfragen sinnvoll sind, generiere 2 bis 4 Nachfragen, die folgende Bedingungen erfüllen:
    - Die Fragen müssen unmittelbaren Bezug auf die Themen der Antwort nehmen oder verwandte Themen adressieren
    - Die Fragen müssen sinnvolle Fragen sein, die üblicherweise durch Wahlprogramme beantwortet werden
    - Die Fragen sind entweder parteiunabhängig oder beziehen sich ausschließlich auf die in der Antwort genannten Parteien ("Wie unterscheidet sich die Position von SPD und Linke?", falls diese beiden Parteien in der Antwort erwähnt werden)
    - Eine Frage erfragt niemals einen Vergleich zu nicht in der Antwort erwähnten Parteien oder allgemein "anderen Parteien" (niemals: "Wie unterscheidet sich die Position zu der anderer Parteien?")
    - Eine Frage richtet sich nie an die Pläne der "Regierung", da es hier um Wahlprogramme für eine Wahl geht.
    - Jede Frage ist nicht länger als 12 Wörter

Generiere das Ergebnis als JSON.
`
const responseFormat: JSONSchema = {
    name: "suggestions",
    strict: true,
    schema: {
        type: "object",
        properties: {
            suggestions: {
                type: "array",
                items: {
                    type: "string",
                },
            },
        },
        required: ["suggestions"],
        additionalProperties: false,
    },
}

export type SuggestionResult = {
    suggestions: string[]
    inputTokensStandard: number
    outputTokensStandard: number
    inputTokensMini: number
    outputTokensMini: number
}

export async function generateSuggestions(aiClient: AIClient, answer: string): Promise<SuggestionResult> {
    const stream = await aiClient.chat.completions.create({
        model: "",
        messages: [
            {role: "system", content: prompt},
            {role: "user", content: answer},
        ],
        response_format: { type: "json_schema", json_schema: responseFormat },
        n: 1,
        stream: true,
        stream_options: {
            include_usage: true,
        }
    })

    try {
        return processStream(stream)
    } catch (e) {
        console.error(`Unexpected error while generating suggestions`, e)
        return {
            suggestions: [],
            inputTokensStandard: 0,
            outputTokensStandard: 0,
            inputTokensMini: 0,
            outputTokensMini: 0,
        }
    }
}

async function processStream(stream:  Stream<OpenAI.Chat.Completions.ChatCompletionChunk>): Promise<SuggestionResult> {
    let output = ""
    let inputTokensStandard = 0
    let outputTokensStandard = 0
    let inputTokensMini = 0
    let outputTokensMini = 0
    for await (const chunk of stream) {
        if (chunk.choices.length == 1) {
            output += chunk.choices[0].delta.content ?? ""
        } else if (chunk.choices.length == 0) {
            if (chunk.model.includes("mini")) {
                inputTokensMini = chunk.usage?.prompt_tokens ?? 0
                outputTokensMini = chunk.usage?.completion_tokens ?? 0
            } else {
                inputTokensStandard = chunk.usage?.prompt_tokens ?? 0
                outputTokensStandard = chunk.usage?.completion_tokens ?? 0}
        } else {
            throw new Error("Unexpected multiple completions")
        }
    }
    return {
        suggestions: JSON.parse(output).suggestions,
        inputTokensStandard, outputTokensStandard,
        inputTokensMini, outputTokensMini,
    }
}