import DocumentIntelligence from "@azure-rest/ai-document-intelligence"
import {AzureKeyCredential} from "@azure/core-auth"

const endpoint = "https://wahlprogramm-di.cognitiveservices.azure.com/"
const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

export const diClient = DocumentIntelligence(endpoint, new AzureKeyCredential(key))
