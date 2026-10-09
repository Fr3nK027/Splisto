# Splisto

Repository: <https://github.com/Fr3nK027/Splisto>

Estensione per Chrome ed Edge (Manifest V3) per scrivere un annuncio una volta sola e compilarlo su
**Vinted, eBay, Subito, Facebook Marketplace e Wallapop**. L'estensione apre una scheda per sito, compila il modulo
e carica le foto. **Il pulsante finale "Pubblica" lo premi sempre tu**: l'estensione non lo clicca mai
(c'è anche un blocco esplicito nel codice, vedi `PUBLISH_WORDS` in `src/content/text.ts`).

Tutto resta sul tuo PC: annunci e foto in IndexedDB, impostazioni in `chrome.storage.local`.
Le uniche connessioni esterne sono i siti delle piattaforme e, solo se usi le funzioni ✨, il servizio AI che
scegli nelle Impostazioni (Claude per impostazione predefinita; con Ollama nemmeno quello: resta tutto sul PC).

## Build

Serve Node.js 20.19 o più recente.

```powershell
npm install
npm run build      # controllo TypeScript + build in dist/
npm run check      # controllo TypeScript + test delle funzioni di confronto testo
```

## Caricare l'estensione

**Chrome**
1. Apri `chrome://extensions`.
2. Attiva **Modalità sviluppatore** (in alto a destra).
3. Clicca **Carica estensione non pacchettizzata** e scegli la cartella `dist`.

**Edge**
1. Apri `edge://extensions`.
2. Attiva **Modalità sviluppatore** (in basso a sinistra).
3. Clicca **Carica decompressa** e scegli la cartella `dist`.

Clicca l'icona dell'estensione (fissala nella barra con la puntina) per aprire la dashboard.
Dopo `npm run build` l'estensione si accorge da sola della nuova versione (confronta il manifest in memoria con
quello su disco) e si ricarica all'apertura della dashboard o al riavvio del service worker. I file della build
hanno nomi fissi (`vite.config.ts`), così anche prima della ricarica le schede aperte dall'estensione trovano il
loro codice. Le pagine dei siti già aperte vanno ricaricate a mano.

## Servizio AI (per le funzioni ✨)

Le funzioni ✨ (titolo, descrizione, descrizione dalle foto, controllo foto, titoli per sito) funzionano con il
servizio che scegli in **Impostazioni → Intelligenza artificiale**. Senza servizio tutto il resto funziona lo stesso.

| Servizio | Costo | Chiave |
| --- | --- | --- |
| Claude (Anthropic) | credito API a pagamento (l'abbonamento Pro non vale per l'API) | <https://console.anthropic.com> → API Keys |
| Google Gemini | piano gratuito, foto incluse | <https://aistudio.google.com/apikey> |
| OpenAI | credito API a pagamento (l'abbonamento ChatGPT non vale per l'API) | <https://platform.openai.com/api-keys> |
| OpenRouter | molti modelli, alcuni gratuiti (`…:free`) | <https://openrouter.ai/keys> |
| Groq | piano gratuito | <https://console.groq.com/keys> |
| Mistral | piano gratuito di prova | <https://console.mistral.ai/api-keys> |
| Ollama | gratis, sul tuo PC, nessun dato esce | nessuna (indirizzo `http://localhost:11434/v1`) |
| Altro | qualsiasi API compatibile OpenAI (`/chat/completions`) | quella del servizio |

1. Scegli il servizio, incolla la chiave (e se vuoi cambia il modello: il campo mostra quello predefinito).
2. Premi **Salva e prova**. Per i servizi diversi da Claude il browser chiede il permesso di contattare
   quell'indirizzo (`optional_host_permissions`): concedilo.

Claude usa l'API Anthropic; gli altri l'API compatibile OpenAI (`src/lib/providers.ts`, `src/lib/ai.ts`). Lì lo
schema JSON dei "titoli per sito" è chiesto nel testo e la risposta viene letta anche se arriva dentro un blocco ```.

Ogni chiave è salvata solo in questo browser, in un database separato dell'estensione (`src/lib/secret.ts`)
che gli script sulle pagine dei siti non possono leggere. Non è nel codice e non finisce nel backup. Un backup
importato può scegliere il servizio e il modello, mai l'indirizzo: non può dirottare la tua chiave altrove.

## Sicurezza

- Il pulsante finale di pubblicazione non viene mai premuto. Il blocco guarda il testo visibile, `aria-label`,
  `title` e `value`, anche delle `<label>` collegate. Un campo "insegnato" non può essere quel pulsante. Mentre
  l'estensione compila, l'invio dei moduli è bloccato.
- Si aprono solo pagine `https` dei cinque siti (`SITE_URL`). Le foto si scaricano solo dai loro server di
  immagini (`PHOTO_URL`), in `src/content/text.ts`.
- I comandi (pubblica, importa, verifica) li accetta solo dalla dashboard. Dalle schede accetta solo messaggi
  dal sito che dichiarano: una pagina di Facebook non può mandare dati "di eBay".
- Una pagina aperta a mano può solo aggiornare annunci che esistono già, mai crearli. Sulla pagina "i miei annunci"
  di Vinted l'id del profilo deve essere il tuo.
- I backup importati vengono controllati campo per campo. Restano solo impostazioni note e valori validi, e i
  link che non sono dei siti vengono scartati.
- Le descrizioni importate arrivano all'AI come dati delimitati, non come istruzioni. Con Claude il modello è
  `claude-sonnet-5-5`, con effort basso per avere risposte in pochi secondi, e il fallback lato server
  (`fallbacks: "default"`): se il modello rifiuta per errore una richiesta, l'API la riprova su un altro modello.
- Gli altri servizi AI si contattano solo dopo il permesso del browser per quell'indirizzo; si accettano solo
  indirizzi `https` (o `http` sul PC, per Ollama).

## Uso

1. **Nuovo annuncio**: aggiungi fino a 10 foto (trascina per riordinare: la prima è la copertina),
   titolo, descrizione, prezzo, condizione, categoria, marca, taglia, colore, peso e dimensioni.
   Le modifiche si salvano da sole.
2. Facoltativo, in **Campi per piattaforma**:
   - **titolo e prezzo per sito**. Sotto il prezzo vedi quanto incassi davvero ("Incassi circa"),
     calcolato con le commissioni impostate in Impostazioni;
   - **categoria per sito**: "Donna > Vestiti" vuol dire clicca "Donna", poi "Vestiti". Un nome solo
     (es. "Jeans skinny") viene cercato nel campo di ricerca del menu, dove c'è (Vinted);
   - **✨ Titoli per sito**: l'AI scrive un titolo per ogni sito, ciascuno entro il suo limite.
3. **✨ Controlla foto**: consigli su copertina, luce, sfondo, foto mancanti e difetti da dichiarare.
   **Venduti su eBay ↗** apre la ricerca degli oggetti simili già venduti, per scegliere il prezzo.
4. Scegli le piattaforme e premi **Pubblica ovunque**. Di default l'estensione compila **un sito alla
   volta, in primo piano** (più affidabile). Puoi cambiare questa scelta in Impostazioni.
5. Pannello **Stato**: per ogni sito vedi *Compilato*, *Da completare* (con l'elenco dei campi),
   *Accesso richiesto* o *Errore*.
   - **Insegna**: se un campo non viene trovato, clicca il suo nome e poi clicca il campo sul sito.
     L'estensione ricorda il selettore e ricompila. Puoi azzerare i campi insegnati in Impostazioni.
6. Controlla ogni scheda e premi tu "Pubblica" sul sito. Quando il sito apre la pagina dell'annuncio,
   l'estensione **salva il link da sola** e segna *Pubblicato*. Se non succede, usa
   **Segna come pubblicato** e incolla il link.
7. **Segna come venduto…**: scegli dove l'hai venduto. L'estensione apre gli annunci sugli altri siti,
   così li elimini subito e non vendi due volte lo stesso oggetto. Poi premi **Segna rimosso**.

Note per sito:
- **eBay**: l'accesso di ebay.com (dove vedi i tuoi annunci) e quello di ebay.it sono separati. L'importazione
  usa ebay.com; per pubblicare su eBay Italia serve l'accesso anche su ebay.it, ed è quello che mostra il
  controllo accessi.
- **eBay**: la prima pagina chiede "cosa vuoi vendere". L'estensione scrive il titolo e si ferma. Tu scegli
  categoria e condizione e prosegui. Quando arrivi al modulo completo, la compilazione riparte da sola.
- **Subito**: l'estensione va direttamente al modulo della sottocategoria (tabella in `selectors/subito.ts`).
  Il Comune va inserito a mano, se il profilo non lo propone già.
- **Accesso richiesto**: accedi al sito in quella scheda. Dopo il login la compilazione riparte da sola.

## Controllo accessi

Nella home, ogni sito mostra **Connesso**, **Disconnesso**, **Non verificabile** o **Da verificare**, con l'ora
dell'ultimo controllo. **Verifica accessi** apre per pochi secondi, in background, la pagina "nuovo annuncio" di
ogni sito: se compare il menu utente sei connesso, se compare il login no. Il controllo parte anche da solo
(di default ogni 6 ore, si cambia in Impostazioni) e lo stato si aggiorna anche mentre navighi sui siti.

Se un sito ti disconnette: notifica di Windows (cliccala per aprire il sito), banner rosso in home e numero
rosso sull'icona dell'estensione. I selettori usati sono in `loggedIn` / `loggedOut` nel file del sito.
"Non verificabile" = la pagina non ha mostrato né il menu utente né il login entro 15 secondi (sito lento,
captcha, pagina cambiata).

Dopo una nuova build, se Chrome ha ancora il service worker vecchio, **Verifica accessi** ricarica
l'estensione da sola, riapre la dashboard e fa partire il controllo.

## Importazione degli annunci già online

Se metti un annuncio dal telefono (o direttamente sul sito), l'estensione lo importa da sola:
**Importa annunci** nella home apre in background la pagina con i tuoi annunci di ogni sito e li legge.
Lo fa anche in automatico subito dopo il controllo accessi periodico, e ogni volta che apri a mano quella pagina.

Per ogni annuncio trovato:
1. se è già in Splisto (stesso link o id sul sito), aggiorna stato e statistiche;
2. se lo stesso oggetto è già presente da un altro sito (titolo quasi uguale e prezzo entro il 25%),
   lo collega: un solo annuncio con più siti;
3. altrimenti lo crea, con la foto di copertina, e poi apre la pagina dell'annuncio per leggere
   descrizione, tutte le foto (fino a 10), marca e condizione.

Nuovi annunci importati = notifica di Windows. In lista: "Importato da …" e "Solo su …: pubblicalo anche
altrove" per gli annunci online su un solo sito.

| Sito | Pagina letta | Stato |
| --- | --- | --- |
| Vinted | il tuo profilo (`/member/<id>`, trovato dal menu utente) | verificato 10/2026: titolo, prezzo, visualizzazioni, preferiti, marca, condizione, taglia, foto, descrizione |
| Subito | `areariservata.subito.it/annunci` | verificato: titolo, prezzo, visite, foto, descrizione, condizione; preferiti dalla pagina "Statistiche" |
| Facebook | `marketplace/you/selling` | verificato: titolo, prezzo, clic, foto, descrizione, condizione, marca |
| eBay | `ebay.com/mys/active` (My eBay su ebay.com) | verificato 10/2026: titolo, prezzo, visualizzazioni, osservatori, foto; descrizione da `itm.ebaydesc.com` |
| Wallapop | `app/catalog/published` | verificato 10/2026 (titolo, prezzo, foto; descrizione, visite e preferiti dalla pagina dell'annuncio) |

Le foto vengono scaricate dai server delle immagini dei siti (permessi in `manifest.json`) e ridimensionate
come quelle caricate a mano.

## Pubblicare e aggiornare insieme

Con **Pubblica e aggiorna** (nell'editor, o nella barra di modifica multipla) l'estensione fa due cose:
- dove l'annuncio non c'è, compila il modulo nuovo;
- dove è già online, apre la pagina **Modifica** del sito e riscrive solo i campi diversi da Splisto
  (titolo, descrizione, prezzo, condizione). Un campo già uguale non si tocca, così la formattazione del sito
  (es. la descrizione eBay con emoji e grassetti) resta. Foto e categoria restano quelle del sito.

Il pulsante finale lo premi sempre tu: "Pubblica", "Salva" (Vinted), "Aggiorna" (Facebook), "Pubblica annuncio"
(Subito).

**Da aggiornare:** l'importazione salva il prezzo e il titolo che ci sono sul sito. Se in Splisto li cambi (anche
con la modifica multipla), l'annuncio mostra "Da aggiornare: Vinted (prezzo)" con il pulsante **Aggiorna sui siti**.
L'avviso sparisce quando salvi sul sito, oppure alla prossima importazione se i valori combaciano. Nel pannello Stato vedi l'esito dell'aggiornamento; per un sito solo usa "Aggiorna sul sito".

| Sito | Pagina di modifica | Stato |
| --- | --- | --- |
| Vinted | `/items/<id>/edit` | verificata 10/2026 (stessi campi del modulo nuovo) |
| Subito | `inserimento.subito.it/modifica?id=<uuid>` (uuid dal link "Statistiche") | verificata |
| Facebook | `/marketplace/edit/?listing_id=<id>` | verificata |
| eBay | `ebay.it/lstng?mode=ReviseItem&itemId=<id>` | verificata 10/2026 (titolo, prezzo, descrizione); richiede l'accesso a ebay.it |
| Wallapop | `app/catalog/edit/<id>` (l'id è nella pagina dell'annuncio: l'estensione apre quella e poi la modifica) | verificata 10/2026 (titolo, descrizione, prezzo, stato) |

## Non vendere due volte

- **Venduto su un sito:** se all'importazione Vinted o Facebook mostrano l'articolo come venduto, l'annuncio viene
  segnato venduto. Arriva una notifica con i siti dove va tolto, e in lista compaiono "Venduto: togli da …" e il
  pulsante **Togli dagli altri siti**, che apre gli annunci da eliminare.
- **Sparito da un sito:** se un annuncio pubblicato non compare tra i tuoi annunci attivi per 2 importazioni
  complete di fila, compare "Sparito da …: venduto o tolto?". Nel pannello Stato scegli "Venduto qui", "Tolto dal
  sito" o "È ancora online". Un annuncio "Tolto dal sito" si può rimettere online con **Ripubblica**.
  Gli annunci pubblicati nell'ultima ora e le importazioni rimaste a metà (elenco ancora in caricamento) non contano.
- **Ribasso rapido:** sugli annunci online da più di 14 giorni, **−10% sui siti** abbassa il prezzo e apre le pagine
  Modifica dei siti dove è pubblicato.

## Modificare più annunci insieme

Nella lista spunta gli annunci (o "Seleziona tutti"): in fondo compare la barra **Modifica N annunci**.
- **Prezzo:** imposta un valore, oppure più/meno una percentuale o un importo in euro. Percentuale e importo valgono
  anche per i prezzi per sito.
- **Titolo:** aggiungi un testo all'inizio o in fondo, oppure sostituisci una parola.
- **Descrizione:** aggiungi in fondo o all'inizio, sostituisci un testo o tutta la descrizione.
- **Condizione, categoria e marca.**
- **Siti su cui pubblicare:** aggiungi o togli.

**Annulla modifiche** ripristina i valori di prima. Le modifiche valgono in Splisto: sugli annunci già online
vanno aggiornate anche sul sito.

## Statistiche (visualizzazioni e like)

In cima alla home vedi, per ogni sito: annunci online, visualizzazioni totali e like/preferiti totali.
Ogni annuncio in lista mostra i numeri per sito. Gli annunci online da più di 14 giorni senza vendita
vengono segnalati con "valuta un ribasso".

I numeri si leggono dalla pagina del tuo annuncio, usando il link salvato:
- **Aggiorna statistiche** apre i tuoi annunci pubblicati in background, due alla volta, legge i numeri
  e chiude le schede;
- quando apri a mano la pagina di un tuo annuncio, i numeri si aggiornano da soli.

Le statistiche vengono solo lette dalle pagine. L'estensione non usa API interne dei siti.
Quello che il sito non mostra (es. le visualizzazioni a chi non è il venditore) resta "–".

## Stato della verifica (test reale, ottobre 2026)

Ho provato gli adapter sulle pagine vere, da loggato, compilando i moduli **senza mai pubblicare**.

| Sito | Verificato e funzionante | Non verificato / limiti |
| --- | --- | --- |
| Vinted | foto (3 caricate), titolo, descrizione, categoria (con ricerca), marca, taglia, condizione, colore, prezzo; like dalla pagina annuncio | visualizzazioni (le vede solo il venditore: testo da confermare) |
| Subito | URL e flusso, titolo, descrizione, condizione, marca, taglia, "Per", prezzo, foto (max 6, verificato 10/2026) | testo delle statistiche |
| Facebook | titolo, prezzo, categoria, condizione, foto (verificato 10/2026); testi di categorie e condizioni | descrizione sotto "Altri dettagli"; statistiche |
| eBay | campo "Dicci cosa vuoi vendere" | modulo completo (`/lstng`): selettori ancora ipotetici, usa "Insegna" |
| Wallapop | menu laterale (Portafoglio, profilo) | procedura a passi verificata 10/2026: l'estensione sceglie "Qualcosa che non uso più", scrive il riepilogo e inserisce le foto; i "Continua" li premi tu, poi il modulo si compila da solo |

Su Subito e Facebook il caricamento automatico delle foto è acceso (`uploadPhotos: true` nel file del sito,
riverificato 10/2026). Se un sito torna a rifiutarle, mettilo a `false`: le foto restano da caricare a mano.

## Backup

**Impostazioni → Esporta backup** salva un file JSON con tutti gli annunci, le foto e le impostazioni.
La chiave API non viene inclusa. **Importa backup** li ripristina; gli annunci con lo stesso id vengono sostituiti.

## Aggiornare i selettori quando un sito cambia

I siti cambiano spesso la pagina. Quando succede, lo stato diventa *Errore* ("Modulo non trovato") oppure
*Da completare* con campi che prima funzionavano. Ogni sito ha un file in `src/content/selectors/`:

| File | Cosa contiene |
| --- | --- |
| `url` | pagina di nuovo annuncio aperta dall'estensione |
| `formUrl` | parti dell'URL che identificano la pagina del modulo |
| `loggedOut` | URL e selettori che indicano che non sei loggato |
| `loggedIn` | elementi visibili solo da loggato (menu utente, link di uscita): servono al controllo accessi |
| `fields` | per ogni campo, una lista di modi per trovarlo, provati in ordine |
| `conditions` | testo delle opzioni di condizione su quel sito |
| `published` | URL della pagina annuncio / conferma, per salvare il link da solo |
| `stats` | dove leggere visualizzazioni e like (selettori o testo/aria-label della pagina) |
| `uploadPhotos` | (Subito, Facebook) caricamento automatico delle foto |

Ogni voce di `fields` è:
- una stringa = selettore CSS, ad esempio `'input[name="title"]'` o `'[data-testid="title--input"]'`;
- `{ label: 'Titolo' }` = il campo la cui etichetta (`<label>`, `aria-label` o `placeholder`) inizia con quel testo.

Usa attributi stabili (`name`, `aria-label`, `data-testid`, `id` leggibili, testo dell'etichetta).
Non usare classi generate come `.x1n2onr6` o `.web_ui__Input__abc12`: cambiano a ogni rilascio.

**Come trovare il selettore giusto (DevTools)**
1. Apri la pagina di nuovo annuncio del sito, da loggato.
2. Premi `F12` e poi `Ctrl+Maiusc+C`, quindi clicca sul campo (ad esempio il titolo).
3. Nel pannello **Elements** guarda gli attributi dell'elemento evidenziato: `name`, `id`, `aria-label`,
   `data-testid`, o la `<label>` vicina.
4. Prova il selettore nella **Console**:
   ```js
   document.querySelector('input[name="title"]')                     // deve restituire l'elemento
   document.querySelectorAll('input[type="file"]')                    // input delle foto
   [...document.querySelectorAll('label')].map((l) => l.textContent)  // testi delle etichette
   ```
5. Metti il selettore **in cima** alla lista del campo nel file del sito, poi `npm run build` e ricarica
   l'estensione.

Per i menu a tendina (categoria, condizione, marca) l'estensione clicca il campo, attende il menu e clicca
l'opzione col testo voluto. Se non trova l'opzione, controlla che il testo in `conditions` o nella
categoria corrisponda a quello mostrato dal sito.

Il modo più rapido per correggere un campo è il pulsante **Insegna** nel pannello Stato: non serve
ricompilare. Il file va modificato solo per correzioni permanenti o da condividere.

Per il debug: sulla scheda del sito, `F12` → **Console** mostra i messaggi `[Splisto]`. Gli errori del
service worker si vedono in `chrome://extensions` → **service worker** → Console.

## Struttura

```
manifest.json                 Manifest V3 (elaborato da @crxjs/vite-plugin)
src/background/index.ts       service worker: apre le schede, assegna i job, aggiorna lo stato
src/content/index.ts          content script: login, pagina giusta, avvio adapter
src/content/dom.ts            ricerca campi, scrittura compatibile con React, menu, foto (DataTransfer)
src/content/text.ts           confronto testi e formati (con test in tests/)
src/content/adapters/*.ts     un adapter per sito: fill(listing) → { ok, missingFields }
src/content/selectors/*.ts    URL e selettori per sito: il file da aggiornare
src/dashboard/                interfaccia React (lista, editor, foto, stato, impostazioni)
src/lib/db.ts                 IndexedDB (idb), backup
src/lib/ai.ts                 chiamate all'API Anthropic
src/lib/platforms.ts          limiti titolo, categorie e mappatura di default
public/logos/                 loghi dei siti (presi dai siti, 10/2026); *-mark = icona piccola, *-dark = tema scuro
```
