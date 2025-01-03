import {app, HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"
import {mixpanel} from "../common/mixpanel"

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`)

    const name = request.query.get('name') || await request.text() || 'world'
    const ipAddress = request.headers.get('x-forwarded-for') || request.query.get("ip") || 'not available';
    mixpanel.track("Hello", {
        distinct_id: name,
        ip: ipAddress,
    })

    return {body: `Hello, ${name}!\n\nYour IP is ${ipAddress}`}
}

app.http('hello', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: hello,
})
