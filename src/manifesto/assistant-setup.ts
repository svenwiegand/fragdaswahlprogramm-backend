import OpenAI from "openai"
import {parties as partyList, Party, partyProps} from "./parties"
import {
    replaceVectorStoreFiles,
    updateAssistantFunctionDefinition,
    updateAssistantInstructions,
} from "../assistant/assistant-setup"
import path from "node:path"
import {prepareMarkdown} from "./extract-manifesto"
import FunctionDefinition = OpenAI.FunctionDefinition
import {environmentRegion} from "../common/ai-client"

export const metaAssistantId = {
    swedencentral: "asst_iDqo1jpKOaCxsWkqBDe45sO7",
    eastus: "asst_BAY8rNqvyOlCaoVl2cqmEpr2",
}

const partyNames = Object.keys(partyProps).map(p => `${partyProps[p].name}`).join(", ")
const refFormat = `'〔{"party": "{partySymbol}", "section": "$Abschnitt", "shortSection": "$Abschnittskurzname", "page": $Seitenzahl, "quote": $Zitat}〕'`


const metaInstructions = `
Du bist ein Assistent, der Anfragen zu den Wahlprogrammen deutscher Parteien zur Bundestagswahl 2025 entgegennimmt und verarbeitet.
Du kennst ausschließlich die Wahlprogramme folgender Parteien: ${partyNames}.

# 1. Sammlung von Informationen
- Beantworte Fragen zu den Positionen der Parteien und den Inhalten ihrer Wahlprogramme ausschließlich auf Basis der Informationen aus dem Unterhaltungsverlauf und den Informationen, die Du von den Tool-Funktionen erhältst.
- Analysiere den bisherigen Verlauf der Unterhaltung und prüfe, ob bereits alle notwendigen Informationen zur Beantwortung der Anfrage verfügbar sind.
- Ermittle aus der Anfrage und dem bisherigen Verlauf, an welche Parteien sich die Anfrage richtet. In der Regel beziehen sich Folgefragen auf die Parteien, zu denen der Nutzer zuvor bereits gefragt hat.
- Wenn von "die Grünen" oder "den Grünen" gesprochen wird ist damit die Partei "Bündnis 90/Die Grünen" gemeint.

# 2. Aufruf der Funktion
Du musst bei jeder Anfrage **exakt einmal** die Funktion 'getPartyPositions' aufrufen.

## Beispiele
Die Folgende fortlaufende Unterhaltung zeigt beispielhaft den Funktionsaufruf und die Parameter:

- Anfrage: "Was planen die Parteien im Bereich Bildung?"
    - requestType: positions (Begründung: Der Nutzer fragt nach geplanten Maßnahmen der Parteien)
    - parties: [] (leer, da keine Parteien genannt)
    - minimalPrompt: "Was plant die Partei im Bereich Bildung?"
    - hasNecessaryInformation: false (da die Informationen aus den Wahlprogrammen benötigt werden)
- Anfrage: "Welche Partei setzt sich für ein Tempolimit ein?"
    - requestType: parties (Begründung: Der Nutzer nennt eine Maßnahme und fragt danach, von welchen Parteien diese geplant wird)
    - parties: [] (leer, da keine Parteien genannt)
    - minimalPrompt: "Setzt die Partei sich für ein Tempolimit ein?"
    - hasNecessaryInformation: false (da die Informationen aus den Wahlprogrammen benötigt werden)
- Anfrage: "Was planen CDU und FDP zur Rente?"
    - Funktion: positions (Begründung: Der Nutzer fragt nach konkreten Inhalten der Wahlprogramme für konkrete Parteien)
    - parties: ['cdu-csu', 'fdp']
    - minimalPrompt: "Was plant die Partei zur Rente?"
    - hasNecessaryInformation: false (da die Informationen aus den Wahlprogrammen benötigt werden)
- Anfrage: "Worin unterscheiden sich die Positionen der beiden?"
    - Funktion: positions (Begründung: Rückfrage zur vorherigen Frage)
    - parties: ['cdu-csu', 'fdp'] (wurden in der vorherigen Frage genannt)
    - minimalPrompt: "Was ist die Position der Partei zur Rente?"
    - hasNecessaryInformation: true (da die notwendigen Informationen aus den Wahlprogrammen bereits in der vorangehenden Frage ermittel wurden)

# 3. Verhalten
- Werte die Informationen aus der Anfrage und der bisherigen Unterhaltung aus. 
- Rufe die Funktion 'getPartyPositions' exakt einmal auf.
- Generiere auf Basis der Anfrage, der bisherigen Unterhaltung und bei Bedarf aus der Ausgabe der Funktion die Antwort.

# 4. Informationen aus Funktionsausgabe sammeln
- Sofern die aufgerufene Funktion Inhalte aus den Wahlprogrammen zurückgibt, so haben diese immer die gleiche Struktur: 
    - Eine Überschrift mit dem Namen der Partei, 
    - die Informationen in Form von Aufzählungspunkten und 
    - eine Liste von Referenzen mit Zitaten im Format ${refFormat}
- Nutze diese Informationen um Deine Antwort zu generieren

# 5. Ausgabe
- Deine Antworten gibst du immer kompakt in Form von kurzen Aufzählungen aus.
- Gib jedem Aufzählungspunkt genügend Kontextinformationen, damit der Nutzer qualifiziert informiert wird.
- Beende jeden Aufzählungspunkt nach dem Satzendezeichen jeweils mit der passenden Referenz, falls sie sich von der Referenz des vorherigen Punktes unterscheidet. 
  Gib die Referenz immer im Format ${refFormat} aus.- Du vermeidest Bias jeglicher Art.
- Du sprichst den Nutzer informell an und nutzt einfache Sprache.
- Vorschläge für Folgefragen übergibst Du ausschließlich an die Funktionen, fügst sie aber *nicht* zur Ausgabe hinzu.

# 6. Hinweise zur Robustheit
- Stelle unbedingt sicher, dass jeder Aufzählungspunkt Deiner Antwort mit einer Referenz endet.
- Übergib unbedingt die Liste der angefragten Parteien an die Funktion 'getPartyPositions'.
- Ruf die Funktion unbedingt nur ein einziges Mal auf.
`


const requestType = {
    type: "string",
    enum: ["positions", "parties"],
    description: `
        - 'positions': Der Nutzer fragt nach Positionen oder Inhalten der Wahlprogramme.
        - 'parties': Der Nutzer fragt nach Parteien, die eine bestimmte Position vertreten oder eine bestimmte Maßnahme planen.

        Sind beide Optionen gleich wahrscheinlich, dann wähle 'positions'.
        `,
}
const parties = {
    type: "array",
    items: {
        type: "string",
        enum: Object.keys(partyProps),
    },
    description: "Liste der Parteien, die der Nutzer entweder explizit in der Anfrage nennt oder die auf Basis des bisherigen Verlaufs der Unterhaltung mit der Anfrage gemeint sind.",
}
const minimalPrompt = {
    type: "string",
    description: "Der Prompt muss die aktuelle Anfrage im Kontext früherer Fragen und Antworten vollständig beschreiben und darf keine Parteinamen enthalten, sondern richtet sich allgemein an 'die Partei'.",
}
const hasNecessaryInformation = {
    type: "boolean",
    description: "'true', falls auf Basis des bisherigen Verlaufs der Unterhaltung alle notwendigen Informationen zur Verfügung stehen, um die Anfrage zu beantworten. 'false', falls weitere Informationen aus den Wahlprogrammen erforderlich sind.",
}
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
const metaFunctionDefinitions: FunctionDefinition[] = [
    {
        name: "getPartyPositions",
        description: "Liefert bei Informationen aus den Wahlprogrammen der Parteien. Darf nur einmal je Anfrage aufgerufen werden!",
        parameters: {
            type: "object",
            properties: {
                requestType,
                parties,
                minimalPrompt,
                hasNecessaryInformation,
                category,
            },
            required: [
                "requestType",
                "parties",
                "minimalPrompt",
                "hasNecessaryInformation",
                "category",
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
    const assistantId = metaAssistantId[environmentRegion]
    await updateAssistantInstructions(assistantId, metaInstructions)
    await updateAssistantFunctionDefinition(assistantId, metaFunctionDefinitions)
}

export async function updatePartyAssistants() {
    for (const party of Object.keys(partyProps) as Party[]) {
        await updatePartyAssistant(party)
    }
}

async function updatePartyAssistant(party: Party) {
    const {symbol, name, region} = partyProps[party]
    const instructions = partyAssistantInstructions
        .replace(/{partySymbol}/g, symbol)
        .replace(/{partyName}/g, name)
        .replace(/{partyManifesto}/g, partyProps[party].manifestoTitle)
    await updateAssistantInstructions(region[environmentRegion].assistantId, instructions)
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
        await replaceVectorStoreFiles(partyProps[party].region[environmentRegion].vectorStoreId, filePath, 400, 200)
    }
}