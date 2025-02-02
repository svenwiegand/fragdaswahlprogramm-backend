# fragdaswahlprogramm – Backend
Das ist das Backend zu [fragdaswahlprogramm](https://fragdaswahlprogramm.de) – einer KI-basierten Web-Site, die es Bürgern ermöglicht Fragen an die Programme der Parteien zur Bundestagswahl 2025 zu stellen. Das zugehörige Frontend findest Du [hier](https://github.com/svenwiegand/fragdaswahlprogramm-frontend).

## Disclaimer
Ich hatte schon länger geplant, dieses Projekt für die Bundestagswahl 2025 umzusetzen. Allerdings dachte ich, dass ich dafür bis September 2025 Zeit hätte. Kurz nach dem die Ampel-Regierung am 6. November 2024 dann aufgelöst wurde, habe ich mich an die Implementierung gemacht. Wirklich Zeit hatte ich dann erst in den Weihnachtsferien. 

Da es sich hier um ein Freizeitprojekt handelt, hatte ich somit nur wenige Personentage zur Verfügung, um die Website rechtzeitig vor der vorgezogenen Bundestagswahl verfügbar zu machen. Dementsprechend gibt es diverse Kompromisse, die ich in einem normalen Projekt nicht eingehen würde:

- Keinerlei automatische Tests
- Diverse Setup-Schritte müssen manuell durchgeführt werden
- Auch das Hinzufügen weiterer Wahlprogramme erfolgt zu großen Teilen händisch

## Überblick
- Das Backend ist als Azure Function App implementiert. 
- Als KI-Dienst kommen die Azure OpenAI-Services zum Einsatz.
- Als RAG-Lösung werden die noch als experimentell bezeichneten (Januar 2025) Assistenten mit zugehörigen Vector-Stores verwendet. Leider haben wir dort im Vergleich zu externen Vector-Stores nur eingeschränkte Einflussnahme auf den Ingestion-Prozess, aber dafür war eine schnelle Implementierung möglich. 
- Es findet eine Vorverarbeitung der Wahlprogramme statt, um bestmögliche Ergebnisse im Nachgang zu erzielen. Dafür werden die PDFs mit Azure Document Intelligence in Markdown konvertiert und dann im Nachgang diese Markdowns weiter angereichert.
- Zur Beantwortung einer Nutzerfrage werden mehrere LLM-Anfragen durchgeführt:
  1. Der Meta-Assistant nimmt die Anfrage entgegen, kategorisiert sie und leitet diverse Informationen an eine registrierte Tool-Function weiter.
  2. Die Tool-Function kümmert sich dann darum, dass je angefragter Partei ein eigener Assistent aufgerufen wird, der über einen eigenen Vector-Store verfügt, der ausschließlich die Chunks des betreffenden Wahlprogramms enthält. Damit wird sichergestellt, dass die Positionen verschiedener Parteien sauber auseinander gehalten und Treffer aller Parteien berücksichtigt werden. 
  3. Jeder Partei-Assistant erstellt eine Zusammenfassung der gefundenen Positionen der Partei.
  4. Die Ausgaben der Partei-Assistenten werden an den Meta-Assistant zur Beantwortung der ursprünglichen Frage zurückgegeben.
  5. Als letzter Schritt wird die finale Antwort an ein LLM übergeben, um entsprechende Folgefragen zu generieren, die dem Nutzer zusätzlich angezeigt werden.

  Die Prompts der Assistenten findest Du unter [`src/manifesto/assistant-setup.ts`](src/manifesto/assistant-setup.ts).
- Aus Kostengründen werden fast alle oben beschriebenen Schritte mit GPT-4o-mini durchgeführt. Lediglich die Generierung der Folgefragen erfolgt mit GPT-4o, da hier deutlich bessere Ergebnisse erzielt werden.

## Umgebungsvariablen
Die folgenden Umgebungsvariablen müssen für Test und Betrieb gesetzt sein.

Hier Beispielhaft eine `local.settings.json` für das Entwicklungssystem:

```
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "",
    "AZURE_OPENAI_REGION": "swedencentral" | "eastus" | …,
    "AZURE_OPENAI_API_KEY_<REGION>": <key>,
    "AZURE_OPENAI_ENDPOINT_<REGION>": "https://wahlprogramm.openai.azure.com/",
    "MESSAGE_AZURE_OPENAI_API_VERSION": "2024-08-01-preview",
    "MIXPANEL_PROJECT_TOKEN": <token>,
    "AZURE_DOCUMENT_INTELLIGENCE_KEY": <key>
  }
}
```

## Weitere Dokumentation
- [Hinzufügen einer neuen Partei](docs/add-party.md)