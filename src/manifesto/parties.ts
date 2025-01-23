export type Party = "afd" | "gruene" | "bsw" | "cdu-csu" | "fdp" | "linke" | "spd" |
    "buendnis-deutschland" | "diebasis" | "ssw" | "volt"
export type PartyProps = {
    name: string
    symbol: string
    manifestoTitle: string
    /**
     * The logical number of the first page in the shortened PDF.
     *
     * Can be used, to override the automatic page number detection in the preparation of the markdown.
     */
    firstPageNumber?: number
    region: {
        swedencentral: Region
        eastus: Region
    }
}
type Region = {
    assistantId: string
    vectorStoreId: string
}

export const partyProps: Record<Party, PartyProps> = {
    afd: {
        name: "AfD",
        symbol: "afd",
        manifestoTitle: "Wahlprogramm der AfD",
        region: {
            swedencentral: {
                assistantId: "asst_xnOWBOCCWFcBU9kUD1bBS9UZ",
                vectorStoreId: "vs_CkIvKAfeDduUnnx3R9rFvIGp",
            },
            eastus: {
                assistantId: "asst_Y50VIgfMdOe3NNZbsGYikO4A",
                vectorStoreId: "vs_xgpmGiMbUQHWhZYMizlTLB4f",
            },
        },
    },
    gruene: {
        name: "Bündnis 90/Die Grünen",
        symbol: "gruene",
        manifestoTitle: "Wahlprogramm von Bündnis 90/Die Grünen",
        region: {
            swedencentral: {
                assistantId: "asst_XseCMF4gCT42Jh23lXuAtZR2",
                vectorStoreId: "vs_6RtHRnzJjkdeSKj7knPAghow",
            },
            eastus: {
                assistantId: "asst_LbRHSGCHuPbTnalFApzRTBMm",
                vectorStoreId: "vs_80FWzufpW3Smerv0pxhtT9nn",
            },
        },
    },
    bsw: {
        name: "Bündnis Sarah Wagenknecht",
        symbol: "bsw",
        manifestoTitle: "Wahlprogramm vom Bündnis Sarah Wagenknecht",
        region: {
            swedencentral: {
                assistantId: "asst_BT72iX055pJMXCpKOmQcUbbU",
                vectorStoreId: "vs_TknJsa9eGXmYjOFrXQ8WNJah",
            },
            eastus: {
                assistantId: "asst_WICiQECl5VmFtohFZOMjzhqa",
                vectorStoreId: "vs_e2rtLeyZ1QZB0FB1jTyitVu5",
            },
        },
    },
    "cdu-csu": {
        name: "CDU/CSU",
        symbol: "cdu-csu",
        manifestoTitle: "Wahlprogramm von CDU/CSU",
        region: {
            swedencentral: {
                assistantId: "asst_QISOObUD8u5Dfi4X3HkLb3Ao",
                vectorStoreId: "vs_kBg1ogAxRGn2fYUQdV9d97ae",
            },
            eastus: {
                assistantId: "asst_rupfiWLSA5M98C8LY8rpeAnf",
                vectorStoreId: "vs_1SfJi2VVGbZ5iBX54dbgKXYW",
            },
        },
    },
    fdp: {
        name: "FDP",
        symbol: "fdp",
        manifestoTitle: "Wahlprogramm der FDP",
        region: {
            swedencentral: {
                assistantId: "asst_nWq7S82vXT6oKgih5oKiLbBH",
                vectorStoreId: "vs_TeHCYgLDXkqaWElyc12vHvTd",
            },
            eastus: {
                assistantId: "asst_XiJAeaKpO9szafp0JIAOgfGP",
                vectorStoreId: "vs_QWsbDu1fiHo58Z8dmyq4mVJz",
            },
        },
    },
    linke: {
        name: "Die Linke",
        symbol: "linke",
        manifestoTitle: "Wahlprogramm der Linken",
        firstPageNumber: 1,
        region: {
            swedencentral: {
                assistantId: "asst_pq68oRnhqemxQcB5gUD11U9o",
                vectorStoreId: "vs_V6QVRcqhtXlLtOwgqhW2eGSC",
            },
            eastus: {
                assistantId: "asst_WaYnfW9RZsUmB9BV4w9Zw1BI",
                vectorStoreId: "vs_IpMzJp78XduPiJSkmsvMatXC",
            },
        },
    },
    spd: {
        name: "SPD",
        symbol: "spd",
        manifestoTitle: "Wahlprogramm der SPD",
        region: {
            swedencentral: {
                assistantId: "asst_c6v5qJauvXN21tOr76J2r1FZ",
                vectorStoreId: "vs_H1TxWSYaKIf90mexIyoYlKp2",
            },
            eastus: {
                assistantId: "asst_8MNBjRJsuvJ9sauqrAXDFtLP",
                vectorStoreId: "vs_HS99hjmm0cg4MI5RzdyYhmnY",
            },
        },
    },


    "buendnis-deutschland": {
        name: "Bündnis Deutschland",
        symbol: "buendnis-deutschland",
        manifestoTitle: "Wahlprogramm vom Bündnis Deutschland",
        region: {
            swedencentral: {
                assistantId: "asst_OpGpYniM3lnAtsFoDCmci7GY",
                vectorStoreId: "vs_VSAWDCwrGGnal3ef7rwapVPm",
            },
            eastus: {
                assistantId: "",
                vectorStoreId: "",
            },
        },
    },
    "diebasis": {
        name: "Basisdemokratische Partei Deutschland",
        symbol: "diebasis",
        manifestoTitle: "Wahlprogramm von dieBasis",
        region: {
            swedencentral: {
                assistantId: "asst_Ouw95A58TZIxCdnWAkxW8ire",
                vectorStoreId: "vs_Vo6wtwnEcBjyxwMIBM87BV6N",
            },
            eastus: {
                assistantId: "",
                vectorStoreId: "",
            },
        },
    },
    ssw: {
        name: "Südschleswigscher Wählerverband",
        symbol: "ssw",
        manifestoTitle: "Wahlprogramm vom SSW",
        region: {
            swedencentral: {
                assistantId: "asst_PcjId80lFme8GAv9R9yX0sva",
                vectorStoreId: "vs_RNFlelOSWmPIoI7UtxrIm5uz",
            },
            eastus: {
                assistantId: "",
                vectorStoreId: "",
            },
        },
    },
    volt: {
        name: "Volt",
        symbol: "volt",
        manifestoTitle: "Wahlprogramm von Volt",
        region: {
            swedencentral: {
                assistantId: "asst_XH4lI5pWkxqmwZfUMKTkFpnX",
                vectorStoreId: "vs_Db1LmfpxRgiDByuRHAhlkxww",
            },
            eastus: {
                assistantId: "asst_WNVeHbSwZrm3uoPDlu6c7tO5",
                vectorStoreId: "vs_NbhXNeR2DiHYHCzkEngHnywS",
            },
        },
    },
}
export const parties = Object.keys(partyProps) as Party[]
