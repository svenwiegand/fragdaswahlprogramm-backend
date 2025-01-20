import {app, HttpRequest, HttpResponseInit} from "@azure/functions"
import {streamingAiFunction} from "../common/ai-function"
import {corsHeaders, corsOptionsHandler} from "../common/cors"
import {aiClient} from "../common/ai-client"
import {createOrPostToThread} from "../manifesto/assistant-meta"
import {devMode} from "../common/mode"
import {getRunOutputMessage, getThreadMessages as listThreadMessages, MessageResult} from "../manifesto/messages"

async function getThread(request: HttpRequest): Promise<HttpResponseInit> {
    const threadId = request.params.threadId
    const messages = await aiClient.beta.threads.messages.list(threadId)
    return {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
        },
        body: JSON.stringify(messages.data),
    }
}

const createThreadFunction = streamingAiFunction(createOrPostToThread)
const postToThreadFunction = streamingAiFunction(createOrPostToThread)

const getThreadMessages = async (request: HttpRequest): Promise<HttpResponseInit> => {
    const threadId = request.params.threadId
    const runId = request.query.get("runId")
    const after = request.query.get("after")
    const getMessages: () => Promise<MessageResult> = runId
        ? () => getRunOutputMessage(threadId, runId)
        : () => listThreadMessages(threadId, after)
    const result = await getMessages()
    return {
        status: result.status === "success" ? 200 : result.status === "notFound" ? 404 : 500,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
        },
        body: JSON.stringify({messages: result.messages, hasMore: result.hasMore}),
    }
}

app.setup({enableHttpStream: true})

if (devMode) {
    app.http("getThread", {
        methods: ["GET"],
        authLevel: "anonymous",
        route: "thread/{threadId}",
        handler: getThread,
    })
}

app.http("createThread", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "thread",
    handler: createThreadFunction,
})
app.http("postToThread", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: postToThreadFunction,
})
app.http("getThreadMessages", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "thread/{threadId}/message",
    handler: getThreadMessages,
})
app.http("createThreadOptions", {
    methods: ["OPTIONS"],
    authLevel: "anonymous",
    route: "thread",
    handler: corsOptionsHandler,
})
app.http("postThreadOptions", {
    methods: ["OPTIONS"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: corsOptionsHandler,
})
app.http("getThreadMessagesOptions", {
    methods: ["OPTIONS"],
    authLevel: "anonymous",
    route: "thread/{threadId}/message",
    handler: corsOptionsHandler,
})