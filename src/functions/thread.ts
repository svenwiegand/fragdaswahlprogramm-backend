import {app, FunctionResult, HttpRequest, InvocationContext} from "@azure/functions"
import {streamingAiFunction} from "../common/ai-function"
import {createThread, postToThread} from '../common/manifesto'
import {corsOptionsHandler} from "../common/cors"

const createThreadFunction = streamingAiFunction(createThread)
const postToThreadFunction = streamingAiFunction(postToThread)

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
    handler: corsOptionsHandler,
})
app.http("postThreadOptions", {
    methods: ["OPTIONS"],
    authLevel: "anonymous",
    route: "thread/{threadId}",
    handler: corsOptionsHandler,
})