import {aiClient} from "../common/ai-client"
import OpenAI from "openai"
import FunctionDefinition = OpenAI.FunctionDefinition

export async function updateAssistantInstructions(assistantId: string, instructions: string) {
    await aiClient.beta.assistants.update(assistantId, {instructions: instructions.trim()})
}

export async function updateAssistantFunctionDefinition(assistantId: string, func: FunctionDefinition) {
    await aiClient.beta.assistants.update(assistantId, {
        tools: [{
            type: "function",
            function: func,
        }],
    })
}