import { conIniziali } from './maiuscole.ts'

// Nome dell'ospite di UNA prenotazione.
//
// Il numero di telefono identifica la scheda cliente (guests.phone è UNIQUE),
// ma il nominativo può cambiare da prenotazione a prenotazione: figlio che
// prenota per un genitore, coniugi con lo stesso numero, accompagnatore che
// prenota per il paziente. Per questo bookings.guest_name (colonna facoltativa,
// migrata a mano su Supabase) porta il nome scritto nella singola richiesta:
// se c'è vince lui, altrimenti vale il nome della scheda, poi il telefono.
// Le prenotazioni vecchie non hanno guest_name e continuano a mostrare la
// scheda, esattamente come prima.
export function nomeOspite(b: any): string {
  return b?.guest_name || b?.guests?.full_name || b?.guests?.phone || 'Ospite'
}

// Nome pronto per i messaggi al cliente: via i caratteri invisibili residui
// (es. U+FE0F di una vecchia emoji) e gli spazi doppi/iniziali. Oltre a sporcare
// il saluto ("Gentile ️Monda,"), quei caratteri rompono la sintassi *grassetto*
// di WhatsApp facendo comparire asterischi letterali. Pulisce il valore all'uso:
// i nomi salvati nel database non vengono toccati.
export function nomePerMessaggio(n: string | null | undefined): string {
  return (n || '').replace(/[\u200B-\u200D\uFE0F]/g, '').replace(/\s+/g, ' ').trim()
}

// ── COME SI CHIAMA LA CLIENTE NEI MESSAGGI ─────────────────────────────────
// REGOLA UNICA (Ania, 21/09/2026): OGNI messaggio all'ospite comincia con
//
//     Gentile [Nome],
//
// cioè il SOLO nome di battesimo. Mai «Gentile Rossi,», mai «Gentile Anna
// Rossi,», mai «Gentile signora Rossi,». Vale per tutti i messaggi senza
// eccezioni: conferma con immagine, testo WhatsApp che accompagna l'immagine,
// conferma di solo testo, modifica, annullamento, bonifico, promemoria,
// pagamento ricevuto, arrivo, ringraziamento, proposte alle richieste.
//
// STORICO — SUPERATA: fino al 20/09/2026 valeva la regola del 12/09/2026, per
// cui la conferma SENZA immagine (il «documento ufficiale») scriveva nome e
// cognome e tutti gli altri messaggi il solo nome. Quell'eccezione non c'è
// più: l'ha tolta Ania il 21/09/2026. Con lei sono spariti anche
// `nomeECognomeMessaggio` (serviva solo a quel caso) e `soloNomeMessaggio`,
// sostituito da `salutoOspite`, che è l'UNICO punto da cui passano i saluti.
//
// DOVE STA IL NOME. Le richieste dal sito hanno due campi separati e
// attendibili (`richieste.nome` e `richieste.cognome`): lì il nome è il campo
// nome e non si tocca — «Maria Grazia» deve restare «Maria Grazia».
// Le prenotazioni invece hanno un campo unico, scritto «Nome Cognome»
// (`bookings.guest_name`, oppure `guests.full_name`): lì il nome va ricavato,
// ed è una CONVENZIONE, non una garanzia. Quando la convenzione non basta il
// messaggio non si fa passare per pronto: si chiede di controllare il nome.

/** Quello che compare dopo «Gentile» quando dal dato salvato non si ricava
 *  nessun nome: si vede subito che il messaggio non è pronto da mandare. */
export const NOME_DA_CONTROLLARE = '[NOME DA CONTROLLARE]'

export type Saluto = {
  /** il nome da scrivere dopo «Gentile». Mai vuoto: mai «Gentile ,» */
  nome: string
  /** true quando il nome si ricava con sicurezza dal nominativo salvato */
  sicuro: boolean
  /** true quando non si ricava nessun nome: la finestra blocca l'invio */
  daCompletare: boolean
}

// Le particelle che aprono il cognome: da lì in poi è tutto cognome, anche se
// le parole sono tante. Senza questa lista «Anna Maria De Luca» darebbe
// «Anna Maria De» (Ania, 12/09/2026).
const PARTICELLE_COGNOME = new Set(['de', 'di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'la', 'lo', 'van', 'von'])

// Un numero di telefono al posto del nome: nomeOspite ripiega sul telefono
// quando la scheda non ha nominativo, e «Gentile 342 700 4354,» non deve
// uscire mai.
const SEMBRA_UN_TELEFONO = /^[\d\s+().-]+$/

/** Il nome del saluto da un campo UNICO scritto «Nome Cognome».
 *  Il cognome è l'ultima parola — «Maria Grazia Rossi» → «Maria Grazia» —
 *  oppure, se c'è una particella, quella e tutto quello che segue:
 *  «Anna Maria De Luca» → «Anna Maria».
 *  Quando il dato non si legge (vuoto, telefono, ordine rovesciato) non si
 *  inventa niente e non si spaccia il cognome per nome: torna `daCompletare`. */
export function salutoDaNominativo(n: string | null | undefined): Saluto {
  const pulito = nomePerMessaggio(n)
  const parole = pulito.split(' ').filter(Boolean)
  const daControllare: Saluto = { nome: NOME_DA_CONTROLLARE, sicuro: false, daCompletare: true }
  if (parole.length === 0) return daControllare
  if (SEMBRA_UN_TELEFONO.test(pulito)) return daControllare
  if (pulito === 'Ospite') return daControllare        // il ripiego di nomeOspite
  // Una parola sola: può essere il nome («Anna») o il solo cognome («Monda»),
  // e da qui non si distinguono. Si saluta con quello che c'è — mai
  // «Gentile ,» — ma il messaggio non si dichiara sicuro.
  if (parole.length === 1) return { nome: parole[0], sicuro: false, daCompletare: false }
  const particella = parole.findIndex(p => PARTICELLE_COGNOME.has(p.toLowerCase()))
  // La particella in TESTA vuol dire cognome davanti («De Luca Anna», «La Rosa
  // Maria»): l'ordine è rovesciato e il nome non si ricava.
  if (particella === 0) return daControllare
  const finisceIlNome = particella > 0 ? particella : parole.length - 1
  return { nome: parole.slice(0, finisceIlNome).join(' '), sicuro: true, daCompletare: false }
}

/** Il nome del saluto da un campo NOME già separato (le richieste dal sito).
 *  Qui non si toglie niente: «Maria Grazia» resta «Maria Grazia». Si ripulisce
 *  soltanto da spazi doppi e caratteri invisibili. */
export function salutoDaCampoNome(nome: string | null | undefined): Saluto {
  const pulito = nomePerMessaggio(nome)
  if (!pulito || SEMBRA_UN_TELEFONO.test(pulito)) return { nome: NOME_DA_CONTROLLARE, sicuro: false, daCompletare: true }
  return { nome: pulito, sicuro: true, daCompletare: false }
}

// Stessa persona scritta con le stesse parole: tutte quelle del nominativo
// della prenotazione compaiono anche in quello della scheda cliente.
// «Monda» dentro «Simona Monda», «Rossi Anna» dentro «Anna Rossi».
function stesseParole(a: string, b: string): boolean {
  const pa = normalizzaNome(a).split(' ').filter(Boolean)
  const pb = normalizzaNome(b).split(' ').filter(Boolean)
  if (pa.length === 0 || pb.length === 0) return false
  return pa.every(p => pb.includes(p))
}

/** IL SALUTO DI UNA PRENOTAZIONE — unico punto per tutti i messaggi.
 *
 *  Il destinatario non cambia: vale il nominativo della prenotazione
 *  (`guest_name`), come in nomeOspite. La scheda cliente si consulta solo
 *  quando parla della STESSA persona (stesse parole): «Monda» sulla
 *  prenotazione e «Simona Monda» sulla scheda danno «Gentile Simona,», e il
 *  vecchio «Rossi Anna» si raddrizza in «Gentile Anna,». Con un nominativo
 *  diverso (un'altra persona) vince quello della prenotazione, sempre.
 *  Il nome di chi dorme in camera (`extra_phone_*_name`) non entra mai qui. */
export type PrenotazioneDelSaluto = { guest_name?: string | null; guests?: { full_name?: string | null; phone?: string | null } | null } | null | undefined

export function salutoOspite(b: PrenotazioneDelSaluto): Saluto {
  const prenotazione = nomePerMessaggio(b?.guest_name)
  const scheda = nomePerMessaggio(b?.guests?.full_name)
  // Prenotazioni vecchie, senza guest_name: vale la scheda, come da sempre.
  if (!prenotazione) return salutoDaNominativo(scheda || nomePerMessaggio(nomeOspite(b)))
  const daScheda = salutoDaNominativo(scheda)
  // La scheda cliente passa dai campi Nome e Cognome del gestionale (regole
  // fisse n. 1 e n. 2): quando dice la stessa persona, il suo ordine è quello
  // buono.
  if (daScheda.sicuro && stesseParole(prenotazione, scheda)) return daScheda
  return salutoDaNominativo(prenotazione)
}

// ── Il nominativo salvato, diviso in nome e cognome (16/09/2026) ────────────
// Serve al foglio «Dati della cliente», che ha i due campi dell'inserimento
// ma parte da guests.full_name, che è uno solo. Stessa regola di
// soloNomeMessaggio: il cognome è l'ultima parola, oppure la particella e
// tutto quello che segue («Anna Maria De Luca» → «Anna Maria» + «De Luca»).
// Una parola sola è il nome; se il nominativo COMINCIA con una particella
// («De Luca») il nome è la prima parola e il resto è cognome, così il campo
// del nome non resta mai vuoto. I dati salvati non cambiano: si divide solo
// per mostrare, e al salvataggio li rimette insieme nomeCompleto.
export function spezzaNome(n: string | null | undefined): { nome: string; cognome: string } {
  const parole = nomePerMessaggio(n).split(' ').filter(Boolean)
  if (parole.length <= 1) return { nome: parole[0] ?? '', cognome: '' }
  const particella = parole.findIndex(p => PARTICELLE_COGNOME.has(p.toLowerCase()))
  const taglio = particella > 0 ? particella : particella === 0 ? 1 : parole.length - 1
  return { nome: parole.slice(0, taglio).join(' '), cognome: parole.slice(taglio).join(' ') }
}

// Confronto insensibile a maiuscole, spazi doppi e codifiche Unicode diverse:
// "ROBERTO GRANATA" e "Roberto  Granata" sono la stessa persona.
export function normalizzaNome(n: string | null | undefined): string {
  return (n || '').normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

// true quando la prenotazione porta un nominativo diverso da quello della
// scheda cliente agganciata al telefono: fa scattare l'avviso rosso.
// Mai true sulle prenotazioni senza guest_name (quelle vecchie).
export function nomeDiverso(b: any): boolean {
  const questa = normalizzaNome(b?.guest_name)
  const scheda = normalizzaNome(b?.guests?.full_name)
  return questa !== '' && scheda !== '' && questa !== scheda
}

// Nominativi già associati allo stesso numero, diversi da quello di questa
// prenotazione: il nome della scheda più gli eventuali guest_name delle altre
// prenotazioni dello stesso cliente, deduplicati con la stessa normalizzazione.
export function nomiPrecedenti(b: any, altrePrenotazioni: any[] = []): string[] {
  const attuale = normalizzaNome(b?.guest_name)
  const visti = new Set<string>()
  const nomi: string[] = []
  const candidati = [b?.guests?.full_name, ...altrePrenotazioni.map(x => x?.guest_name)]
  for (const n of candidati) {
    const norm = normalizzaNome(n)
    if (norm === '' || norm === attuale || visti.has(norm)) continue
    visti.add(norm)
    nomi.push(String(n).trim())
  }
  return nomi
}

// ── Nome e cognome: UNICA funzione che li mette insieme ─────────────────────
// Ovunque il gestionale mostra un cliente lo scrive «Nome Cognome», mai
// «Cognome Nome»: lista e calendario delle Richieste, dettaglio, proposta,
// pannello, tooltip, push e Pushover, cambio cliente, confronto «già stato».
// Nome o cognome vuoti non lasciano spazi doppi. I dati salvati non cambiano:
// cambia solo l'ordine con cui entrano nei testi. La scheda cliente (guests)
// ha un campo unico, full_name, già scritto «Nome Cognome»: se non ci sono
// nome e cognome separati vale quello, ripulito dagli spazi.
// Regola fissa (Ania, 04 e 07/09/2026): nessun altro punto del codice deve
// concatenare nome e cognome da sé — lo controlla lib/ordineNomi.test.ts.
export function nomeCompleto(c: { nome?: string | null; cognome?: string | null; full_name?: string | null }): string {
  const pezzi = [c.nome, c.cognome].map(x => (x || '').trim()).filter(Boolean)
  const testo = pezzi.length ? pezzi.join(' ') : (c.full_name || '')
  return testo.replace(/\s+/g, ' ').trim()
}

// Versione corta per gli spazi stretti (barre del calendario): «Anna R.»,
// mai «Rossi A.». Senza cognome resta il nome, senza nome resta il cognome.
export function nomeBreve(c: { nome?: string | null; cognome?: string | null }): string {
  const nome = (c.nome || '').trim(), cognome = (c.cognome || '').trim()
  if (!cognome) return nome
  if (!nome) return cognome
  return `${nome} ${cognome[0]}.`
}

// ── Il nominativo DA SALVARE su guests.full_name (18/09/2026) ──────────────
// Regola fissa n. 1 (REGOLE-FISSE.md): nome e cognome partono con la
// maiuscola ovunque. Nei campi ci pensa components/CampiNomeCognome; qui c'è
// la SECONDA RETE, al salvataggio: ogni punto che scrive full_name (cliente
// nuovo dell'inserimento, «Dati della cliente», «Cambia cliente», le pagine
// vecchie dei clienti) passa di qui, e lo controlla lib/nomiOvunque.test.ts.
// Stesso ordine di sempre: nome, poi cognome (regola fissa n. 2). Vuoto
// resta vuoto; con ONull torna null per le colonne facoltative.
export function nomeDaSalvare(c: { nome?: string | null; cognome?: string | null; full_name?: string | null }): string {
  return conIniziali(nomeCompleto(c))
}
export function nomeDaSalvareONull(c: { nome?: string | null; cognome?: string | null; full_name?: string | null }): string | null {
  return nomeDaSalvare(c) || null
}

// ── QUANDO IN CAMERA C'È UN'ALTRA PERSONA (Ania, 21/09/2026) ───────────────
// Luca prenota e all'arrivo si presenta suo fratello Massimo: l'avviso in
// fondo alla scheda non bastava, sfuggiva. Da oggi, ovunque si legga il nome
// della prenotazione, i due nomi stanno attaccati: «Luca Tassone / Massimo
// Tassone» — davanti chi ha prenotato, dopo chi dorme davvero. Se non c'è
// nessun altro non cambia niente: resta il nome di sempre.
// Vale solo per quello che si LEGGE a schermo (Home, elenchi, calendario,
// arrivi, pulizie, scheda). Nei messaggi al cliente il nome resta uno solo:
// lì si passa da nomeOspite, come prima.
export function altriInCamera(b: any): string[] {
  return [b?.extra_phone_1_name, b?.extra_phone_2_name]
    .map(x => nomePerMessaggio(x))
    .filter(Boolean)
}

/** «Luca Tassone / Massimo Tassone» per gli schermi con spazio */
export function nomeConAltri(b: any): string {
  return [nomeOspite(b), ...altriInCamera(b)].join(' / ')
}

/** «Luca T. / Massimo T.» per le barre strette del calendario. Senza altre
 *  persone il nome resta intero, esattamente come si è sempre visto. */
export function nomeConAltriCorto(b: any): string {
  const altri = altriInCamera(b)
  if (altri.length === 0) return nomeOspite(b)
  const corto = (n: string) => {
    const { nome, cognome } = spezzaNome(n)
    return /^[\p{L}]/u.test(cognome) ? nomeBreve({ nome, cognome }) : n
  }
  return [corto(nomeOspite(b)), ...altri.map(corto)].join(' / ')
}
