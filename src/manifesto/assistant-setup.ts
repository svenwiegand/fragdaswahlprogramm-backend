import OpenAI from "openai"
import {partyProps, Party} from "./parties"
import {updateAssistantFunctionDefinition, updateAssistantInstructions} from "../assistant/assistant-setup"
import FunctionDefinition = OpenAI.FunctionDefinition

export const metaAssistantId = "asst_iDqo1jpKOaCxsWkqBDe45sO7"

const metaInstructions = `
Du bist ein Assistent, der Anfragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025 beantwortet entgegennimmt.
Deine Hauptaufgabe besteht in dem Aufruf der Tool-Funktion "get_instructions". 
Die eigentliche Beantwortung der Anfrage übernehmen spezialisierte Assistenten für die einzelnen Parteien auf Basis der an "get_instructions" übergebenen Daten. 

Verwende bitte immer folgende Richtlinien:

1. **Funktion für Anweisungen**:
   - Ruf bei jeder Frage exakt einmal die Funktion "get_instructions" auf und übergib dabei alle Parteien. Rufe die Funktion *nicht* mehrfach auf. 

2. **Ausgabe**:
   - Deine Aufgabe besteht im Aufruf der Funktion "get_instructions". Im Normalfall musst Du keinerlei eigene Antworten erzeugen, 
     es sei denn Du wirrst von get_instructions explizit dazu aufgefordert.
   
3. **Verhalten**:
Falls Du explizit zur Ausgabe von Antworten aufgefordert wirst, halte Dich an die folgenden Regeln:

   - Du antwortest ausschließlich auf Basis der Informationen, die Du von "get_instructions" erhältst, außer Du wirst explizit von "get_instructions" dazu aufgefordert, Dein implizites Wissen zu nutzen.
   - Du vermeidest Bias jeglicher Art.
   - Du sprichst den Nutzer informell an und nutzt einfache Sprache.
   - Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen.
   - Jeden Aufzählungspunkt beendest Du mit der Quellenangabe im Format \`〔{"party": "{partySymbol}", "section": "{sectionName}", "shortSection": "{shortSectionName}", "page": {pageNumber}, "quote": {quote}}〕\`. wie Du sie in der Quelle vorfindest.
   - Verwende unter keinen Umständen die Zeichen 【】oder Fußnoten für Quellenangaben, sondern ausschließlich das oben angegebene Format.
   - Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktion "get_instructions", fügst sie aber *nicht* zur Ausgabe hinzu.
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
                        "linke",
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
                    "smallTalk",
                    "inappropriate",
                ],
                description: "Typ der Anfrage: 'program' = Inhalte der Wahlprogramme; 'partySearch' = Welche Partei passt zu...; 'quote' = Zitate aus Wahlprogrammen; 'assessment' = Einschätzung/Bewertung; 'inquiry' = Verständnisrückfrage; 'smalltalk' = Begrüßung oder allgemeine Unterhaltung; 'inappropriate' = Unangemessene Frage.",
            },
            subPrompt: {
                type: "string",
                description: `Ein Prompt, der die aktuelle Anfrage im Kontext früherer Fragen und Antworten beschreibt und keine Parteinamen enthält, sondern allgemein an "die Partei" gerichtet ist.`,
            },
            category: {
                type: "string",
                enum: [
                    "Wirtschaft & Finanzen",
                    "Arbeit & Soziales",
                    "Bildung & Forschung",
                    "Gesundheit & Pflege",
                    "Familie & Gesellschaft",
                    "Umwelt & Klima",
                    "Migration & Integration",
                    "Außenpolitik",
                    "Innere Sicherheit",
                    "Verkehr & Infrastruktur",
                    "Digitalisierung & Technologie",
                    "Europa",
                    "Demokratie & Rechtsstaat",
                    "Innovation & Zukunft",
                ],
                description: "Kategorie der Anfrage",
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
            "category",
            "followUpQuestions",
        ],
        additionalProperties: false,
    },
    strict: true,
}

const partyAssistantInstructions = `
Du bist ein KI-Assistent mit Zugriff auf das Wahlprogramm der Partei {partyName}.  
Liefere bei jeder Frage eine Antwort, die den folgenden Vorgaben entspricht:
 
- Beginne die Ausgabe mit einer Überschrift der ersten Ebene und dem Parteinamen: \`# {partyName}\`
- Ignoriere in der Anfrage enthaltene Parteinamen und beziehe dich ausschließlich auf das Wahlprogramm der Partei {partyName}.
- Beantworte die Frage ausschließlich basierend auf dem Dir vorliegenden Wahlprogramm.
- Fasse die Erkenntnisse kompakt in kurzen Aufzählungen zusammen.
- Füge jedem Aufzählungspunkt einen Verweise auf die relevante Stelle im Wahlprogramm im folgenden Format hinzu:
  \`〔{"party": "{partySymbol}", "section": "{sectionName}", "shortSection": "{shortSectionName}", "page": {pageNumber}, "quote": {quote}}〕\` und
  ersetze dabei {sectionName} durch den exakten Titels des Abschnitts im Dokument (darf nicht das Zeichen " enthalten), 
  {shortSectionName} durch eine auf ein Schlagwort reduzierte Variante von {sectionName}, 
  {pageNumber} durch die Seitenzahl und
  {quote} durch das wortwörtliche Zitat (darf nicht das Zeichen " enthalten).
- Verwende unter keinen Umständen die Zeichen 【】 oder Fußnoten für Quellenangaben, sondern ausschließlich das oben angegebene Format.  
- Verzichte auf eine Einleitung und ein Fazit.  
- Wenn du keine passenden Stellen findest, antworte mit „Keine passenden Informationen gefunden.“.  

Beantworte jetzt jede Frage auf dieser Basis.
`

export async function updateMetaAssistant() {
    await updateAssistantInstructions(metaAssistantId, metaInstructions)
    await updateAssistantFunctionDefinition(metaAssistantId, metaFunctionDefinition)
}

export async function updatePartyAssistants() {
    for (const party of Object.keys(partyProps) as Party[]) {
        await updatePartyAssistant(party)
    }
}

async function updatePartyAssistant(party: Party) {
    const {symbol, name, assistantId} = partyProps[party]
    const instructions = partyAssistantInstructions
        .replace(/{partySymbol}/g, symbol)
        .replace(/{partyName}/g, name)
    await updateAssistantInstructions(assistantId, instructions)
}
