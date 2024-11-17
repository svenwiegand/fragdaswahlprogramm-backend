import {app, HttpRequest, HttpResponseInit, InvocationContext} from "@azure/functions"

export async function hello(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`)

    const name = request.query.get('name') || await request.text() || 'world'
    const ipAddress = request.headers.get('x-forwarded-for') || 'not available';

    return {body: `Hello, ${name}!\n\nYour IP is ${ipAddress}`}
}

app.http('hello', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: hello,
})
