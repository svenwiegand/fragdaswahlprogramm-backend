import {
    AssistantModel,
    AssistantRun,
    AssistantRunResult,
    RunStream,
    createRun,
    initialAssistantRunResult,
} from "../assistant/assistant-run"
import {AIClient} from "../common/ai-client"

type Result = AssistantRunResult

class PartyAssistantRun extends AssistantRun<Result>
{
    constructor(name: string | undefined, aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) {
        super(name, aiClient, threadId, stream, model, initialAssistantRunResult)
    }

}

export async function createPartyAssistantRun(
    name: string,
    aiClient: AIClient,
    assistantId: string,
    message: string,
    searchResults: "many" | "medium" | "few"
) {
    return await createRun({
        name,
        aiClient,
        assistantId,
        threadId: undefined,
        message,
        createParams: {tools: [{
            type: "file_search",
            file_search: {
                max_num_results: searchResults === "many" ? 16 : searchResults === "medium" ? 10 : 6,
            }
        }]}
    }, (name, aiClient, threadId, stream, model) => new PartyAssistantRun(name, aiClient, threadId, stream, model))

}