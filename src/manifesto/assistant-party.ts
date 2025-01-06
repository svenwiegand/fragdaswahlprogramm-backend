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
    message: string
) {
    return await createRun({
        name,
        aiClient,
        assistantId,
        threadId: undefined,
        message,
    }, (name, aiClient, threadId, stream, model) => new PartyAssistantRun(name, aiClient, threadId, stream, model))

}