import {AIClient} from "../common/ai-client"
import {AssistantStreamEvent, AssistantToolChoice} from "openai/resources/beta"
import {SSEStream} from "../common/ai-function"
import {RunSubmitToolOutputsParams} from "openai/resources/beta/threads"

export type AssistantModel = "mini" | "standard"

export type RunStream = AsyncIterable<AssistantStreamEvent>

export type RunCreateParams<Result extends AssistantRunResult = AssistantRunResult> = {
    aiClient: AIClient
    assistantId: string
    threadId?: string
    message: string
    toolChoice?: AssistantToolChoice
}

export type SSEEvent = {
    event: string
    data: string
}
export type ToolFunctionResult = {
    /** The id provided to the function call */
    toolCallId: string

    /** The output of the tool function which is used as the input for the message generation */
    output: string

    /** A list of SSE events to be sent immediately */
    events?: SSEEvent[]

    /**
     * An optional list of assistant runs.
     * The output of these runs will be piped appended to the output of the original run in the order they are provided.
     * Further on these things will happen:
     *
     * - output will be added to this assistants context as an assistant message.
     * - the results will be merged into this assistants results.
     *
     * If used, output should specify instructions for the assistant not to generate any further output.
     * */
    delegateAssistants?: AssistantRun[]
}
export type ToolFunction = <Arguments = unknown>(toolCallId: string, args: Arguments) => Promise<ToolFunctionResult>

export type AssistantRunResult = {
    threadId: string
    inputTokensStandard: number
    outputTokensStandard: number
    inputTokensMini: number
    outputTokensMini: number
    result?: "success" | "failure"
    duration?: number
    errorCode?: string
    errorMessage?: string
}
export const initialAssistantRunResult: AssistantRunResult = {
    threadId: "",
    inputTokensStandard: 0,
    outputTokensStandard: 0,
    inputTokensMini: 0,
    outputTokensMini: 0,
}

type RunCompletedListener = (result: AssistantRunResult, content?: string) => Promise<void>|void

export class AssistantRun<Result extends AssistantRunResult = AssistantRunResult> {
    readonly aiClient: AIClient
    readonly threadId: string
    readonly rootStream: RunStream
    readonly model: AssistantModel
    protected readonly encoder = new TextEncoder()
    private content = ""
    private runResult: Result
    private resultListeners: RunCompletedListener[] = []

    protected readonly toolFunctions: Record<string, ToolFunction> = {}

    constructor(aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel, initialResult: Result) {
        this.aiClient = aiClient
        this.threadId = threadId
        this.rootStream = stream
        this.model = model
        this.runResult = {...initialResult, threadId}
    }

    addCompletedListener(listener: RunCompletedListener): void {
        this.resultListeners.push(listener)
    }

    private async onCompleted() {
        await Promise.all(this.resultListeners.map(listener => listener(this.runResult, this.content)))
    }

    protected updateResult(updater: (result: Result) => Partial<Result>): void {
        this.runResult = {...this.runResult, ...updater(this.runResult)}
    }

    private onFinalEvent(event: AssistantStreamEvent.ThreadRunCompleted | AssistantStreamEvent.ThreadRunFailed): void {
        const safeDuration = (start: number | null, end: number | null): number | undefined => start && end ? end - start : undefined
        this.updateResult(_ => ({
            inputTokensStandard: this.model === "standard" ? event.data.usage.prompt_tokens : 0,
            outputTokensStandard: this.model === "standard" ? event.data.usage.completion_tokens : 0,
            inputTokensMini: this.model === "mini" ? event.data.usage.prompt_tokens : 0,
            outputTokensMini: this.model === "mini" ? event.data.usage.completion_tokens : 0,
            result: event.event === "thread.run.completed" ? "success" : "failure",
            duration: safeDuration(event.data.created_at, event.data.completed_at ?? event.data.failed_at ?? event.data.cancelled_at),
            errorCode: event.data.last_error?.code,
            errorMessage: event.data.last_error?.message,
        } as Partial<Result>))
    }

    getContent(): string {
        return this.content
    }

    getResult(): Result {
        return this.runResult
    }

    async* output(): SSEStream {
        yield* this.processStream(this.rootStream, true)
    }

    protected async* processStream(stream: RunStream, rootCall: boolean = false): SSEStream {
        for await (const event of stream) {
            if (event.event === "thread.run.requires_action") {
                const result = await this.processFunctionCalls(event)
                console.log("sending function provided events")
                for await (const event of result.events) {
                    yield* this.sendEvent(event.event, event.data)
                }
                console.log("processing stream")
                yield* this.processStream(result.stream)
                console.log("processing delegate assistants")
                yield* this.processDelegateAssistants(result.delegateAssistants)
            } else if (event.event === "thread.message.delta") {
                yield* this.processMessageDelta(event)
            } else if (event.event === "thread.run.completed") {
                this.onFinalEvent(event)
            } else if (event.event === "thread.run.failed") {
                this.onFinalEvent(event)
            }
        }
        if (rootCall) {
            await this.onCompleted()
        }
    }

    private async processFunctionCalls(
        event: AssistantStreamEvent.ThreadRunRequiresAction,
    ): Promise<{ stream: RunStream, events: SSEEvent[], delegateAssistants: AssistantRun[] }> {
        console.log(`Event: ${event.event} (${event.data.required_action.submit_tool_outputs.tool_calls.length} tool calls)`)
        const resultPromises = event.data.required_action.submit_tool_outputs.tool_calls.map(async (toolCall): Promise<ToolFunctionResult> => {
            const func = this.toolFunctions[toolCall.function.name]
            if (func) {
                console.log(`Calling tool function ${toolCall.function.name} with arguments:\n${toolCall.function.arguments}`)
                const args = JSON.parse(toolCall.function.arguments)
                return func(toolCall.id, args)
            } else {
                console.error(`Unknown tool function: ${toolCall.function.name}`)
                return {toolCallId: toolCall.id, output: ""}
            }
        })

        const results = await Promise.all(resultPromises)
        const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = results.map(result => ({
            tool_call_id: result.toolCallId,
            output: result.output,
        }))
        const stream = this.aiClient.beta.threads.runs.submitToolOutputsStream(
            event.data.thread_id,
            event.data.id,
            {
                tool_outputs: toolOutputs,
            },
        )
        const events = results.filter(result => !!result.events).flatMap(result => result.events)
        const delegateAssistants = results.filter(result => !!result.delegateAssistants).flatMap(result => result.delegateAssistants)
        console.log(`functions submitted with ${events.length} events and ${delegateAssistants.length} delegate assistants`)
        return {stream, events, delegateAssistants}
    }

    private async* processDelegateAssistants(assistants: AssistantRun[]): SSEStream {
        const onDelegateCompleted = async <DelegateResult extends Result>(r: DelegateResult, content: string) => {
            const {
                threadId,
                inputTokensStandard,
                outputTokensStandard,
                inputTokensMini,
                outputTokensMini,
                result,
                duration,
                errorCode,
                errorMessage,
                ...remaining
            } = r
            this.updateResult(prev => ({
                inputTokensMini: prev.inputTokensMini + inputTokensMini,
                inputTokensStandard: prev.inputTokensStandard + inputTokensStandard,
                outputTokensMini: prev.outputTokensMini + outputTokensMini,
                outputTokensStandard: prev.outputTokensStandard + outputTokensStandard,
                result: prev.result === "failure" || result === "failure" ? "failure" : "success",
                errorCode: prev.errorCode || errorCode,
                errorMessage: prev.errorMessage || errorMessage,
                ...remaining,
            } as unknown as Partial<Result>))
            console.log(`Delegate completed with ${result}`)
            if (result === "failure") {
                console.error(`Delegate failed with error: ${errorCode}: ${errorMessage}`)
            }
            await this.aiClient.beta.threads.messages.create(this.threadId, {role: "assistant", content})
        }
        for await (const assistant of assistants) {
            yield* this.sendEvent("message", "\n\n")
            assistant.addCompletedListener(onDelegateCompleted)
            yield* assistant.output()
        }
    }

    protected async* processMessageDelta(event: AssistantStreamEvent.ThreadMessageDelta): SSEStream {
        for (const delta of event.data.delta.content) {
            if (delta.type === "text") {
                this.content += delta.text.value
                yield* this.sendEvent("message", delta.text.value)
            }
        }
    }

    protected async* sendEvent(eventType: string, data: string): SSEStream {
        yield this.encoder.encode(`event: ${eventType}\n`)
        const lines = data.split("\n")
        for (const line of lines) {
            yield this.encoder.encode(`data: ${line}\n`)
        }
        yield this.encoder.encode("\n")
    }
}

export async function createRun(
    {aiClient, ...params}: RunCreateParams,
    newInstance: (aiClient: AIClient, threadId: string, stream: RunStream, model: AssistantModel) => AssistantRun =
        (aiClient, threadId, stream, model) => new AssistantRun<AssistantRunResult>(aiClient, threadId, stream, model, initialAssistantRunResult),
): Promise<AssistantRun> {
    const assistant = await aiClient.beta.assistants.retrieve(params.assistantId)
    console.log(`assistant model: ${assistant.model}`)
    const model = assistant.model.includes("mini") ? "mini" : "standard"
    const tid = params.threadId || (await aiClient.beta.threads.create({})).id
    if (!params.threadId) {
        console.log(`created new thread ${tid}`)
    }
    await aiClient.beta.threads.messages.create(tid, {role: "user", content: params.message})
    const stream = await aiClient.beta.threads.runs.create(tid, {
        assistant_id: params.assistantId,
        tool_choice: params.toolChoice,
        stream: true,
    })
    console.log(`created run for thread ${tid}`)
    return newInstance(aiClient, tid, stream, model)
}
