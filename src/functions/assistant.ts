import {app, HttpResponseInit} from "@azure/functions"
import {updateMetaAssistant, updatePartyAssistants} from "../common/assistants"

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

app.http('assistant', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    handler: updateAssistants,
})