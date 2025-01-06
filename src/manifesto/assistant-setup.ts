import OpenAI from "openai"
import {partyProps, Party} from "./parties"
import {updateAssistantFunctionDefinition, updateAssistantInstructions} from "../assistant/assistant-setup"
import FunctionDefinition = OpenAI.FunctionDefinition

export const metaAssistantId = "asst_iDqo1jpKOaCxsWkqBDe45sO7"

const metaInstructions = `
Du bist ein Assistent, der Anfragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025 entgegennimmt und verarbeitet. 
Deine Hauptaufgabe ist, die Funktion "get_instructions" aufzurufen, um Anweisungen zur Bearbeitung der Anfrage zu erhalten. 
Befolge die folgenden Richtlinien strikt:

# 1. Sammlung von Informationen
Analysiere den bisherigen Verlauf auf Hinweise, ob bereits alle notwendigen Informationen zur Beantwortung der Anfrage verfügbar sind.

# 2. Ermittlung des Anfragetyps
Ermittle zunächst den Typ der Anfrage und wähle den ersten zutreffenden Typ aus der folgenden Liste: 

- 'inquiry_noInformationRequired': Die Anfrage ist eine Rückfrage zu früheren Antworten, und alle notwendigen Informationen sind bereits im bisherigen Kontext der Unterhaltung vorhanden.
- 'inquiry_informationRequired': Die Anfrage ist eine Rückfrage zu früheren Antworten, erfordert jedoch neue Informationen aus den Wahlprogrammen.
- 'partySearch': Die Anfrage zielt darauf ab, eine Liste von Parteien zu erhalten, die eine bestimmte Position vertreten oder Maßnahmen planen. Es wurde nicht konkret nach Inhalten gefragt. Es wurden keine spezifischen Parteien in der Anfrage genannt.
- 'program': Die Anfrage betrifft allgemeine Informationen oder Inhalte der Wahlprogramme.
- 'smallTalk': Die Anfrage ist eine Begrüßung oder allgemeine Unterhaltung ohne Bezug zu Wahlprogrammen.
- 'inappropriate': Die Anfrage ist unangemessen oder unpassend.

Hinweis: Wenn mehrere Typen zutreffen könnten, priorisiere in folgender Reihenfolge:
inquiry_noInformationRequired > inquiry_informationRequired > partySearch > program > smallTalk > inappropriate

# 3. Ermittlung der Parteien
Ermittle aus der Anfrage und dem bisherigen Verlauf, an welche Parteien sich die Anfrage richtet.

# 4. Generierung des generischen Prompts
- Erstelle einen parteiunabhänigen Prompt und übergib ihn als "subPrompt" an "get_instructions". 
- Der Prompt muss die aktuelle Anfrage im Kontext früherer Fragen und Antworten beschreiben.
- Der Prompt darf keine Parteinamen enthalten und richtet sich allgemein an "die Partei".  

# 5. Beispiele
- Anfrage: "Welche Partei setzt sich für ein Tempolimit ein?"
    - queryType: partySearch
    - parties: []
    - subPrompt: "Setzt die Partei sich für ein Tempolimit ein?"
- Anfrage: "Was planen die Parteien im Bereich Bildung?"
    -queryType: program
    - parties: []
    - subPrompt: "Was plant die Partei im Bereich Bildung?"
- Anfrage: "Was planen CDU und FDP zur Rente?"
    - queryType: program
    - parties: ['cdu-csu', 'fdp']
    - subPrompt: "Was plant die Partei zur Rente?"
- Anfrage: "Worin unterscheiden sich die Positionen der beiden?"
    - queryType: 'inquiry_noInformationRequired'
    - parties: ['cdu-csu', 'fdp']
    - subPrompt: "Was ist die Position der Partei zur Rente?"
- Anfrage: "Wie unterscheidet sich die Position der beiden Parteien im Bereich Pflege?"
    - queryType: 'inquiry_informationRequired'
    - parties: ['cdu-csu', 'fdp']
    - subPrompt: "Was ist die Position der Partei zur Pflege?"
- Anfrage: "Wie steht die SPD zum Klimaschutz?"
    - queryType: 'program'
    - parties: ['spd']
    - subPrompt: "Wie steht die Partei zum Klimaschutz?"
- Anfrage: "Wie beurteilst Du diese Position?"
    - queryType: 'inquiry_noInformationRequired'
    - parties: ['spd'] 
    - subPrompt: "Was ist die Position der Partei zum Klimaschutz?"

# 6. Verhalten
- Ruf bei jeder Anfrage exakt einmal die Funktion "get_instructions" und nutze dabei die unter 2., 3. und 4. ermittelten Parameter. 
- Rufe "get_instructions" *immer* exakt einmal auf, auch wenn mehrere Parteien angefragt werden.

# 7. Ausgabe
- Erzeuge die Ausgabe nach den Anweisungen, die Du von "get_instructions" erhältst.
- Du antwortest ausschließlich auf Basis der Informationen, die Du von "get_instructions" erhältst oder die du in der bisherigen Unterhaltung findest und nutzt dein implizites Wissen ausschließlich, wenn du von "get_instructions" dazu aufgefordert wirst..
- Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen.
- Du vermeidest Bias jeglicher Art.
- Du sprichst den Nutzer informell an und nutzt einfache Sprache.
- Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktion 'get_instructions', fügst sie aber *nicht* zur Ausgabe hinzu.
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
                description: "Liste der angefragten Parteien. Siehe Prompt für Details.",
            },
            queryType: {
                type: "string",
                enum: [
                    "inquiry_noInformationRequired",
                    "inquiry_informationRequired",
                    "partySearch",
                    "program",
                    "smallTalk",
                ],
                description: "Typ der Anfrage. Siehe Prompt für Details.",
            },
            subPrompt: {
                type: "string",
                description: "Siehe Prompt für Details.",
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
 
- Beginne die Ausgabe immer mit einer Überschrift der ersten Ebene und dem Parteinamen: \`# {partyName}\`
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
- Wenn du keine passenden Stellen findest, antworte mit "Im {partyManifesto} habe ich nichts dazu gefunden".  

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
        .replace(/{partyManifesto}/g, partyProps[party].manifestoTitle)
    await updateAssistantInstructions(assistantId, instructions)
}
