import {
    AssistantModel,
    AssistantRun,
    AssistantRunResult,
    createRun,
    initialAssistantRunResult,
    RunStream, SSEEvent,
    ToolFunctionResult,
} from "../assistant/assistant-run"
import {AIClient} from "../common/ai-client"
import {metaAssistantId} from "./assistant-setup"
import {maxNumberParties, parties, Party, partyProps} from "./parties"
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
type PartiesArg = {
    parties: Party[]
}
type MinimalPromptArg = {
    minimalPrompt: string
}
type CategoryArg = {
    category: string
}
type FollowUpQuestionsArg = {
    followUpQuestions: string[]
}

type Command = "partySelector" | "followUpQuestions"

type Result = AssistantRunResult & Query & {
    command?: Command
}

const statusEvent = {
    searching: {status: "searching"},
    generating: {status: "generating"},
}

class MetaAssistantRun extends AssistantRun<Result> {
    toolFunctions = {
        selectParties: this.selectParties.bind(this),
        findParties: this.findParties.bind(this),
        getManifestoExtract: this.getManifestoExtract.bind(this),
        sendRequestInfo: this.sendRequestInfo.bind(this),
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

    private async selectParties(toolCallId: string): Promise<ToolFunctionResult> {
        console.log("selectParties")
        return {
            toolCallId,
            output: `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`,
            ...this.createEvents(undefined, {command: "selectParties"}),
        }
    }

    private async findParties(toolCallId: string, args: MinimalPromptArg & CategoryArg & FollowUpQuestionsArg): Promise<ToolFunctionResult> {
        console.log("findParties", args)
        return {
            toolCallId,
            output: "",
            ...await this.inputAssistants(parties, args.minimalPrompt, "few"),
            ...this.createEvents(args.followUpQuestions, statusEvent.searching),
        }
    }

    private async getManifestoExtract(toolCallId: string, args: PartiesArg & MinimalPromptArg & CategoryArg & FollowUpQuestionsArg): Promise<ToolFunctionResult> {
        console.log("getManifestoExtract", args)
        return {
            toolCallId,
            output: "",
            ...await this.inputAssistants(args.parties, args.minimalPrompt, args.parties.length == 1 ? "many" : "medium"),
            ...this.createEvents(args.followUpQuestions, statusEvent.searching),
        }
    }

    private async sendRequestInfo(toolCallId: string, args: PartiesArg & MinimalPromptArg & CategoryArg & FollowUpQuestionsArg): Promise<ToolFunctionResult> {
        console.log("sendRequestInfo", args)
        return {toolCallId, output: "", ...this.createEvents(args.followUpQuestions, statusEvent.generating)}
    }

    private createEvents(
        followUpQuestions: string[] | undefined = undefined,
        events: Record<string, string> | undefined = undefined
    ): {events: SSEEvent[]} {
        const followUpEvents = followUpQuestions ? followUpQuestions.map(data => ({event: "followUpQuestion", data})) : []
        const otherEvents = events ? Object.entries(events).map(([event, data]) => ({event, data})) : []
        return {
            events: [...followUpEvents, ...otherEvents]
        }
    }

    private async inputAssistants(parties: Party[], prompt: string, searchResults: "many" | "medium" | "few"): Promise<{ inputAssistants: AssistantRun[] }> {
        const inputAssistants = await Promise.all(parties.map(async party =>
            createPartyAssistantRun(party, this.aiClient, partyProps[party].assistantId, prompt, searchResults),
        ))
        return {inputAssistants}
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