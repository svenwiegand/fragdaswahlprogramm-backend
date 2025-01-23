# fragdaswahlprogramm Backend
Backend für [fragdaswahlprogramm](https://fragdaswahlprogramm.de) – eine Plattform zur Förderung politischer Bildung und Transparenz.

## Hinzufügen einer neuen Partei
1. Partei unter `src/manifesto/parties.ts` hinzufügen, zunächst mit Dummy-Werten für `assistantId` und `vectorStoreId`
2. Wahlprogramm herunterladen und unter `assets/manifesto/pdf/original/` ablegen.
3. Bereinigtes Wahlprogramm (ohne Titelseite, Inhaltsverzeichnis, unnötige Einleitung, Schlusseiten) unter `assets/manifesto/pdf/shortened/` mit dem Namen `<symbol>.pdf` ablegen
4. Markdown-Datei generieren: `PUT http://localhost:7071/api/manifesto/<symbol>`
5. Assistent `wahlprogramm-<symbol>` in [Azure KI Foundry](https://ai.azure.com/resource/vectorstore) anlegen, die ID in `parties.ts` hinterlegen und folgende Einstellungen vornehmen:
   - Bereitstellung `gpt-4o-mini`
   - Oben angelegten Vector-Store als Dateisuche hinzufügen
   - Temperatur auf 0,01 setzen
6. Vom Assistenten aus den Vector-Store `wahlprogramm-<symbol>` **ohne** Datei anlegen und die ID in `parties.ts` hinterlegen.
7. Update Vector-Store-Request durchführen: `PATCH http://localhost:7071/api/vectorstore/<symbol>`
8. Anpassungen im Frontend vornehmen und Frontend deployen
9. Backend deployen
10. Assistenten aktualisieren: `PATCH http://localhost:7071/api/assistant`

## Aktualisieren eines Wahlprogramms
1. Wahlprogramm herunterladen und bereinigen, also Titelseite, Inhaltsverzeichnis und ggf. unnötige Einleitung entfernen
2. Bereinigtes Wahlprogramm unter `assets/wahlprogramme-optimized` mit dem Namen `<symbol>.pdf` ablegen
3. Update Vector-Store-Request durchführen: `PATCH http://localhost:7071/api/vectorstore/<symbol>`
7. Anpassungen im Frontend vornehmen und Frontend deployen
8. Backend kann, muss aber nicht deployt werden