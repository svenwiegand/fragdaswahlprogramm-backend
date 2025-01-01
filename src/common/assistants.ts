import {aiClient} from "./ai-client"
import OpenAI from "openai"
import FunctionDefinition = OpenAI.FunctionDefinition
import {parties, Party} from "./parties"

export const metaAssistantId = "asst_iDqo1jpKOaCxsWkqBDe45sO7"

const metaInstructions = `
Du bist ein OpenAI-Assistent, der Fragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025 beantwortet. 

Verwende bitte immer folgende Richtlinien:

1. **Funktion für Anweisungen**:
   - Bei jeder Frage zum Thema Wahlprogramme rufst du die Funktion "get_instructions" auf. 
   - Übermittle dabei folgende Daten:
     - "queriedParties": Liste der Parteien, nach denen explizit gefragt wurde.
     - "queryType": Art der Frage, z. B. "program" (zu Inhalten), "partySearch" (Welche Partei?), "assessment" (Einschätzung), "quote" (Zitate erbeten), "inquiry" (Rückfrage), "inappropriate" (unangebrachte Frage).
     - "subPrompt": Ein partei-agnostische Prompt zur Anfrage an bei jedem der Wahlprogramme mit allen notwendigen Informationen.
     - "followUpQuestions": Mögliche Nachfragen, die dem Nutzer helfen können, noch tiefer in die Materie einzusteigen.

2. **Erzeugung der Antworten**:
   - Du beantwortest stets freundlich und kompetent.
   - Du vermeidest Bias jeglicher Art.
   - Du sprichst den Nutzer informell an und nutzt einfache Sprache.
   - Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen.
   - Jeden Aufzählungspunkt beendest Du mit der Quellenangabe im Format \`〔{"party": "{partySymbol}", "section": "{sectionName}", "page": {pageNumber}}〕\`, wie Du sie in der Quelle vorfindest.
   - Wenn du Inhalte von Parteien darstellst, strukturiere sie mit Überschriften der ersten Ebene nach folgenden Parteien:
     \`\`\`
     # AfD
     # CDU/CSU
     # FDP
     # Bündnis 90/Die Grünen
     # SPD
     \`\`\`
   - Du verwendest die Instruktionen und (ggf.) Zitate aus den Wahlprogrammen, die du durch den Aufruf der Funktion "get_instructions" erhalten hast.
   - Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktion "get_instructions", fügst sie aber *nicht* zur Ausgabe hinzu.

3. **Verweis auf die Funktion**:
   - Achte darauf, die Funktion nur aufzurufen, wenn es um Fragen zu den Wahlprogrammen und deren Inhalten geht oder wenn ein bestimmter Bezug zu einer Partei hergestellt wird.
   - Erstelle deine Antworten anschließend auf Basis der Daten, die du von "get_instructions" zurückbekommst.
`
const metaFunctionDefinition: FunctionDefinition = {
    name: "get_instructions",
    description: "Liefert Instruktionen, wie mit der aktuellen Nutzeranfrage zu verfahren ist.",
    parameters: {
        type: "object",
        properties: {
            queriedParties: {
                type: "array",
                items: {
                    type: "string",
                    enum: [
                        "afd",
                        "cdu-csu",
                        "fdp",
                        "gruene",
                        "spd",
                    ],
                },
                description: "Die Parteien, zu denen Informationen vom Nutzer angefragt wurden. Leer, wenn keine spezifischen Parteien angefragt wurden.",
            },
            queryType: {
                type: "string",
                enum: [
                    "program",
                    "partySearch",
                    "assessment",
                    "quote",
                    "inquiry",
                    "inappropriate",
                ],
                description: "Typ der Anfrage: 'program' = Inhalte der Wahlprogramme; 'partySearch' = Welche Partei passt zu...; 'quote' = Zitate aus Wahlprogrammen; 'assessment' = Einschätzung/Bewertung; 'inquiry' = Verständnisrückfrage; 'inappropriate' = Unangemessene Frage.",
            },
            subPrompt: {
                type: "string",
                description: "Partei-agnostischer Prompt mit allen nötigen Infos, aber ohne Parteinamen, um die Frage an parteispezifische Assistenten weiterzuleiten.",
            },
            followUpQuestions: {
                type: "array",
                items: {
                    type: "string",
                },
                description: "Liste sinnvoller Folgefragen, die für ein tiefergehendes Verständnis relevant sein können.",
            },
        },
        required: [
            "queriedParties",
            "queryType",
            "subPrompt",
            "followUpQuestions",
        ],
        additionalProperties: false,
    },
    strict: true,
}

const partyAssistantInstructions = `
Du bist ein KI-Assistent mit Zugriff auf einen Vektorspeicher, der das Wahlprogramm der Partei {partyName} enthält.  
Liefere bei jeder Frage ausschließlich direkte Zitate aus dem Wahlprogramm, die thematisch passen.  

- Gib die Zitate bitte wortwörtlich in Anführungszeichen aus.  
- Nenne nach jedem Zitat die Position, an der das Zitat im Quelldokument zu finden ist, im Format
  \`〔{"party": "{partySymbol}", "section": "{sectionName}", "page": {pageNumber}}〕\` und
  ersetze dabei {sectionName} durch den exakten Titels des Abschnitts im Dokument und {pageNumber} durch die Seitenzahl.  
- Verwende unter keinen Umständen die Zeichen 【】 oder ähnliche Sonderzeichen für Quellenangaben.  
- Verzichte auf eine Einleitung und ein Fazit.  
- Wenn du keine passenden Stellen findest, antworte mit „Keine passenden Stellen gefunden.“.  

Beantworte jetzt jede Frage auf dieser Basis.
`

export async function updateMetaAssistant() {
    await updateAssistantInstructions(metaAssistantId, metaInstructions)
    await updateAssistantFunctionDefinition(metaAssistantId, metaFunctionDefinition)
}

export async function updatePartyAssistants() {
    for (const party of Object.keys(parties) as Party[]) {
        await updatePartyAssistant(party)
    }
}

async function updatePartyAssistant(party: Party) {
    const {symbol, name, assistantId} = parties[party]
    const instructions = partyAssistantInstructions
        .replace(/{partySymbol}/g, symbol)
        .replace(/{partyName}/g, name)
    await updateAssistantInstructions(assistantId, instructions)
}

async function updateAssistantInstructions(assistantId: string, instructions: string) {
    await aiClient.beta.assistants.update(assistantId, {instructions: instructions.trim()})
}

async function updateAssistantFunctionDefinition(assistantId: string, func: FunctionDefinition) {
    await aiClient.beta.assistants.update(assistantId, {
        tools: [{
            type: "function",
            function: func,
        }],
    })
}