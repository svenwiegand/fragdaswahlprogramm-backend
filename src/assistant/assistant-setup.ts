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

export async function replaceVectorStoreFiles(vectorStoreId: string, filePath: string) {
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
    await aiClient.beta.vectorStores.files.createAndPoll(
        vectorStoreId, {
            file_id: newFile.id,
            chunking_strategy: {
                type: "static",
                static: {
                    max_chunk_size_tokens: 400,
                    chunk_overlap_tokens: 200,
                },
            },
        }
    )
    console.log(`${name}: Attached file to store ${vectorStoreId}`)

    console.log(`${name}: Deleting previous files`)
    for await (const file of prevFiles.data) {
        console.log(`${name}: Detaching file ${file.id}`)
        await aiClient.beta.vectorStores.files.del(vectorStoreId, file.id)
        console.log(`${name}: Deleted file ${file.id}`)
        await aiClient.files.del(file.id)
    }
}
