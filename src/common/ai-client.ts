import {AzureOpenAI} from "openai"

export const environmentRegion = process.env.AZURE_OPENAI_REGION
console.log(`Using region ${environmentRegion}`)

const regionUpperCase = environmentRegion.toUpperCase()
const regionEnv = (name: string): string => {
    const envName = `${name}_${regionUpperCase}`
    const result = process.env[envName]
    if (!result) {
        console.error(`Missing environment variable ${envName}`)
        throw new Error(`Missing environment variable ${envName}`)
    }
    return result
}

export type AIClient = AzureOpenAI
export const aiStandardModelClient = new AzureOpenAI({
    endpoint: regionEnv("AZURE_OPENAI_ENDPOINT"),
    apiKey: regionEnv("AZURE_OPENAI_API_KEY"),
    apiVersion: process.env.MESSAGE_AZURE_OPENAI_API_VERSION,
    deployment: "gpt-4o",
})
export const aiMiniModelClient = new AzureOpenAI({
    endpoint: regionEnv("AZURE_OPENAI_ENDPOINT"),
    apiKey: regionEnv("AZURE_OPENAI_API_KEY"),
    apiVersion: process.env.MESSAGE_AZURE_OPENAI_API_VERSION,
    deployment: "gpt-4o-mini",
})
export const aiClient = aiStandardModelClient

