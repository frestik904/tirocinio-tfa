# Quaderno di tirocinio TFA

Sito personale di Riccardo Cerruto (TFA sostegno, Università di Catania) per annotare le ore di tirocinio diretto e indiretto.

È un sito statico: HTML, CSS e JavaScript, senza build e senza server. I dati restano nel browser (localStorage) e non sono nel repository.

Apri il quaderno su [https://frestik904.github.io/tirocinio-tfa/](https://frestik904.github.io/tirocinio-tfa/) oppure, in locale, apri `index.html`. Su iPhone, da Safari, puoi usare «Aggiungi a Home».

La pubblicazione è il workflow `.github/workflows/pages.yml`, che parte a ogni push su `main`. Se il link non si apre ancora, in GitHub vai su **Settings → Pages → Build and deployment** e scegli **GitHub Actions**.

## Uso

- **Attività**: inserisci data, dalle/alle, ore (calcolate dagli orari, modificabili), tipo diretto o indiretto, scuola e classe se servono, attività svolte e note. Puoi modificare ed eliminare (con conferma).
- **Riepilogo**: barre verso 150 ore di diretto e 25 di indiretto, ore restanti, controllo del mese e della settimana.
- **Calendario**: i giorni con attività sono colorati (diretto, indiretto o entrambi). Tocca un giorno per vedere o aggiungere.
- **Elenco**: filtra per mese e tipo e cerca nel testo.
- **Stampa**: compila l'intestazione del quaderno e usa «Stampa registro». Nel dialogo del browser scegli «Salva come PDF» (orizzontale, A4). Su iPhone, nel foglio di stampa allarga l'anteprima con due dita e poi «Salva su File». Puoi stampare solo il diretto, solo l'indiretto o entrambi.
- **Impostazioni**: obiettivi e limiti. Valori iniziali: 150 ore diretto, 25 indiretto, massimo 30 ore dirette al mese, massimo 18 ore totali a settimana (lunedì–domenica).

Il limite mensile riguarda il tirocinio diretto. Il limite settimanale somma diretto e indiretto. Superare un limite non impedisce il salvataggio: compare un avviso.

## Backup tra PC e iPhone

I dati non si sincronizzano da soli. In Impostazioni usa **Esporta JSON**, porta il file sull'altro dispositivo (AirDrop, mail, File) e lì usa **Importa JSON**.

- **Unisci** aggiunge le attività del file e aggiorna quelle con lo stesso identificativo.
- **Sostituisci** cancella il registro attuale e lo rimpiazza con il file (chiede conferma).

Puoi aggiornare anche intestazione, obiettivi e limiti.

Non caricare i backup nel repository: il codice del sito è pubblico, il quaderno no.
