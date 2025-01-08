import {aiClient} from "../common/ai-client"
import OpenAI from "openai"
import FunctionDefinition = OpenAI.FunctionDefinition
import * as fs from "node:fs"
import * as path from "node:path"

export async function updateAssistantInstructions(assistantId: string, instructions: string) {
    await aiClient.beta.assistants.update(assistantId, {instructions: instructions.trim()})
}

export async function updateAssistantFunctionDefinition(assistantId: string, funcs: FunctionDefinition[]) {
    await aiClient.beta.assistants.update(assistantId, {
        tools: funcs.map(f => ({type: "function", function: f})),
    })
}

export async function replaceVectorStoreFiles(vectorStoreId: string, filePath: string, maxChunkSizeTokens: number = 800, chunkOverlapTokens: number = 400) {
    const name = path.basename(filePath).split(".")[0]
    const prevFiles = await aiClient.beta.vectorStores.files.list(vectorStoreId)

    console.log(`${name}: Uploading file ${filePath}`)
    const fileStream = fs.createReadStream(filePath)
    const newFile = await aiClient.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants",
    })
    console.log(`${name}: Successfully uploaded file with id ${newFile.id}`)
    fileStream.close()

    console.log(`${name}: Attaching file with id ${newFile.id} to store ${vectorStoreId}`)
    const result = await aiClient.beta.vectorStores.files.createAndPoll(
        vectorStoreId, {
            file_id: newFile.id,
            chunking_strategy: {
                type: "static",
                static: {
                    max_chunk_size_tokens: maxChunkSizeTokens,
                    chunk_overlap_tokens: chunkOverlapTokens,
                },
            },
        }
    )
    console.log(`${name}: Attached file to store ${vectorStoreId} with result ${result.status}`)
    if (result.status === "failed") {
        console.error(`${name}: Failed to attach file to store ${vectorStoreId} with ${result.last_error.code}: ${result.last_error.message}`)
        await aiClient.files.del(newFile.id)
        console.log(`${name}: Deleted new file ${newFile.id}`)
        return
    }

    console.log(`${name}: Deleting previous files`)
    for await (const file of prevFiles.data) {
        console.log(`${name}: Detaching file ${file.id}`)
        await aiClient.beta.vectorStores.files.del(vectorStoreId, file.id)
        console.log(`${name}: Deleted file ${file.id}`)
        await aiClient.files.del(file.id)
    }
}
