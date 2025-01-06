import {
    AssistantModel,
    AssistantRun,
    AssistantRunResult,
    createRun,
    initialAssistantRunResult,
    RunStream,
    ToolFunctionResult,
} from "../assistant/assistant-run"
import {AIClient} from "../common/ai-client"
import {metaAssistantId} from "./assistant-setup"
import {maxNumberParties, Party, partyProps} from "./parties"
import {createPartyAssistantRun} from "./assistant-party"
import {HttpRequest} from "@azure/functions"
import {StreamingFunctionResponse} from "../common/ai-function"
import {getMixpanelEvent, mixpanel} from "../common/mixpanel"


type Query = {
    queriedParties: Party[]
    queryType: "program" | "partySearch" | "inquiry_noInformationRequired" | "inquiry_informationRequired" | "smallTalk" | "inappropriate"
    subPrompt: string
    category: string,
    followUpQuestions: string[]
}

type Command = "partySelector" | "followUpQuestions"

type Result = AssistantRunResult & Query & {
    command?: Command
}

class MetaAssistantRun extends AssistantRun<Result> {
    toolFunctions = {
        get_instructions: this.getInstructions.bind(this),
    }

    constructor(name: string | undefined, aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) {
        super(name, aiClient, threadId, stream, model, {
            ...initialAssistantRunResult,
            queriedParties: [],
            queryType: "program",
            subPrompt: "",
            category: "",
            followUpQuestions: [],
        })
    }

    private async getInstructions(
        toolCallId: string,
        {queriedParties, queryType, followUpQuestions, category, subPrompt}: Query
    ): Promise<ToolFunctionResult> {
        console.log("getInstructions")
        this.updateResult(prev => ({
            queriedParties: [...prev.queriedParties, ...queriedParties],
            queryType,
            subPrompt,
            category,
            followUpQuestions,
        }))

        switch (queryType) {
            case "partySearch":
                return this.functionOutput("partyInput", {toolCallId, subPrompt, followUpQuestions, queriedParties, ignorePartyLimits: true}, `
                Nenne dem Nutzer die Parteien, die laut den unten bereitgestellten Auszügen der Wahlprogrammen die gefragten Positionen vertreten.
                Führe die zur Position gehörenden Kernpunkte als kompakte Aufzählung auf.
            `)
            case "inquiry_noInformationRequired":
                return this.functionOutput("instructionOnly", {toolCallId},
                    "Antworte dem Nutzer auf Basis der Informationen aus dem Verlauf der Unterhaltung!"
                )
            case "inquiry_informationRequired":
                return this.functionOutput("partyInput", {toolCallId, subPrompt, queriedParties, followUpQuestions}, `
                Nenne dem Nutzer die Parteien, die laut den unten bereitgestellten Auszügen der Wahlprogrammen die gefragten Positionen vertreten.
                Führe die zur Position gehörenden Kernpunkte als kompakte Aufzählung auf.
            `)
            case "smallTalk":
                return this.functionOutput("instructionOnly", {toolCallId}, "Antworte dem Nutzer")
            case "inappropriate":
                return this.functionOutput("instructionOnly", {toolCallId}, `
                    Weise den Nutzer darauf hin, dass die Frage unangemessen ist. 
                    Du beantwortest ihm gerne Fragen zu den Wahlprogrammen der Parteien zur Bundestagswahl 2025.
                `)
            case "program":
            default:
                return this.functionOutput("directPartyOutput", {toolCallId, subPrompt, queriedParties, followUpQuestions},`
                Antworte mit "Hier die Antwort:"
            `)
        }
    }

    async functionOutput(
        outputType: "instructionOnly" | "partyInput" | "directPartyOutput",
        {toolCallId, followUpQuestions, subPrompt, queriedParties: parties, ignorePartyLimits}: {
            toolCallId: string,
            followUpQuestions?: string[],
            subPrompt?: string,
            queriedParties?: Party[],
            ignorePartyLimits?: boolean,
        },
        output: string
    ): Promise<ToolFunctionResult> {
        if (!ignorePartyLimits && parties && (parties?.length === 0 || parties?.length > maxNumberParties)) {
            this.updateResult(_ => ({command: "partySelector"}))
            return {
                toolCallId,
                output: `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`,
                events: [{event: "command", data: "selectParties"}],
            }
        }

        const events = followUpQuestions ? followUpQuestions.map(data => ({event: "followUpQuestion", data})) : []
        if (outputType === "instructionOnly") {
            return {toolCallId, output, events}
        }

        const partyAssistants = await Promise.all(parties.map(async party =>
            createPartyAssistantRun(party, this.aiClient, partyProps[party].assistantId, subPrompt),
        ))
        return {
            toolCallId,
            output,
            events,
            inputAssistants: outputType === "partyInput" ? partyAssistants : undefined,
            directOutputAssistants: outputType === "directPartyOutput" ? partyAssistants : undefined,
        }
    }
}

async function createMetaAssistantRun(
    aiClient: AIClient,
    threadId: string | undefined,
    message: string,
) {
    return await createRun({
        name: "Meta Assistant",
        aiClient,
        assistantId: metaAssistantId,
        threadId,
        message,
    }, (name, aiClient, threadId, stream, model) => new MetaAssistantRun(name, aiClient, threadId, stream, model))
}

async function runAssistant(aiClient: AIClient, threadId: string | undefined, message: string, request: HttpRequest): Promise<StreamingFunctionResponse> {
    const run = await createMetaAssistantRun(aiClient, threadId, message)
    run.addCompletedListener(result => sendMixpanelEvent(result, request))
    return {
        additionalHeaders: {
            "Thread-ID": run.threadId,
        },
        stream: run.output(),
    }
}

async function sendMixpanelEvent(result: AssistantRunResult, request: HttpRequest) {
    console.log(`meta assistant finished with these results:\n${JSON.stringify(result, null, 2)}`)
    const {name, ...tracked} = result
    mixpanel.track("Question Processed", {
        ...tracked,
        ...getMixpanelEvent(request),
    })
}

export async function createOrPostToThread(aiClient: AIClient, message: string, request: HttpRequest) {
    const threadId = request.params.threadId
    return runAssistant(aiClient, threadId, message, request)
}