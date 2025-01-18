import {app, HttpRequest, HttpResponseInit} from "@azure/functions"
import {updateMetaAssistant, updatePartyAssistants, updateVectorStore} from "../manifesto/assistant-setup"
import {devMode} from "../common/mode"
import {Party} from "../manifesto/parties"
import {convertToMarkdown, prepareMarkdown} from "../manifesto/extract-manifesto"

async function updateAssistants(): Promise<HttpResponseInit> {
    try {
        await updateMetaAssistant()
        await updatePartyAssistants()
        return {status: 200}
    } catch (e) {
        console.error(e)
        return {status: 500, body: e.toString()}
    }
}

async function updateVectorStores(request: HttpRequest): Promise<HttpResponseInit> {
    try {
        const party = request.params.party as (Party | "all")
        await updateVectorStore(party)
        return {status: 200}
    } catch (e) {
        console.error(e)
        return {status: 500, body: e.toString()}
    }
}

async function extractManifesto(request: HttpRequest): Promise<HttpResponseInit> {
    try {
        const party = request.params.party as Party
        const result = await convertToMarkdown(party)
        return {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(result),
        }
    } catch (e) {
        console.error(e)
        return {status: 500, body: e.toString()}
    }
}

async function prepareManifesto(request: HttpRequest): Promise<HttpResponseInit> {
    try {
        const party = request.params.party as Party
        await prepareMarkdown(party)
        return {status: 200}
    } catch (e) {
        console.error(e)
        return {status: 500, body: e.toString()}
    }
}

if (devMode) {
    app.http('assistant', {
        methods: ['PATCH'],
        authLevel: 'anonymous',
        handler: updateAssistants,
    })
    app.http('vectorStore', {
        route: 'vectorstore/{party}',
        methods: ["PATCH"],
        authLevel: 'anonymous',
        handler: updateVectorStores,
    })
    app.http('extractManifesto', {
        route: 'manifesto/{party}',
        methods: ["PUT"],
        authLevel: 'anonymous',
        handler: extractManifesto,
    })
    app.http('prepareManifesto', {
        route: 'manifesto/{party}',
        methods: ["PATCH"],
        authLevel: 'anonymous',
        handler: prepareManifesto,
    })
}