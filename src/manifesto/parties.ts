export const maxNumberParties = 3
export type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "spd"
export type PartyProps = {
    name: string
    symbol: string
    assistantId: string
}

export const party: Record<Party, PartyProps> = {
    afd: {name: "AfD", symbol: "afd", assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ"},
    "cdu-csu": {name: "CDU/CSU", symbol: "cdu-csu", assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao"},
    fdp: {name: "FDP", symbol: "fdp", assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH"},
    gruene: {name: "Bündnis 90/Die Grünen", symbol: "gruene", assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2"},
    spd: {name: "SPD", symbol: "spd", assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ"},
}
export const parties = Object.keys(party) as Party[]
