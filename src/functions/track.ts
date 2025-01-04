import {app, HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import {getMixpanelEvent, mixpanel} from "../common/mixpanel"
import {corsHeaders, corsOptionsHandler} from "../common/cors"

async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`)

    const name = request.query.get('name') || await request.text() || 'world'
    const ipAddress = request.headers.get('x-forwarded-for') || request.query.get("ip") || 'not available';
    mixpanel.track("Hello", {
        distinct_id: name,
        ip: ipAddress,
    })

    return {body: `Hello, ${name}!\n\nYour IP is ${ipAddress}`}
}

function trackHandler(eventName: string) {
    return async function (request: HttpRequest): Promise<HttpResponseInit> {
        const eventData = await request.json() as Object
        mixpanel.track(eventName, {
            ...getMixpanelEvent(request),
            ...eventData
        })
        return {
            headers: corsHeaders,
            status: 200
        }
    }
}

app.http("helloOptions", {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: "hello",
    handler: corsOptionsHandler,
})
app.http('hello', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "hello",
    handler: hello,
})
app.http('trackHello', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: "hello",
    handler: trackHandler("App Started"),
})

app.http("trackOptions", {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: "page",
    handler: corsOptionsHandler,
})
app.http('trackPage', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: "page",
    handler: trackHandler("Page Viewed"),
})
