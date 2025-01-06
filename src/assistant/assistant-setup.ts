import {aiClient} from "../common/ai-client"
import OpenAI from "openai"
import FunctionDefinition = OpenAI.FunctionDefinition

export async function updateAssistantInstructions(assistantId: string, instructions: string) {
    await aiClient.beta.assistants.update(assistantId, {instructions: instructions.trim()})
}

export async function updateAssistantFunctionDefinition(assistantId: string, funcs: FunctionDefinition[]) {
    await aiClient.beta.assistants.update(assistantId, {
        tools: funcs.map(f => ({type: "function", function: f})),
    })
}