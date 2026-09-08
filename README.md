# Ritmo — PWA Timer Routine

Ritmo è una Progressive Web App mobile-first per creare e svolgere routine temporizzate. Gestisce esercizi, pause e più segnali intermedi per step; funziona senza backend, è installabile su iPhone e resta utilizzabile offline dopo la prima visita.

## Avvio locale

I moduli JavaScript e il service worker richiedono un server HTTP: non aprire `index.html` tramite `file://`.

Con Python:

```bash
python3 -m http.server 8000
```

Poi aprire `http://localhost:8000`. In alternativa si può usare l'estensione **Live Server** di VS Code.

## Pubblicazione su GitHub Pages

Il progetto non richiede build o dipendenze Node. Eseguire commit e push sul branch `main`, quindi nel repository GitHub aprire:

1. **Settings → Pages**
2. **Build and deployment → Source: Deploy from a branch**
3. Selezionare **main** e **/(root)**
4. Salvare

Tutti i percorsi sono relativi e funzionano anche all'indirizzo `https://USERNAME.github.io/NOME-REPOSITORY/`.

## Struttura

```text
.
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/styles.css
├── js/
│   ├── app.js                 # routing e vista home/impostazioni
│   ├── audio.js               # segnali Web Audio
│   ├── models.js              # modelli, demo e validazione import
│   ├── routine-editor.js      # editor e riordino step
│   ├── routine-player.js      # stato e UI del player
│   ├── router.js              # URL interni compatibili con GitHub Pages
│   ├── storage.js             # persistenza centralizzata
│   ├── timer-engine.js        # timer basato su timestamp reali
│   └── utils.js               # durata, formattazione e helper
└── assets/icons/
```

## Persistenza e backup

Routine e preferenze sono salvate in `localStorage` con chiave versionata `ritmo:routine-timer:v1`. La routine demo viene creata solo quando non esiste ancora uno stato locale; se viene modificata o eliminata non ricompare automaticamente.

Dalle impostazioni si può esportare un backup JSON o importarlo scegliendo se unire o sostituire i dati. La struttura importata viene validata e normalizzata prima del salvataggio.

Per azzerare i dati usare **Impostazioni → Ripristina dati iniziali**. In alternativa, dagli strumenti sviluppatore del browser, eliminare la chiave indicata sopra dal Local Storage e ricaricare la pagina.

## Modificare la routine demo

La funzione `createDemoRoutine()` in `js/models.js` definisce il dataset iniziale usando gli stessi modelli di ogni routine creata dall'utente. Le modifiche al codice della demo sono visibili soltanto per nuovi profili locali o dopo un ripristino esplicito dei dati.

## PWA e aggiornamenti

Il service worker mette in cache l'app shell e rimuove le cache di versioni precedenti. Quando si pubblica una nuova release, incrementare `CACHE_VERSION` in `service-worker.js` e `APP_VERSION` in `js/app.js`. L'app rileva il nuovo service worker e mostra il pulsante **Aggiorna ora**: la nuova cache viene attivata solo dopo il tap dell'utente, senza cancellare routine o impostazioni locali.
