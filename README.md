# Splisto

Scrivi l'annuncio una volta. Splisto lo compila su **Vinted, eBay, Subito, Facebook Marketplace e Wallapop**.
Il pulsante **Pubblica** sul sito lo premi sempre tu.

## Installa (2 minuti)

1. Scarica `splisto.zip` dall'[ultima release](https://github.com/Fr3nK027/Splisto/releases/latest).
2. Estrailo in una cartella fissa (non spostarla più).
3. Apri `chrome://extensions` (Edge: `edge://extensions`) e attiva **Modalità sviluppatore**.
4. Clicca **Carica estensione non pacchettizzata** e scegli quella cartella.
5. Clicca l'icona di Splisto: si apre la dashboard.

## Aggiorna

Quando in dashboard compare **Aggiorna a x.y.z**, cliccalo. La prima volta scegli la cartella del punto 2.

## Usa

1. **Nuovo annuncio**: foto (massimo 10, la prima è la copertina), titolo, prezzo, dettagli. Si salva da solo.
2. Scegli i siti e premi **Pubblica ovunque**: si apre una scheda per sito, già compilata.
3. Controlla ogni scheda e premi **Pubblica** sul sito. Splisto salva il link da solo.
4. Venduto? **Segna come venduto…** apre gli altri siti per togliere l'annuncio.

## Altre funzioni

- **Importa annunci**: porta in Splisto quelli messi dal telefono, con foto e statistiche.
- **Pubblica e aggiorna**: sui siti riscrive solo i campi che hai cambiato.
- **Statistiche**: visualizzazioni e like per sito.
- **Modifica multipla**: prezzo, titolo e descrizione di più annunci insieme.
- **AI (facoltativa)**: titoli, descrizioni, controllo foto. Attivala in Impostazioni → Intelligenza artificiale
  (Gemini e Groq gratis, Ollama gratis e senza internet).

## Se qualcosa non va

| Vedi | Fai |
| --- | --- |
| *Accesso richiesto* o *Disconnesso* | Accedi al sito nella scheda aperta: riparte da solo. |
| *Da completare* | Pannello **Stato** → **Insegna** → clicca il campo sul sito. |
| eBay si ferma alla prima pagina | Scegli tu categoria e condizione: poi riparte. Serve l'accesso a ebay.it. |
| Subito senza Comune | Inseriscilo a mano. |
| Wallapop chiede "Continua" | Premilo tu: poi il modulo si compila. |

## Privacy

- Annunci e foto restano sul tuo PC.
- Splisto lavora solo quando premi un pulsante: mentre navighi non gira nulla.
- Si collega solo ai 5 siti, a GitHub (per gli aggiornamenti) e, se la usi, all'AI che scegli.

## Sviluppo

```powershell
npm install
npm run build   # crea dist/
npm run check   # TypeScript + test
npm run e2e     # prova vera in Edge
```

Nuova versione: alza `version` in `manifest.json` e `package.json`, poi push su `main`. La release la crea la CI.
Tutto il resto (selettori, sicurezza, siti verificati, struttura): [DETTAGLI.md](DETTAGLI.md).
