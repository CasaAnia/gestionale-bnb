// ============================================================================
// I MESSAGGI AL MOMENTO GIUSTO (punto 6, disegno approvato da Ania il
// 21/09/2026: «Va bene, dai, facciamolo»).
//
// La parte «Messaggi» della scheda non mette più in fila tutti i tasti allo
// stesso modo: in cima resta SEMPRE la conferma con immagine e testo (il
// flusso vero di ConfermaWhatsApp, in ogni fase del soggiorno), poi vengono i
// pochi messaggi utili adesso, e tutti gli altri restano dentro «Tutti i
// messaggi», chiuso all'inizio.
//
// Qui si decide COSA proporre; il componente (components/scheda/MessaggiScheda)
// decide come si vede. Funzioni pure: niente Supabase, niente orologio —
// «oggi» arriva da fuori (la data di Roma della scheda).
//
// La fase si legge dalle date della PRENOTAZIONE INTERA, non del tratto
// aperto: con un cambio camera, con due camere insieme o con una pausa in
// mezzo il soggiorno resta uno solo, e non diventa «concluso» al primo cambio.
//   · prima   → oggi è prima del primo arrivo
//   · durante → dal giorno del primo arrivo fino a prima dell'ultima partenza
//               (anche nelle notti di pausa fra un tratto e l'altro)
//   · dopo    → dal giorno dell'ultima partenza in poi
//
// Due casi si dicono a voce alta, invece di indovinare un soggiorno che non
// c'è (scelta del 21/09/2026, confermata da Ania la sera stessa):
//   · annullata → la prenotazione non ha più NESSUN tratto attivo: utili
//     adesso restano il messaggio di annullamento e il messaggio libero.
//     Nessun comando nuovo: il messaggio di annullamento è un TESTO, non
//     annulla niente e non tocca date o stato;
//   · incerta → le date non si possono leggere (mancanti, fuori calendario,
//     o partenza prima dell'arrivo): si propone solo il messaggio libero,
//     perché nessun testo del soggiorno sarebbe vero.
// In tutti e due i casi ogni messaggio resta raggiungibile da «Tutti i
// messaggi»: non si toglie niente, si sposta solo quello che si consiglia.
//
// CORREZIONE del 21/09/2026 sera (verifica indipendente di Codex): la fase NON
// riceve più lo stato di una riga. Prima la scheda passava lo stato della sola
// riga aperta e una prenotazione MISTA — una camera annullata e le altre
// confermate — diventava «annullata» solo perché si era entrati dalla riga
// annullata: stessa prenotazione, suggerimenti diversi a seconda del link.
// Adesso conta una cosa sola, e non si può sbagliare: **quanti tratti attivi
// ci sono**. Nessuno → annullata; almeno uno → sono le sue date a parlare.
// ============================================================================
import { segmentiAttivi, type SegmentoScheda } from './schedaPrenotazione.ts'
import { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO, type TipoMessaggio } from './messaggiPrenotazione.ts'

export type FaseMessaggi = 'prima' | 'durante' | 'dopo' | 'annullata' | 'incerta'

/** Un messaggio da mostrare: il tipo (per il testo) e l'etichetta del tasto. */
export type VoceMessaggio = { tipo: TipoMessaggio; label: string }

/** I nove messaggi, nell'ordine di «Tutti i messaggi» (l'annullamento in fondo). */
export const TUTTI_I_MESSAGGI: VoceMessaggio[] = [...MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO]

// Il giorno scritto all'inizio del valore, MA solo se esiste davvero sul
// calendario: «2026-13-40» e «2026-02-30» non sono giorni. Un'ora attaccata
// dietro («2026-09-11T22:00:00+02:00») resta ammessa: si legge il giorno e
// basta. Qui non si tocca il fuso: «oggi» arriva già come giorno di Roma.
const GIORNO = /^(\d{4})-(\d{2})-(\d{2})/
export function giornoLeggibile(x: string | null | undefined): string | null {
  const pezzi = GIORNO.exec(typeof x === 'string' ? x : '')
  if (!pezzi) return null
  const [, a, m, g] = pezzi
  const d = new Date(Date.UTC(Number(a), Number(m) - 1, Number(g)))
  const esiste = d.getUTCFullYear() === Number(a) && d.getUTCMonth() === Number(m) - 1 && d.getUTCDate() === Number(g)
  return esiste ? `${a}-${m}-${g}` : null
}

/** La fase del soggiorno intero, letta dalle date di TUTTI i tratti attivi.
 *  Non prende lo stato di una riga: una prenotazione è annullata quando non
 *  le resta nessun tratto attivo, non perché si è aperta la riga annullata. */
export function faseMessaggi(segmenti: SegmentoScheda[], oggi: string): FaseMessaggi {
  const attivi = segmentiAttivi(segmenti ?? [])
  if (attivi.length === 0) return 'annullata'
  const giorno = giornoLeggibile(oggi)
  if (!giorno) return 'incerta'
  // date leggibili E sensate: la partenza dopo l'arrivo, almeno una notte
  const date = attivi.map(s => ({ dentro: giornoLeggibile(s.check_in), fuori: giornoLeggibile(s.check_out) }))
  if (date.some(d => !d.dentro || !d.fuori || d.fuori <= d.dentro)) return 'incerta'
  const primoArrivo = date.reduce((m, d) => (d.dentro! < m ? d.dentro! : m), date[0].dentro!)
  const ultimaPartenza = date.reduce((m, d) => (d.fuori! > m ? d.fuori! : m), date[0].fuori!)
  if (giorno < primoArrivo) return 'prima'
  if (giorno >= ultimaPartenza) return 'dopo'
  return 'durante'
}

// I suggerimenti, nell'ordine deciso da Ania (21/09/2026). «Pagamento
// ricevuto» sta anche PRIMA dell'arrivo, ed è voluto: serve per acconti e
// anticipi, non solo per chi è già in casa.
const UTILI: Record<FaseMessaggi, TipoMessaggio[]> = {
  prima: ['conferma', 'richiesta_orario', 'dati_bonifico', 'pagamento_ricevuto'],
  durante: ['pagamento_ricevuto', 'modifica', 'libero'],
  dopo: ['ringraziamento', 'libero'],
  annullata: ['annullamento', 'libero'],
  incerta: ['libero'],
}

/** I messaggi consigliati adesso, nell'ordine approvato. */
export function messaggiUtili(fase: FaseMessaggi): VoceMessaggio[] {
  return UTILI[fase].map(tipo => {
    const voce = TUTTI_I_MESSAGGI.find(v => v.tipo === tipo)
    if (!voce) throw new Error(`messaggio sconosciuto: ${tipo}`)
    return voce
  })
}

// Le parole della sezione: stanno qui una volta sola, così il componente non
// se le riscrive e i test le possono leggere.
export const TITOLO_CONFERMA = 'Conferma prenotazione'
export const SOTTOTITOLO_CONFERMA = 'Immagine e testo'
export const SEMPRE_DISPONIBILE = 'Sempre disponibile, in ogni fase del soggiorno'
export const UTILI_ADESSO = 'Utili adesso'
export const TUTTI_I_MESSAGGI_TITOLO = 'Tutti i messaggi'
