import {aiClient} from "../common/ai-client"
import {Message} from "openai/resources/beta/threads/messages"
import {NotFoundError} from "openai"

type ThreadMessage = {
    id: string
    type: "question" | "answer"
    content: string
}

export type MessageResult = {
    status: "success" | "notFound" | "failed"
    messages?: ThreadMessage[]
    hasMore?: boolean
}

const terminalStates = ["expired", "completed", "failed", "incomplete", "cancelled"]
const successStates = ["completed", "incomplete"]

export async function getRunOutputMessage(threadId: string, runId: string): Promise<MessageResult> {
    console.log(`Getting message for run ${runId} in thread ${threadId}`)
    try {
        while (true) {
            const run = await aiClient.beta.threads.runs.poll(threadId, runId)
            console.log(`Run status for ${runId} in thread ${threadId}: ${run.status}`)
            if (terminalStates.includes(run.status)) {
                if (successStates.includes(run.status)) {
                    break
                } else {
                    return {status: "failed",}
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
        const messagesPage = await aiClient.beta.threads.messages.list(threadId, {run_id: runId})
        const messages = transformMessages(messagesPage.data)
        return {status: "success", messages}
    } catch (e) {
        if (e instanceof NotFoundError) {
            return {status: "notFound"}
        } else {
            console.error(`Failed to get message for run ${runId} in thread ${threadId}`, e)
            return {status: "failed"}
        }
    }
}

export async function getThreadMessages(threadId: string, after: string | undefined): Promise<MessageResult> {
    console.log(`Getting messages for thread ${threadId} after ${after}`)
    try {
        const messagesPage = await aiClient.beta.threads.messages.list(threadId, {order: "asc", after})
        const messages = transformMessages(messagesPage.data)
        console.log(`Got ${messages.length} messages`, messagesPage.nextPageInfo())
        const hasMore = messagesPage.hasNextPage()
        return {status: "success", messages, hasMore}
    } catch (e) {
        if (e instanceof NotFoundError) {
            return {status: "notFound"}
        } else {
            console.error(`Failed to get messages for thread ${threadId}`, e)
            return {status: "failed"}
        }
    }
}

function transformMessages(msgs: Message[]): ThreadMessage[] {
    return msgs.map(msg => ({
        id: msg.id,
        type: msg.role === "user" ? "question" : "answer",
        content: getMessageContent(msg),
    }))
}

function getMessageContent(msg: Message): string {
    return msg.content.map(c => c.type === "text" ? c.text.value : undefined).filter(c => !!c).join("")
}