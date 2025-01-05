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
    constructor(aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) {
        super(aiClient, threadId, stream, model, initialAssistantRunResult)
    }

}

export async function createPartyAssistantRun(
    aiClient: AIClient,
    assistantId: string,
    message: string
) {
    return await createRun({
        aiClient,
        assistantId,
        threadId: undefined,
        message,
    }, (aiClient, threadId, stream, model) => new PartyAssistantRun(aiClient, threadId, stream, model))

}