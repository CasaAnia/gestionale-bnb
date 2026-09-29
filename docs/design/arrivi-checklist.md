# Arrivi «Maison» — checklist del riferimento

Fonte: `docs/design/arrivi-riferimento.html` (approvato da Ania il
29/09/2026) più l'incarico dello stesso giorno (punti 1–10). Qui c'è **solo
quello che il riferimento mostra** nei tre telefoni della striscia
(«Legenda dei colori» · «Colori per stato» · «Tocco su una scheda»), più le
regole dell'incarico che lo precisano. Ogni voce ha un codice: il riscontro
finale (`arrivi-riscontro.md`) la riprende con «fatta» o «non fatta: motivo».

Il file contiene anche i disegni del Calendario (C1–C10…, `AB` con le schede
tutte blu) che NON entrano nella striscia degli Arrivi: non fanno parte del
disegno. Le frasi grigie sotto il nastro spiegano il disegno a chi guarda e
non sono testi della pagina (la riga colorata «Tutto a posto · Autonomo con
orario · Manca qualcosa» sotto il secondo telefono è una didascalia: sul
telefono la legenda sta nel foglio, dal Mac in riga come nel Calendario). La
riga «ARRIVI» in cima a ogni telefono è la barra dell'app (TestaPagina).

Dove riferimento e incarico si scostano vale l'incarico, che è più preciso
(scritto nella voce, «incarico»). I dati dei telefoni (Marta Bellini,
Giovanni Serra, Fam. Russo…) sono esempi.

La base è il Calendario «Maison» (`calendario-checklist.md`): stessa testa,
stessa riga di navigazione, stesso nastro, stesse misure. Qui si ripete solo
quello che il riferimento degli Arrivi mostra, e si segna cosa cambia.

## 0. Regole comuni (tutti i telefoni)

- G1 Stessi caratteri del Calendario: Cormorant Garamond per camere, periodo, nomi e orario; Figtree sul telefono (Jost dal Mac) per il resto.
- G2 Stessi componenti e stesse classi del Calendario (TestaPagina, CampoRicerca «maison», InterruttorePillola «maison», righello, corsie, schede, buchi, RigaMesi «maison», FoglioMaison, legenda): riusati con le opzioni, non copiati.
- G3 I colori degli Arrivi definiti UNA volta accanto a quelli del Calendario (incarico: «variabili `--cal-*`»; il Calendario tiene i suoi in `TINTE_SCHEDA` di `lib/calendarioMobile`).
- G4 Niente bottoni pieni tranne: la voce accesa di «Mese | 2 settimane», il mese acceso, le scelte accese dei chip nel foglio e il tasto «Salva» del foglio.
- G5 Le azioni sono maiuscoletto sottolineato («Chiedi orario», «Apri chat», «Apri prenotazione», «Usa come l’ultima volta», «Vedi storico arrivi (3)», «Chiudi»).
- G6 Tutte le funzioni degli Arrivi di oggi restano con lo stesso comportamento; cambiano solo la veste e le novità 10a–10f.

## 1. Testa (telefoni 1–3)

- T1 Sul telefono niente titolo nella pagina: «ARRIVI» lo dice la barra dell'app (TestaPagina come oggi).
- T2 Campo «Cerca nome o telefono…» a tutta larghezza, a filo (solo il filo sotto #C9BFA8), lente a sinistra in grigio, testo 15 px; con del testo il «✕» a destra.
- T3 Ricerca come oggi (nome, scheda cliente, telefono: lib/ricerca); si scorre al primo arrivo trovato.
- T4 Nessun risultato: «Nessun arrivo trovato nei prossimi 83 giorni» in mattone chiaro #8c6a52 (incarico).
- T5 Un risultato: «🔎 {nome}»; più risultati: «🔎 {n} arrivi trovati» (testi di oggi, incarico).
- T6 Con la ricerca attiva le schede trovate hanno il contorno verde 2 px, le altre si attenuano a 0,35 (incarico, come nel Calendario).

## 2. Riga di navigazione (telefoni 1–3)

- N1 Una riga sotto la testa col filo sotto: «‹» a sinistra, il periodo in Cormorant 16 px («28 set – 11 ott 2026»), a destra la pillola «MESE | 2 SETTIMANE» (maiuscoletto 10 px, filo #C9BFA8, voce accesa piena d'inchiostro) e «›».
- N2 Etichetta del periodo da `etichettaPeriodo` a «2 settimane», il mese («Settembre 2026») a «Mese».
- N3 La scelta è la stessa del Calendario, ricordata in `ca_calendario_modo`.
- N4 Frecce: a «2 settimane» spostano di UNA settimana (novità 10c); a «Mese» al 1° del mese prima/dopo.
- N5 Finestra di 90 giorni come oggi: 7 prima di oggi, 83 dopo.

## 3. Il nastro (telefono 2, sotto il foglio negli altri)

- S1 Colonna delle camere 66 px, nomi in Cormorant (Amelia, Allegra, Ambra, Lena nell'ordine di oggi), corsie da 92 px col filo sotto.
- S2 Righello fermo in alto, una riga «lun 28», giorni da 60 px a «2 settimane» e 40 px a «Mese»; domeniche in terra, oggi in verde.
- S3 Filo verde di oggi a tutta altezza; filo ottone 2 px al 1° del mese.
- S4 Buchi liberi tratteggiati con le date («3 → 4 ott») e il «+»; il tocco apre la nuova prenotazione con camera e data.
- S5 Niente riga «🛏 extra» (negli Arrivi non c'è).

## 4. Le schede (telefono 2)

- K1 Stesse misure del Calendario: alte 72 px, 3 px d'aria per lato, angoli 6 px, filo pieno 4 px a sinistra, quattro righe; il testo che non ci sta si taglia.
- K2 Riga (a) maiuscoletto 9 px: «26 set → 1 ott · 3 notti»; sulle richieste da confermare «· dal sito 🌐».
- K3 Riga (b): l'ORARIO in struttura in Cormorant 19 px grassetto NERO #000 («15:30»), poi le icone di oggi (🔒 ⭐ 🧾 🛏 ⇄ 🌐, come nel Calendario) e il nome in Cormorant 14 px (nomeConAltri).
- K4 Senza orario: «?» in mattone #8C3B2E della stessa misura.
- K5 Riga (c) 9,5 px, l'arrivo in forma breve su una riga: «arrivo autonomo» · «atterra a Malpensa 14:15 · navetta Aldo, prelievo 14:30» · «in treno a Rogoredo 10:40 · navetta da assegnare» · «a Centrale 11:30 · navetta da definire» · «in struttura 18:30–19:30 circa · navetta Alberto, prelievo 18:00 a San Donato» · «orario da chiedere».
- K6 Sul tratto che parte di un cambio camera «· poi Lena» in coda alla riga (c); sul tratto che arriva la riga (c) è «cambio camera · da Ambra» e al posto dell'orario niente.
- K7 Riga (d) vuota: le schede restano alte 72 come nel Calendario.
- K8 Riga (c) in mattone quando manca l'orario; in blu scuro #2B4A5E sulle schede blu con l'orario.

## 5. Il colore della scheda = lo stato dell'arrivo (telefono 2)

- C1 VERDE fondo #BFDCC8, filo #6C9A7C = tutto a posto: orario in struttura (ora precisa o fascia) E navetta con autista assegnato.
- C2 OTTONE fondo #E8D6AE, filo #A8894F = arrivo autonomo (navetta «Non richiesta») con orario.
- C3 BLU fondo #C5D6E2, filo #7D9DB0 = manca qualcosa: navetta «Da assegnare» o «Da definire», oppure orario mancante (con «?»), o tutt'e due.
- C4 Richiesta dal sito da confermare: bianca tratteggiata verde come nel Calendario.
- C5 Cambio camera come nel Calendario: taglio obliquo, filo dello stesso colore sul bordo tagliato; il tratto che arriva ha il colore del tratto che parte (l'arrivo è uno solo).
- C6 Primo tocco su una scheda con cambio camera: la catena resta piena, il resto attenuato.
- C7 Arrivo già avvenuto (check-in prima di oggi): scheda attenuata (0,5) con «· arrivata» in coda alla riga (a) (novità 10e).
- C8 I colori definiti una volta sola, accanto a quelli del Calendario (G3).

## 6. Sotto il nastro (telefoni 1–3)

- B1 Il box «⇄ Cambi camera» solo se ci sono cambi oggi o domani: riquadro a filo arrotondato 8 px, etichetta maiuscoletto ottone «⇄ CAMBI CAMERA», righe «Fam. Russo da Ambra a Lena (oggi)» / «(domani)» con la parte fra parentesi in grigio e la preposizione di oggi (roomPreposition: «ad Amelia»).
- B2 RigaMesi come nel Calendario: «OGGI» a cerchio centrato sotto la colonna delle camere, col trattino; i 4 mesi cliccabili di oggi, quello in vista acceso.
- B3 Dopo i mesi la nota «arrivi dei prossimi 83 giorni» in grigio, 11 px.
- B4 Sotto «Oggi», nella stessa colonna, «LEGENDA» maiuscoletto sottolineato (novità 10d).

## 7. Legenda (telefono 1)

- L1 «LEGENDA» apre un FoglioMaison ad altezza fissa, con la maniglia e la riga «LEGENDA» maiuscoletto ottone.
- L2 Voci, ognuna col suo quadretto 14 px: «Verde · tutto a posto: orario in struttura e navetta con autista» (#6C9A7C) · «Ottone · arrivo autonomo con orario: nessuna navetta da organizzare» (#A8894F) · «Blu · manca qualcosa: l’autista da assegnare o da definire, oppure l’orario da chiedere («?» in mattone), o tutt’e due» (#7D9DB0) · «Dal sito, da confermare» (tratteggiato) · «Arrivo già avvenuto (giorni prima di oggi): scheda attenuata, con «· arrivata» nella prima riga» (verde attenuato).
- L3 La riga grigia: «Sulla scheda: orario grande (o «?»), icone e nome, poi luogo · mezzo · navetta con autista e prelievo. Icone: 🔒 esclusiva · ⭐ ottimo · 🧾 ricevuta · 🛏 letto in più · ⇄ cambio camera · 🌐 dal sito».
- L4 «CHIUDI» sottolineato in fondo.

## 8. Il foglio «Arrivo e navetta» (telefono 3)

- F1 Il tocco su una scheda apre il FoglioArrivo Maison della Home e della scheda (components/scheda/FoglioArrivo), altezza fissa 752 px (novità 10f); la scheda toccata ha il contorno, le altre si attenuano.
- F2 Riga maiuscoletta ottone «Arrivo e navetta · Ambra · gio 1 ott».
- F3 Il nome in Cormorant 22 px con le icone davanti (🧾 ⭐) e a destra i due cerchi cornetta e WhatsApp.
- F4 Il riassunto in grigio: «{arrivoInScheda().titolo} · Navetta: {navettaInScheda().titolo}» (testo di oggi, incarico), che segue la bozza.
- F5 Il modulo ArrivoNavetta nella veste a chip Maison: Tipo di arrivo · Luogo · Orario · In struttura · stima facoltativa · Navetta · Autista · Prelievo · facoltativo (ArrivoNavettaMaison, lo stesso piano di oggi).
- F6 Lo storico: «Ultimo arrivo registrato: 12 ago 2026 — 15:30 · 🚌 Massimo · USA COME L’ULTIMA VOLTA · VEDI STORICO ARRIVI (3)»; senza orari «Già ospite N volte, ma senza orari registrati»; «nascondi storico»; le righe dello storico come oggi.
- F7 Le azioni «CHIEDI ORARIO» · «APRI CHAT» (assenti senza numero) · «APRI PRENOTAZIONE».
- F8 Il tasto pieno «SALVA» a tutta larghezza, tondo; durante il salvataggio «Salvo...».
- F9 AvvisoAzione sugli errori; salvaArrivoPrenotazione con la rilettura come oggi; si chiude solo con esito ok, con la conferma B.
- F10 Tocco fuori = chiude senza salvare.
- F11 `/arrivi?apri=<id>` apre il foglio su quella prenotazione col nastro posizionato sul giorno prima, come oggi.

## 9. Dal Mac

- M1 Come il Calendario Maison dal Mac: stesse misure del Mac, legenda in riga sotto il nastro al posto di «LEGENDA».
- M2 Il foglio al centro.

## 10. Novità (le uniche modifiche di comportamento)

- 10a Schede al posto delle barre, con orario, nome e riga dell'arrivo scritti sopra.
- 10b Colore per stato dell'arrivo al posto dell'unico blu con l'ombra ottone della navetta.
- 10c Frecce a una settimana a «2 settimane».
- 10d Legenda.
- 10e Arrivi già avvenuti attenuati.
- 10f Il popup diventa il FoglioArrivo Maison ad altezza fissa.
