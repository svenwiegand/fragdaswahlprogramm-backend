export const maxNumberParties = 4
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
        assistantId: "asst_Y50VIgfMdOe3NNZbsGYikO4A",
        //vectorStoreId: "vs_ccEyROZ9C4Eyox116juedNF3",
        vectorStoreId: "vs_xgpmGiMbUQHWhZYMizlTLB4f",
        manifestoTitle: "Wahlprogramm der AfD",
    },
    gruene: {
        name: "Bündnis 90/Die Grünen",
        symbol: "gruene",
        //assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2",
        assistantId: "asst_LbRHSGCHuPbTnalFApzRTBMm",
        //vectorStoreId: "vs_N00nbVnGW4ZG6ztuQeHQn49A",
        vectorStoreId: "vs_80FWzufpW3Smerv0pxhtT9nn",
        manifestoTitle: "Wahlprogramm von Bündnis 90/Die Grünen",
    },
    bsw: {
        name: "Bündnis Sarah Wagenknecht",
        symbol: "bsw",
        //assistantId: "asst_BT72iX055pJMXCpKOmQcUbbU",
        assistantId: "asst_WICiQECl5VmFtohFZOMjzhqa",
        //vectorStoreId: "vs_aJMcPkgZIeLm69Urai933RUN",
        vectorStoreId: "vs_e2rtLeyZ1QZB0FB1jTyitVu5",
        manifestoTitle: "Wahlprogramm vom Bündnis Sarah Wagenknecht",
    },
    "cdu-csu": {
        name: "CDU/CSU",
        symbol: "cdu-csu",
        //assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao",
        assistantId: "asst_rupfiWLSA5M98C8LY8rpeAnf",
        //vectorStoreId: "vs_ktZ8mEal6VjZCHPhhbtdAr2R",
        vectorStoreId: "vs_1SfJi2VVGbZ5iBX54dbgKXYW",
        manifestoTitle: "Wahlprogramm von CDU/CSU",
    },
    fdp: {
        name: "FDP",
        symbol: "fdp",
        //assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH",
        assistantId: "asst_XiJAeaKpO9szafp0JIAOgfGP",
        //vectorStoreId: "vs_6fSiSCdOgFCZo4fzbLxdMbsb",
        vectorStoreId: "vs_QWsbDu1fiHo58Z8dmyq4mVJz",
        manifestoTitle: "Wahlprogramm der FDP",
    },
    linke: {
        name: "Die Linke",
        symbol: "linke",
        //assistantId: "asst_pq68oRnhqemxQcB5gUD11U9o",
        assistantId: "asst_WaYnfW9RZsUmB9BV4w9Zw1BI",
        //vectorStoreId: "vs_oIGlEvu7NGw494QscVG3hMO1",
        vectorStoreId: "vs_IpMzJp78XduPiJSkmsvMatXC",
        manifestoTitle: "Wahlprogramm der Linken",
        firstPageNumber: 1,
    },
    spd: {
        name: "SPD",
        symbol: "spd",
        //assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ",
        assistantId: "asst_8MNBjRJsuvJ9sauqrAXDFtLP",
        //vectorStoreId: "vs_DiSj2XvQu4dT63uYgRfIXKBX",
        vectorStoreId: "vs_HS99hjmm0cg4MI5RzdyYhmnY",
        manifestoTitle: "Wahlprogramm der SPD",
    },
    volt: {
        name: "Volt",
        symbol: "volt",
        //assistantId: "asst_XH4lI5pWkxqmwZfUMKTkFpnX",
        assistantId: "asst_WNVeHbSwZrm3uoPDlu6c7tO5",
        //vectorStoreId: "vs_PuarirgyN7NT3kdeeSwoet9S",
        vectorStoreId: "vs_NbhXNeR2DiHYHCzkEngHnywS",
        manifestoTitle: "Wahlprogramm von Volt",
    }
}
export const parties = Object.keys(partyProps) as Party[]
