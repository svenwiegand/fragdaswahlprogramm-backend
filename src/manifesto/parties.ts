export const maxNumberParties = 3
export type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "linke" | "spd"
export type PartyProps = {
    name: string
    symbol: string
    assistantId: string
    manifestoTitle: string
}

export const partyProps: Record<Party, PartyProps> = {
    afd: {
        name: "AfD",
        symbol: "afd",
        assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ",
        manifestoTitle: "Wahlprogramm der AfD",
    },
    "cdu-csu": {
        name: "CDU/CSU",
        symbol: "cdu-csu",
        assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao",
        manifestoTitle: "Wahlprogramm von CDU/CSU",
    },
    fdp: {
        name: "FDP",
        symbol: "fdp",
        assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH",
        manifestoTitle: "Wahlprogramm der FDP",
    },
    gruene: {
        name: "Bündnis 90/Die Grünen",
        symbol: "gruene",
        assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2",
        manifestoTitle: "Wahlprogramm von Bündnis 90/Die Grünen",
    },
    linke: {
        name: "Die Linke",
        symbol: "linke",
        assistantId: "asst_pq68oRnhqemxQcB5gUD11U9o",
        manifestoTitle: "Wahlprogramm der Linken",
    },
    spd: {
        name: "SPD",
        symbol: "spd",
        assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ",
        manifestoTitle: "Wahlprogramm der SPD",
    },
}
export const parties = Object.keys(partyProps) as Party[]
