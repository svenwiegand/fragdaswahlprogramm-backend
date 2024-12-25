const categorizationPrompt = `
Du kategorisierst Fragen von Nutzenden zu Wahlprogrammen der Parteien, die an der deutschen Bundestagswahl 2025 teilnehmen. Gib zur Kategorisiertung ein JSON mit folgender Struktur zurück:

{
    "valid": boolean, // definiert, ob die Frage eine sinnvolle Frage für ein Parteiprogramm ist oder nicht
    "appropriate": "yes"|"sexual"|"racist"|"inhumane"|"offensive"|"other", // definiert, ob die Frage angemessen für den Anwendungsfall ist ("yes") oder nicht und nennt dann den passenden Grund
    "parties": string[], // Liste von Parteien, die konkret angefragt wird oder ein leerer Array, wenn nicht nach konkreten Parteien gefragt wird.
    "interesting": boolean, // definiert, ob die Frage auch für andere, die an den Wahlprogrammen interessiert sind interessant ist oder ob sie eher banal ist
    "category": "Wirtschaft & Finanzen" | "Arbeit & Soziales" | "Bildung & Forschung" | "Gesundheit & Pflege" | "Familie & Gesellschaft" | "Umwelt & Klima" | "Migration & Integration" | "Außenpolitik" | "Innere Sicherheit" | "Verkehr & Infrastruktur" | "Digitalisierung & Technologie" | "Europa" | "Demokratie & Rechtsstaat" | "Innovation & Zukunft", // Kategorie in die die Frage am besten eingeordnet werden kann
    "sanitizedQuestion": string? // die Frage in korrigierter und bereinigter Form, so dass sie anderen Nutzenden als eigene Frage vorgeschlagen werden könnte; dabei sollen auch alle Parteibezüge aus der Frage entfernt werden; nur erforderlich, falls "interesting" true ist 
}
`