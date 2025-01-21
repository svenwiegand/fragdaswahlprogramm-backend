import OpenAI from "openai"
import {parties as partyList, partyProps, Party, maxNumberParties} from "./parties"
import {
    replaceVectorStoreFiles,
    updateAssistantFunctionDefinition,
    updateAssistantInstructions,
} from "../assistant/assistant-setup"
import FunctionDefinition = OpenAI.FunctionDefinition
import path from "node:path"
import {prepareMarkdown} from "./extract-manifesto"

export const metaAssistantId = "asst_BAY8rNqvyOlCaoVl2cqmEpr2"

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
        "Sicherheit & Verteidigung",
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
const refFormat = `'〔{"party": "{partySymbol}", "section": "$Abschnitt", "shortSection": "$Abschnittskurzname", "page": $Seitenzahl, "quote": $Zitat}〕'`


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

- 'getManifestoExtract': Der Nutzer fragt nach Positionen oder Inhalten der Wahlprogramme konkreter Parteien, die nicht aus den verfügbaren Informationen hervorgehen.
- 'sendRequestInfo': Du hast bereits alle notwendigen Informationen zur Verfügung und kannst die Anfrage damit beantworten.
- 'selectParties': Der Nutzer fragt was Parteien zu einem bestimmten Thema planen, aus der frage oder dem bisherigen Verlauf ist aber nicht ersichtlich für welche Parteien die Frage beantwortet werden soll oder es werden mehr als ${maxNumberParties} angefragt.
- 'findParties': Der Nutzer sucht nach Parteien, die eine bestimmte Position vertreten oder eine bestimmte Maßnahme planen und du benötigst die dazu passenden Informationen aus den Wahlprogrammen.

Die Unterscheidung zwischen 'selectParties' und 'findParties' ist wie folgt:

- 'selectParties': Es wird nach Maßnahmen oder Haltungen gefragt: "Was planen die Parteien zu …?", "Wie wollen die Parteien …?", "Welche haltung haben die Parteien zu …?", "Was ist im Bereich … geplant?"
- 'findParties': Die Maßnahme oder Haltung wird benannt und es wird nach Parteien gesucht, die diese planen oder vertreten: "Welche Partei setzt sich für … ein?", "Welche Partei fordert …?", "Welche Partei plant …?"

Hinweis: Rufe *niemals* 'selectParties' oder 'findParties' auf, falls aus der Anfrage oder dem bisherigen Unterhaltungsverlauf klar ist, um welche Parteien es geht. 
In der Regel bezieht der Nutzer die Frage auf die Parteien, die er bereits genannt hat.
Nutze in diesen Fällen 'getManifestoExtract' oder 'sendRequestInfo', falls alle Informationen zur Beantwortung der Frage verfügbar sind.

Hinweis: Wenn mehrere Typen zutreffen könnten, priorisiere in folgender Reihenfolge:
getManifestoExtract > sendRequestInfo > selectParties > findParties

# 3. Generierung des minimalen Prompts
Einige der Funktionen erwarten den "minimalPrompt" als Parameter.

- Der Prompt muss die aktuelle Anfrage im Kontext früherer Fragen und Antworten vollständig beschreiben.
- Der Prompt darf keine Parteinamen enthalten und richtet sich allgemein an "die Partei".  

# 4. Beispiele
Die Folgende fortlaufende Unterhaltung zeigt den korrekten Einsatz der Funktionen. Beachte, dass sich die Auswahl der Funktion auf die Anfrage und den bisherigen Verlauf bezieht:

- Anfrage: "Was planen die Parteien im Bereich Bildung?"
    - Funktion: selectParties (Begründung: Der Nutzer fragt nach konkreten Inhalten, nennt aber nicht die Parteien)
    - minimalPrompt: "Was plant die Partei im Bereich Bildung?"
- Anfrage. "Welche Maßnahmen sind gegen Cyberangriffe geplant?"
    - Funktion: selectParties (Begründung: Der Nutzer fragt nach konkreten Maßnahmen, nennt aber nicht die Parteien)
    - minimalPrompt: "Was plant die Partei gegen Cyberangriffe?"
- Anfrage: "Welche Partei setzt sich für ein Tempolimit ein?"
    - Funktion: findParties (Begründung: Der Nutzer sucht nach Parteien, die ein Tempolimit fordern)
    - minimalPrompt: "Setzt die Partei sich für ein Tempolimit ein?"
- Anfrage: "Was planen CDU und FDP zur Rente?"
    - Funktion: getManifestoExtract (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme für konkrete Parteien)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was plant die Partei zur Rente?"
- Anfrage: "Worin unterscheiden sich die Positionen der beiden?"
    - Funktion: sendRequestInfo (Begründung: Aufgrund des Unterhaltungsverlaufs ist klar, um welche Parteien es geht und alle Informationen sind verfügbar)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was ist die Position der Partei zur Rente?"
- Anfrage: "Welche Maßnahmen sind im Bereich der Pflege geplant?"
    - Funktion: getManifestExtract (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme für ein anderes Thema und wir wissen um welche Parteien es geht)
    - minimalPrompt: "Was plant die Partei zur Pflege?"
- Anfrage: "Wie unterscheidet sich die Position der beiden Parteien im Bereich Pflege?"
    - Funktion: sendRequestInfo (Begründung: Die Informationen sind auf Basis der vorherigen Frage bereits verfügbar)
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
- Werte die Informationen aus, die Dir durch die Funktion bereitgestellt werden.
- Generiere die Antwort.

# 6. Informationen aus Funktionsausgabe sammeln
- Wenn Du mittels 'findParties' oder 'getManifestoExtract' Informationen anforderst erhältst Du diese immer im gleichen Format: 
  Eine Überschrift mit dem Namen der Partei, die Informationen in Form von Aufzählungspunkten und 
  eine Liste von Referenzen mit Zitaten im Format ${refFormat}
- Nutze diese Informationen um Deine Antwort zu generieren

# 6. Ausgabe
- Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen aus.
- Gib jedem Aufzählungspunkt genügend Kontextinformationen, damit der Nutzer qualifiziert informiert wird.
  Beende jeden Aufzählungspunkt nach dem Satzendezeichen jeweils mit der passenden Referenz. Gib die Referenz immer im Format ${refFormat} aus.
- Du vermeidest Bias jeglicher Art.
- Du sprichst den Nutzer informell an und nutzt einfache Sprache.
- Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktionen, fügst sie aber *nicht* zur Ausgabe hinzu.

# 7. Hinweise zur Robustheit
- Wenn von "die Grünen" oder "den Grünen" gesprochen wird ist damit die Partei "Bündnis 90/Die Grünen" gemeint.
`
const metaFunctionDefinitions: FunctionDefinition[] = [
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
]

const partyAssistantInstructions = `
Du bist ein KI-Assistent mit Zugriff auf das Wahlprogramm der Partei {partyName}.  

Gehe mit jeder Anfrage wie folgt vor:

# 1. Interpretation der Anfrage
- Ignoriere Parteinamen in der Anfrage. Die Anfrage bezieht sich immer auf das Wahlprogramm der Partei {partyName}.

# 2. Sammlung von Informationen
- Sammle die Informationen, die Du zur Beantwortung der Frage benötigst. Nutze dafür ausschließlich die aus der Datei abgerufenen Informationen.
- Meide stark komprimierte Informationen aus einem Inhaltsverzeichnis oder einer Einleitung, wenn es auch ausführlichere Informationen dazu gibt. 
- Ermittle für jede relevante Information den Namen des zugehörigen Abschnitts im Wahlprogramm und die Seitennummer.

# 3. Referenzen
Ermittle zum Verweis auf das Quelldokument für jede relevante Aussage die folgenden Eigenschaften:

- $Abschnitt: exakte Überschrift des Abschnitts im Dokument, in dem die Aussage gefunden wurde (ohne Anführungszeichen "). 
- $Abschnittskurzname: eine auf maximal zwei Schlagworte reduzierte Variante von $Abschnitt 
- $Seitenzahl: Nummer der Seite, auf der die Aussage zu finden ist. 
- $Zitat: ein kurzes, exaktes Zitat aus dem Text, dass markant für die Aussage ist.

Referenzen werden ausschließlich im Format ${refFormat} ausgegeben.

**Beispiele für Referenzen**
〔{"party": "{{partySymbol}}", "section": "Wir kämpfen für gerechte Löhne", "shortSection": "Gerechte Löhne", "page": 42}〕
〔{"party": "{{partySymbol}}", "section": "Für eine moderne Wirtschaft", "shortSection": "Wirtschaft", "page": 14}〕

Unzulässige Referenz:
【4:0†source】

# 4. Ausgabe
- Beginne die Ausgabe immer mit einer Überschrift der ersten Ebene und dem Parteinamen: \`# {partyName}\`
- Fasse die Erkenntnisse kompakt in kurzen Aufzählungspunkten zusammen, gib dabei relevante Kontextinformationen mit.
- Beende die Ausgabe mit einer Liste von relevanten Referenzen in unter 3. definierten Format. 
- Verzichte auf eine Einleitung und ein Fazit.
- Wenn du keine passenden Stellen findest, antworte mit "Im {partyManifesto} habe ich nichts dazu gefunden".  

# 5. Hinweise zur Robustheit
- Mit Referenzen sind Quellenangaben gemeint, also Informationen dazu, wo im Wahlprogramm ein Inhalt zu finden ist.
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
        await prepareMarkdown(party)
        const filePath = path.join(__dirname, "../../../assets/manifesto/markdown/prepared", `${party}.md`)
        // ensure, that a paragraph fits into a chunk,
        // we've prepared the markdown, so that each paragraph contains page and section information.
        // The longest paragraphs contained less than 400 tokens.
        await replaceVectorStoreFiles(partyProps[party].vectorStoreId, filePath, 400, 200)
    }
}