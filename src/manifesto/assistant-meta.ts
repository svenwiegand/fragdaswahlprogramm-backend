import {
    AssistantModel,
    AssistantRun,
    AssistantRunResult,
    createRun,
    initialAssistantRunResult,
    RunStream,
    SSEEvent,
    ToolFunctionResult,
} from "../assistant/assistant-run"
import {AIClient, environmentRegion} from "../common/ai-client"
import {metaAssistantId} from "./assistant-setup"
import {parties, Party, partyProps} from "./parties"
import {createPartyAssistantRun} from "./assistant-party"
import {HttpRequest} from "@azure/functions"
import {StreamingFunctionResponse} from "../common/ai-function"
import {getMixpanelEvent, mixpanel} from "../common/mixpanel"
import {generateSuggestions} from "./suggestions"

const maxNumberPartyPositions = 4
const maxNumberPartySearch = 6

type PartiesArg = {
    parties: Party[]
}
type MinimalPromptArg = {
    minimalPrompt: string
}
type CategoryArg = {
    category: string
}

type FunctionArgs = PartiesArg & MinimalPromptArg & CategoryArg & {
    requestType: "positions" | "parties"
    hasNecessaryInformation: boolean
}

type Result = AssistantRunResult & {
    queriedParties: Party[]
    queryType: "selectParties" | "findParties" | "manifestoExtract" | "context" | "unknown"
    subPrompt: string
    category: string,
    followUpQuestions: string[]
}

const statusEvent = {
    searching: {status: "searching"},
    generating: {status: "generating"},
}

class MetaAssistantRun extends AssistantRun<Result> {
    toolFunctions = {
        getPartyPositions: this.getPartyPositionsFunction.bind(this),
    }

    constructor(name: string | undefined, aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) {
        super(name, aiClient, threadId, stream, model, {
            ...initialAssistantRunResult,
            queriedParties: [],
            queryType: "unknown",
            subPrompt: "",
            category: "unknown",
            followUpQuestions: [],
        })
        this.addPostProcessor(this._generateSuggestions.bind(this))
    }

    private async getPartyPositionsFunction(toolCallId: string, args: FunctionArgs): Promise<ToolFunctionResult> {
        if (args.hasNecessaryInformation) {
            return await this.noInfoRequired(toolCallId, args)
        } else if (args.requestType === "parties") {
            if (args.parties.length === 0 || args.parties.length > maxNumberPartySearch) {
                return await this.selectParties(toolCallId, maxNumberPartySearch, args)
            } else {
                return await this.findParties(toolCallId, args)
            }
        } else if (args.parties.length === 0 || args.parties.length > maxNumberPartySearch) { // it's intentional, that we check for maxNumberPartySearch here, if the previous request was a party selection for a party search
            return await this.selectParties(toolCallId, maxNumberPartyPositions, args)
        } else {
            return await this.getManifestoExtract(toolCallId, args)
        }
    }

    private async selectParties(toolCallId: string, maxNumberParties: number, args: FunctionArgs): Promise<ToolFunctionResult> {
        this.trackRequest("selectParties", args)
        return {
            toolCallId,
            output: `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`,
            ...this.createEvents({command: `selectParties(${maxNumberParties})`}),
        }
    }

    private async findParties(toolCallId: string, args: FunctionArgs): Promise<ToolFunctionResult> {
        this.trackRequest("findParties", args)
        return {
            toolCallId,
            output: "",
            ...await this.inputAssistants(parties, args.minimalPrompt, "few"),
            ...this.createEvents(statusEvent.searching),
        }
    }

    private async getManifestoExtract(toolCallId: string, args: PartiesArg & MinimalPromptArg & CategoryArg): Promise<ToolFunctionResult> {
        this.trackRequest("manifestoExtract", args)
        return {
            toolCallId,
            output: "",
            ...await this.inputAssistants(args.parties, args.minimalPrompt, args.parties.length == 1 ? "many" : "medium"),
            ...this.createEvents(statusEvent.searching),
        }
    }

    private async noInfoRequired(toolCallId: string, args: PartiesArg & MinimalPromptArg & CategoryArg): Promise<ToolFunctionResult> {
        this.trackRequest("context", args)
        return {toolCallId, output: "", ...this.createEvents(statusEvent.generating)}
    }

    private trackRequest(requestType: Result["queryType"], args: Partial<PartiesArg & MinimalPromptArg & CategoryArg>) {
        console.log(`==> ${requestType}`, args)
        this.updateResult(prev => ({
            queryType: requestType,
            category: args.category ?? prev.category,
            subPrompt: args.minimalPrompt ?? prev.subPrompt,
            queriedParties: [...prev.queriedParties, ...(args.parties ?? [])],
        }))
    }

    private createEvents(
        events: Record<string, string> | undefined = undefined
    ): {events: SSEEvent[]} {
        const otherEvents = events ? Object.entries(events).map(([event, data]) => ({event, data})) : []
        return {
            events: [...otherEvents]
        }
    }

    private async inputAssistants(parties: Party[], prompt: string, searchResults: "many" | "medium" | "few"): Promise<{ inputAssistants: AssistantRun[] }> {
        const inputAssistants = await Promise.all(parties.map(async party =>
            createPartyAssistantRun(party, this.aiClient, partyProps[party].region[environmentRegion].assistantId, prompt, searchResults),
        ))
        return {inputAssistants}
    }

    private async _generateSuggestions(result: Result, generatedContent: string): Promise<SSEEvent[]> {
        if (result.queryType === "selectParties") {
            return []
        }

        console.log("Generating suggestions")
        const suggestionResult = await generateSuggestions(this.aiClient, generatedContent)
        console.log("Suggestions generated", suggestionResult)
        this.updateResult(result => ({
            ...result,
            inputTokensStandard: result.inputTokensStandard + suggestionResult.inputTokensStandard,
            outputTokensStandard: result.outputTokensStandard + suggestionResult.outputTokensStandard,
            inputTokensMini: result.inputTokensMini + suggestionResult.inputTokensMini,
            outputTokensMini: result.outputTokensMini + suggestionResult.outputTokensMini,
            suggestions: suggestionResult.suggestions,
        }))
        return suggestionResult.suggestions.map(data => ({event: "followUpQuestion", data}))
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
        assistantId: metaAssistantId[environmentRegion],
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