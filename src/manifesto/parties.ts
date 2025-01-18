export const maxNumberParties = 3
export type Party = "afd" | "gruene" | "bsw" | "cdu-csu" | "fdp" | "linke" | "spd" | "volt"
export type PartyProps = {
    name: string
    symbol: string
    assistantId: string
    vectorStoreId: string
    manifestoTitle: string
    /**
     * The logical number of the first page in the shortened PDF.
     *
     * Can be used, to override the automatic page number detection in the preparation of the markdown.
     */
    firstPageNumber?: number
}

export const partyProps: Record<Party, PartyProps> = {
    afd: {
        name: "AfD",
        symbol: "afd",
        //assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ",
        assistantId: "asst_iAAWkMaSq94FCXE48gybF2Pr",
        //vectorStoreId: "vs_ccEyROZ9C4Eyox116juedNF3",
        vectorStoreId: "vs_lixvIanBBrgQ7Fcma69rpvQ1",
        manifestoTitle: "Wahlprogramm der AfD",
    },
    gruene: {
        name: "Bündnis 90/Die Grünen",
        symbol: "gruene",
        //assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2",
        assistantId: "asst_SCCrd8h6Rva9AZyAOitecOro",
        //vectorStoreId: "vs_N00nbVnGW4ZG6ztuQeHQn49A",
        vectorStoreId: "vs_PFaZgVoEb04NWRr67CAmbORl",
        manifestoTitle: "Wahlprogramm von Bündnis 90/Die Grünen",
    },
    bsw: {
        name: "Bündnis Sarah Wagenknecht",
        symbol: "bsw",
        //assistantId: "asst_BT72iX055pJMXCpKOmQcUbbU",
        assistantId: "asst_GNrWQjvWZfeHPGpGFBO868Sr",
        //vectorStoreId: "vs_aJMcPkgZIeLm69Urai933RUN",
        vectorStoreId: "vs_ndlso2ozITHzFpZZoBFuta8F",
        manifestoTitle: "Wahlprogramm vom Bündnis Sarah Wagenknecht",
    },
    "cdu-csu": {
        name: "CDU/CSU",
        symbol: "cdu-csu",
        //assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao",
        assistantId: "asst_QTe8fZmHThPNRbGaQrSTePVQ",
        //vectorStoreId: "vs_ktZ8mEal6VjZCHPhhbtdAr2R",
        vectorStoreId: "vs_QIiDBYHQqf8uJXyqvFnP0GK3",
        manifestoTitle: "Wahlprogramm von CDU/CSU",
    },
    fdp: {
        name: "FDP",
        symbol: "fdp",
        //assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH",
        assistantId: "asst_TaznFzi8kFdIoKgEAcfJvm7q",
        //vectorStoreId: "vs_6fSiSCdOgFCZo4fzbLxdMbsb",
        vectorStoreId: "vs_AWMp4t9p9vyZajjc6LyUiePG",
        manifestoTitle: "Wahlprogramm der FDP",
    },
    linke: {
        name: "Die Linke",
        symbol: "linke",
        //assistantId: "asst_pq68oRnhqemxQcB5gUD11U9o",
        assistantId: "asst_xX55S67k68DYVhkvOIEmMM2d",
        //vectorStoreId: "vs_oIGlEvu7NGw494QscVG3hMO1",
        vectorStoreId: "vs_zTd059x7vZJJwBIrj6IyqF8j",
        manifestoTitle: "Wahlprogramm der Linken",
        firstPageNumber: 1,
    },
    spd: {
        name: "SPD",
        symbol: "spd",
        //assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ",
        assistantId: "asst_ekvpCfXiNxKnyYt0JAsBUb1Y",
        //vectorStoreId: "vs_DiSj2XvQu4dT63uYgRfIXKBX",
        vectorStoreId: "vs_myYtbgjMt27UyTbSF6VN8VRy",
        manifestoTitle: "Wahlprogramm der SPD",
    },
    volt: {
        name: "Volt",
        symbol: "volt",
        //assistantId: "asst_XH4lI5pWkxqmwZfUMKTkFpnX",
        assistantId: "asst_PUUb6fG6qYwioAcFHncoNZJp",
        //vectorStoreId: "vs_PuarirgyN7NT3kdeeSwoet9S",
        vectorStoreId: "vs_Z5JvTuERjKGJauLkahYvzlEa",
        manifestoTitle: "Wahlprogramm von Volt",
    }
}
export const parties = Object.keys(partyProps) as Party[]
