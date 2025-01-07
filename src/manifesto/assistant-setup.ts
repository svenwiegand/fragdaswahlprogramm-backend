import OpenAI from "openai"
import {parties as partyList, partyProps, Party, maxNumberParties} from "./parties"
import {
    replaceVectorStoreFiles,
    updateAssistantFunctionDefinition,
    updateAssistantInstructions,
} from "../assistant/assistant-setup"
import FunctionDefinition = OpenAI.FunctionDefinition
import path from "node:path"

export const metaAssistantId = "asst_PUwOsg3hTIjlOWNlJXAsMqHc"

const category = {
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
}
const followUpQuestions = {
    type: "array",
        items: {
        type: "string",
    },
    description: "Liste sinnvoller Folgefragen, die für ein tiefergehendes Verständnis relevant sein können. Keine Vergleiche unter den Parteien.",
}
const parties = {
    type: "array",
        items: {
        type: "string",
        enum: Object.keys(partyProps),
    },
    description: "Liste der Parteien, auf die sich die Anfrage bezieht.",
}
const minimalPrompt = {
    type: "string",
    description: "Kurzer, prägnanter Prompt, der die Anfrage vollständig beschreibt.",
}

const partyNames = Object.keys(partyProps).map(p => `${partyProps[p].name} (${p})`).join(", ")
const refFormat = `\`〔{"party": "{partySymbol}", "section": "{sectionName}", "shortSection": "{shortSectionName}", "page": {pageNumber}}〕\``


const metaInstructions = `
Du bist ein Assistent, der Anfragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025 entgegennimmt und verarbeitet.
Du kennst ausschließlich die Wahlprogramme folgender Parteien: ${partyNames}.

# 1. Sammlung von Informationen
- Analysiere den bisherigen Verlauf auf Hinweise, ob bereits alle notwendigen Informationen zur Beantwortung der Anfrage verfügbar sind.
- Ermittle ob Du alle notwendigen Informationen zur Beantwortung der Frage hast.
- Beantworte Fragen zu den Positionen der Parteien und den Inhalten ihrer Wahlprogramme ausschließlich auf Basis der Informationen aus "getManifestoExtract" oder dem bisherigen Kontext der Unterhaltung.
- Ermittle aus der Anfrage und dem bisherigen Verlauf, an welche Parteien sich die Anfrage richtet.

# 2. Ermittlung der aufzurufenden Funktion
Du musst bei jeder Anfrage exakt eine der folgenden Funktionen aufrufen:

- 'findParties': Der Nutzer sucht nach Parteien, die eine bestimmte Position vertreten oder Maßnahme planen und du benötigst die dazu passenden Informationen aus den Wahlprogrammen.
- 'getManifestoExtract': Der Nutzer fragt nach Positionen oder Inhalten der Wahlprogramme konkreter Parteien, die nicht aus den verfügbaren Informationen hervorgehen.
- 'selectParties': Der Nutzer fragt nach Positionen oder Inhalten der Wahlprogramme, es ist aber nicht ersichtlich für welche Parteien die Frage beantwortet werden soll oder es werden mehr als ${maxNumberParties} angefragt.
- 'sendRequestInfo': Du hast alle notwendigen Informationen und kannst die Anfrage beantworten.

Hinweis: Wenn mehrere Typen zutreffen könnten, priorisiere in folgender Reihenfolge:
getManifestoExtract > sendRequestInfo > selectParties > findParties

# 3. Generierung des minimalen Prompts
Einige der Funktionen erwarten den "minimalPrompt" als Parameter.

- Der Prompt muss die aktuelle Anfrage im Kontext früherer Fragen und Antworten vollständig beschreiben.
- Der Prompt darf keine Parteinamen enthalten und richtet sich allgemein an "die Partei".  

# 4. Beispiele
- Anfrage: "Welche Partei setzt sich für ein Tempolimit ein?"
    - Funktion: findParties (Begründung: Der Nutzer sucht nach Parteien, die ein Tempolimit fordern)
    - minimalPrompt: "Setzt die Partei sich für ein Tempolimit ein?"
- Anfrage: "Was planen die Parteien im Bereich Bildung?"
    - Funktion: selectParties (Begründung: Der Nutzer fragt nach konkreten Inhalten, nennt aber nicht die Parteien)
    - minimalPrompt: "Was plant die Partei im Bereich Bildung?"
- Anfrage: "Was planen CDU und FDP zur Rente?"
    - Funktion: getManifestoExtract (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme für konkrete Parteien)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was plant die Partei zur Rente?"
- Anfrage: "Worin unterscheiden sich die Positionen der beiden?"
    - Funktion: sendRequestInfo (Begründung: Aufgrund des Unterhaltungsverlaufs ist klar, um welche Parteien es geht und alle Informationen sind verfügbar)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was ist die Position der Partei zur Rente?"
- Anfrage: "Wie unterscheidet sich die Position der beiden Parteien im Bereich Pflege?"
    - Funktion: getManifestoExtract (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme zu einem anderen Thema und wir wissen um welche Parteien es geht)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was ist die Position der Partei zur Pflege?"
- Anfrage: "Wie steht die SPD zum Klimaschutz?"
    - queryType: getManifestoExtract (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme zu einer genannten Partei)
    - parties: ['spd']
    - minimalPrompt: "Wie steht die Partei zum Klimaschutz?"
- Anfrage: "Wie beurteilst Du diese Position?"
    - queryType: 'sendRequestInfo' (Begründung: Alle notwendigen Informationen sind aufgrund der bisherigen Unterhaltung verfügbar)
    - parties: ['spd'] 
    - minimalPrompt: "Was ist die Position der Partei zum Klimaschutz?"

# 5. Verhalten
- Werte die Informationen aus der Anfrage und der bisherigen Unterhaltung aus. 
- Rufe die eine am besten passende Funktion auf.
- Generiere die antwort.

# 6. Ausgabe
- Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen.
- Füge am Ende jedes Aufzählungspunkts eine Quellenangaben im Format ${refFormat} hinzu, sofern Du in der Eingabe eine findest.
- Quellenangaben in der Form 【...】 ignorierst Du.
- Du vermeidest Bias jeglicher Art.
- Du sprichst den Nutzer informell an und nutzt einfache Sprache.
- Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktionen, fügst sie aber *nicht* zur Ausgabe hinzu.

# 7. Hinweise zur Robustheit
- Wenn von "die Grünen" oder "den Grünen" gesprochen wird ist damit die Partei "Bündnis 90/Die Grünen" gemeint.
`
const metaFunctionDefinitions: FunctionDefinition[] = [
    {
        name: "findParties",
        description: "Liefert die Informationen, welche Parteien eine bestimmte Position vertreten oder Maßnahme planen.",
        parameters: {
            type: "object",
            properties: {
                minimalPrompt,
                category,
                followUpQuestions,
            },
            required: [
                "minimalPrompt",
                "category",
                "followUpQuestions"
            ],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "selectParties",
        description: "Fordert den Nutzer zur Auswahl von Parteien auf.",
        parameters: {
            type: "object",
            properties: {
            },
            required: [
            ],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "getManifestoExtract",
        description: "Liefert relevante Informationen aus dem Wahlprogramm ein oder mehrerer Parteien",
        parameters: {
            type: "object",
            properties: {
                parties,
                minimalPrompt,
                category,
                followUpQuestions,
            },
            required: [
                "parties",
                "minimalPrompt",
                "category",
                "followUpQuestions",
            ],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        name: "sendRequestInfo",
        description: "Wird aufgerufen, wenn keine der anderen Funktionen zutrifft, um der App Informationen zur Anfrage bereitzustellen.",
        parameters: {
            type: "object",
            properties: {
                parties,
                minimalPrompt,
                category,
                followUpQuestions,
            },
            required: [
                "parties",
                "minimalPrompt",
                "category",
                "followUpQuestions",
            ],
            additionalProperties: false,
        },
        strict: true,
    },
]

const partyAssistantInstructions = `
Du bist ein KI-Assistent mit Zugriff auf das Wahlprogramm der Partei {partyName}.  
Liefere bei jeder Frage eine Antwort, die den folgenden Vorgaben entspricht:
 
- Beginne die Ausgabe immer mit einer Überschrift der ersten Ebene und dem Parteinamen: \`# {partyName}\`
- Ignoriere in der Anfrage enthaltene Parteinamen und beziehe dich immer auf das Wahlprogramm der Partei {partyName}.
- Beantworte die Frage ausschließlich basierend auf dem Dir vorliegenden Wahlprogramm.
- Fasse die Erkenntnisse kompakt in kurzen Aufzählungen zusammen.
- Füge jedem Aufzählungspunkt einen Verweise auf die relevante Stelle im Wahlprogramm im folgenden Format hinzu:
  ${refFormat}
  Ersetze die Variablen dabei durch folgende Werte: 
  - {sectionName}: exakter Titel des Abschnitts im Dokument (darf nicht das Zeichen " enthalten) 
  - {shortSectionName}: eine auf ein Schlagwort reduzierte Variante von "{sectionName}" 
  - {pageNumber}: Seitenzahl des Treffers
- Verwende unter keinen Umständen die Zeichen 【】 oder Fußnoten für Quellenangaben, sondern ausschließlich das oben angegebene Format.  
- Verzichte auf eine Einleitung und ein Fazit.  
- Wenn du keine passenden Stellen findest, antworte mit "Im {partyManifesto} habe ich nichts dazu gefunden".  

Beantworte jetzt jede Frage auf dieser Basis.
`

export async function updateMetaAssistant() {
    await updateAssistantInstructions(metaAssistantId, metaInstructions)
    await updateAssistantFunctionDefinition(metaAssistantId, metaFunctionDefinitions)
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

export async function updateVectorStore(party: Party | "all") {
    if (party === "all") {
        await Promise.all(partyList.map(async party => updateVectorStore(party)))
    } else {
        const filePath = path.join(__dirname, "../../../assets/wahlprogramme", `${party}.pdf`)
        await replaceVectorStoreFiles(partyProps[party].vectorStoreId, filePath)
    }
}