import {app, FunctionResult, HttpRequest, InvocationContext} from "@azure/functions"
import {streamingAiFunction} from "../common/ai-function"
import {CORS_HEADERS, createThread, postToThread} from '../common/manifesto'
import {HttpResponse, HttpResponseInit} from "@azure/functions/types/http"

const createThreadFunction = streamingAiFunction(createThread)
const postToThreadFunction = streamingAiFunction(postToThread)

function options(request: HttpRequest, context: InvocationContext): FunctionResult<HttpResponseInit | HttpResponse> {
    return {
        headers: CORS_HEADERS,
        status: 200
    }
}

app.setup({enableHttpStream: true})
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
    handler: options,
})
app.http("postThreadOptions", {
    methods: ["OPTIONS"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: options,
})