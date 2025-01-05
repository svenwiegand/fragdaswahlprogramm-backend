import {app, HttpRequest, HttpResponseInit} from "@azure/functions"
import {streamingAiFunction} from "../common/ai-function"
import {createThread, postToThread} from '../common/manifesto'
import {corsHeaders, corsOptionsHandler} from "../common/cors"
import {aiClient} from "../common/ai-client"

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

const createThreadFunction = streamingAiFunction(createThread)
const postToThreadFunction = streamingAiFunction(postToThread)

app.setup({enableHttpStream: true})
app.http("getThread", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: getThread,
})

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