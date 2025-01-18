import {diClient} from "../common/di-client"
import {parties as partyList, Party, partyProps} from "./parties"
import path from "node:path"
import * as fs from "node:fs"
import {AnalyzeResultOutput, getLongRunningPoller, isUnexpected} from "@azure-rest/ai-document-intelligence"

export async function convertToMarkdown(party: Party) {
    const inputFilePath = path.join(__dirname, "../../../assets/manifesto/pdf/shortened", `${party}.pdf`)
    const inputFileStream = fs.readFileSync(inputFilePath, {encoding: "base64"})
    const initialResponse = await diClient
        .path("/documentModels/{modelId}:analyze", "prebuilt-layout")
        .post({
            queryParameters: {
                locale: "de",
                outputContentFormat: "markdown",
            },
            contentType: "application/json",
            body: {
                base64Source: inputFileStream,
            }
        })
    console.log(`Converted ${party} manifesto to markdown with status ${initialResponse.status}`)
    if (isUnexpected(initialResponse)) {
        throw initialResponse.body.error
    }
    const poller = getLongRunningPoller(diClient, initialResponse)
    const response = (await poller.pollUntilDone()).body as {analyzeResult: AnalyzeResultOutput}
    const result = response.analyzeResult

    const outputFilePath = path.join(__dirname, "../../../assets/manifesto/markdown/extracted", `${party}.md`)
    fs.writeFileSync(outputFilePath, result.content, {encoding: "utf-8"})
    return response
}

export function prepareMarkdown(party: Party | "all") {
    if (party === "all") {
        for (const party of partyList) {
            prepareMarkdown(party)
        }
    } else {
        const inputFilePath = path.join(__dirname, "../../../assets/manifesto/markdown/extracted", `${party}.md`)
        const md = fs.readFileSync(inputFilePath, {encoding: "utf-8"})
        const lines = md.split("\n").map(line => line.trim())
        const firstPageNumber = partyProps[party].firstPageNumber ?? getLogicalFirstPageNumber(lines)

        const outputFilePath = path.join(__dirname, "../../../assets/manifesto/markdown/prepared", `${party}.md`)
        const outputStream = fs.createWriteStream(outputFilePath, {encoding: "utf-8"})
        try {
            _prepareMarkdown(lines, firstPageNumber, outputStream)
        } finally {
            outputStream.close()
        }
    }
}

function getLogicalFirstPageNumber(lines: string[]): number {
    const pageNumberLineIndex = lines.findIndex(line => line.startsWith("<!-- PageNumber="))
    if (pageNumberLineIndex === -1) {
        return 1
    }
    const firstPageNumber = parseInt(lines[pageNumberLineIndex].match(/<!-- PageNumber="[^\d]*(\d+)[^\d]*" -->/)![1])

    const linesBeforePageNumber = lines.slice(0, pageNumberLineIndex)
    const pageBreaksBefore = linesBeforePageNumber.filter(line => line === "<!-- PageBreak -->").length
    return firstPageNumber - pageBreaksBefore
}

function _prepareMarkdown(lines: string[], firstPageNumber: number, out: fs.WriteStream) {
    const sectionPattern = /^#+ (.+)/
    const lineNumberPattern = /^[0-9]+$/
    const minCharsBeforeNextRef = 400

    let currentPage = firstPageNumber
    let currentSection = ""
    let lastLineWasSection = false
    let lastLineWasListItem = false
    let lastLineWasEmpty = false
    let charsSinceLastRef = 0

    const writeln = (line: string = "") => {
        out.write(line + "\n")
        charsSinceLastRef += line.length + 1
    }

    for (const line of lines) {
        if (line.startsWith("#")) {
            currentSection = line.match(sectionPattern)![1]
            writeln(line)
            lastLineWasSection = true
            lastLineWasEmpty = false
        } else if (line.startsWith("<!-- PageBreak -->")) {
            currentPage++
        } else if ((line.startsWith("- ") || line.startsWith("· ") || line.startsWith("V ")) && lastLineWasEmpty) {
            writeln(line)
            lastLineWasListItem = true
            lastLineWasEmpty = false
        } else if (line === "") {
            if (!lastLineWasSection && !lastLineWasListItem && !lastLineWasEmpty && charsSinceLastRef >= minCharsBeforeNextRef) {
                writeln(`[Seite ${currentPage}; Abschnitt: ${currentSection}]`)
                charsSinceLastRef = 0
            }
            writeln()
            lastLineWasSection = false
            lastLineWasListItem = false
            lastLineWasEmpty = true
        } else if (line.startsWith("<!-- ")) {
            // ignore comments generated from azure document intelligence
        } else if (line.match(lineNumberPattern)) {
            // ignore line number
        } else {
            writeln(line)
            lastLineWasSection = false
            lastLineWasListItem = false
            lastLineWasEmpty = false
        }
    }
}