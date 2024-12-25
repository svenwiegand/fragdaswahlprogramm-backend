import {AzureOpenAI} from "openai"

export type AIClient = AzureOpenAI
export const aiClient = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.MESSAGE_AZURE_OPENAI_API_VERSION,
    deployment: process.env.MESSAGE_AZURE_OPENAI_DEPLOYMENT,
})