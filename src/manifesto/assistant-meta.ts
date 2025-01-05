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
import {maxNumberParties, parties, Party, partyProps} from "./parties"
import {createPartyAssistantRun} from "./assistant-party"
import {HttpRequest} from "@azure/functions"
import {StreamingFunctionResponse} from "../common/ai-function"
import {getMixpanelEvent, mixpanel} from "../common/mixpanel"


type Query = {
    queriedParties: Party[]
    queryType: "program" | "partySearch" | "assessment" | "quote" | "inquiry" | "smallTalk" | "inappropriate"
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

    constructor(aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) {
        super(aiClient, threadId, stream, model, {
            ...initialAssistantRunResult,
            queriedParties: [],
            queryType: "program",
            subPrompt: "",
            category: "",
            followUpQuestions: [],
        })
    }

    private async getInstructions(toolCallId: string, query: Query): Promise<ToolFunctionResult> {
        console.log("getInstructions")
        this.updateResult(prev => {
            return {
                queriedParties: [...prev.queriedParties, ...query.queriedParties],
                queryType: query.queryType,
                subPrompt: query.subPrompt,
                category: query.category,
                followUpQuestions: query.followUpQuestions,
            }
        })
        switch (query.queryType) {
            case "program":
                return this.detailedInstructions(toolCallId, query.subPrompt, query.queriedParties, query.followUpQuestions, `
                Antworte mit "Hier die Antwort:"
            `)
            case "partySearch":
                return this.detailedInstructions(toolCallId, query.subPrompt, parties, query.followUpQuestions, `
                Nenne dem Nutzer die Parteien, die laut den unten bereitgestellten Auszügen der Wahlprogrammen die gefragten Positionen vertreten.
                Führe die zur Position gehörenden Kernpunkte als kompakte Aufzählung auf.
            `)
            case "assessment":
                return this.detailedInstructions(toolCallId, query.subPrompt, query.queriedParties, query.followUpQuestions, `
                Nimm die angefragte Bewertung vor.
            `)
            case "quote":
                return this.detailedInstructions(toolCallId, query.subPrompt, query.queriedParties, undefined, `
                Zitiere die relevanten Ausschnitte ausschließlich auf Basis der unten bereitgestellten Auszüge der Wahlprogramme. 
            `)
            case "inquiry":
                return this.detailedInstructions(toolCallId, query.subPrompt, query.queriedParties, query.followUpQuestions, `
                Beantworte die Rückfrage des Nutzers.
            `)
            case "smallTalk":
                return {
                    toolCallId,
                    output: "Antworte dem Nutzer!"
                }
            case "inappropriate":
                return {
                    toolCallId,
                    output: "Weise den Nutzer darauf hin, dass die Frage unangemessen ist. Du beantwortest ihm gerne Fragen zu den Wahlprogrammen der Parteien zur Bundestagswahl 2025."
                }
        }
    }

    async detailedInstructions(
        toolCallId: string,
        prompt: string,
        parties: Party[],
        followUpQuestions: string[] | undefined,
        instruct: string
    ): Promise<ToolFunctionResult> {
        // No parties specified at all or too many parties specified
        if (parties.length === 0 || parties.length > maxNumberParties) {
            this.updateResult(_ => ({command: "partySelector"}))
            return {
                toolCallId,
                output: `Bitte den Nutzer, maximal ${maxNumberParties} Parteien auszuwählen, für die er eine Antwort wünscht. Liste die Parteien *nicht* auf!`,
                events: [{event: "command", data: "selectParties"}],
            }
        }

        // All requested parties are supported
        const partyAssistants = await Promise.all(parties.map(async party =>
            createPartyAssistantRun(this.aiClient, partyProps[party].assistantId, prompt)
        ))
        console.log("created party assistants")
        return {
            toolCallId,
            output: `${instruct}`,
            events: followUpQuestions ? followUpQuestions.map(data => ({event: "followUpQuestion", data})) : undefined,
            delegateAssistants: partyAssistants
        }
    }
}

async function createMetaAssistantRun(
    aiClient: AIClient,
    threadId: string | undefined,
    message: string,
) {
    return await createRun({
        aiClient,
        assistantId: metaAssistantId,
        threadId,
        message,
    }, (aiClient, threadId, stream, model) => new MetaAssistantRun(aiClient, threadId, stream, model))
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
    mixpanel.track("Question Processed", {
        ...result,
        ...getMixpanelEvent(request)
    })
}

export async function createOrPostToThread(aiClient: AIClient, message: string, request: HttpRequest) {
    const threadId = request.params.threadId
    return runAssistant(aiClient, threadId, message, request)
}