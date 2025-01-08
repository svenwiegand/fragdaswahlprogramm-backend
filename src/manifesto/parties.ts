export const maxNumberParties = 3
export type Party = "afd" | "cdu-csu" | "fdp" | "gruene" | "linke" | "spd"
export type PartyProps = {
    name: string
    symbol: string
    assistantId: string
    vectorStoreId: string
    manifestoTitle: string
}

export const partyProps: Record<Party, PartyProps> = {
    afd: {
        name: "AfD",
        symbol: "afd",
        assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ",
        vectorStoreId: "vs_ccEyROZ9C4Eyox116juedNF3",
        manifestoTitle: "Wahlprogramm der AfD",
    },
    "cdu-csu": {
        name: "CDU/CSU",
        symbol: "cdu-csu",
        assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao",
        vectorStoreId: "vs_ktZ8mEal6VjZCHPhhbtdAr2R",
        manifestoTitle: "Wahlprogramm von CDU/CSU",
    },
    fdp: {
        name: "FDP",
        symbol: "fdp",
        assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH",
        vectorStoreId: "vs_6fSiSCdOgFCZo4fzbLxdMbsb",
        manifestoTitle: "Wahlprogramm der FDP",
    },
    gruene: {
        name: "Bündnis 90/Die Grünen",
        symbol: "gruene",
        assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2",
        vectorStoreId: "vs_N00nbVnGW4ZG6ztuQeHQn49A",
        manifestoTitle: "Wahlprogramm von Bündnis 90/Die Grünen",
    },
    linke: {
        name: "Die Linke",
        symbol: "linke",
        assistantId: "asst_pq68oRnhqemxQcB5gUD11U9o",
        vectorStoreId: "vs_oIGlEvu7NGw494QscVG3hMO1",
        manifestoTitle: "Wahlprogramm der Linken",
    },
    spd: {
        name: "SPD",
        symbol: "spd",
        assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ",
        vectorStoreId: "vs_DiSj2XvQu4dT63uYgRfIXKBX",
        manifestoTitle: "Wahlprogramm der SPD",
    },
}
export const parties = Object.keys(partyProps) as Party[]
