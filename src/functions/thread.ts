import {app} from "@azure/functions"
import {streamingAiFunction} from "../common/ai-function"
import {createThread, postToThread} from '../common/manifesto'

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