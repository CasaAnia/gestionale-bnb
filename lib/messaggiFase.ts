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
// c'è (scelta del 21/09/2026, da rivedere con Ania se non le torna):
//   · annullata → la prenotazione è annullata (o non ha più nessun tratto
//     attivo): utili adesso restano il messaggio di annullamento e il
//     messaggio libero. Nessun comando nuovo: il messaggio di annullamento è
//     un TESTO, non annulla niente e non tocca date o stato;
//   · incerta → mancano le date (righe rovinate): si propone solo il
//     messaggio libero, perché nessun testo del soggiorno sarebbe vero.
// In tutti e due i casi ogni messaggio resta raggiungibile da «Tutti i
// messaggi»: non si toglie niente, si sposta solo quello che si consiglia.
// ============================================================================
import { segmentiAttivi, type SegmentoScheda } from './schedaPrenotazione.ts'
import { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO, type TipoMessaggio } from './messaggiPrenotazione.ts'

export type FaseMessaggi = 'prima' | 'durante' | 'dopo' | 'annullata' | 'incerta'

/** Un messaggio da mostrare: il tipo (per il testo) e l'etichetta del tasto. */
export type VoceMessaggio = { tipo: TipoMessaggio; label: string }

/** I nove messaggi, nell'ordine di «Tutti i messaggi» (l'annullamento in fondo). */
export const TUTTI_I_MESSAGGI: VoceMessaggio[] = [...MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO]

const GIORNO = /^\d{4}-\d{2}-\d{2}/
const dataBuona = (x: string | null | undefined) => typeof x === 'string' && GIORNO.test(x)

/** La fase del soggiorno intero, letta dalle date di tutti i tratti attivi. */
export function faseMessaggi(segmenti: SegmentoScheda[], oggi: string, status?: string | null): FaseMessaggi {
  const attivi = segmentiAttivi(segmenti ?? [])
  if (status === 'annullata' || attivi.length === 0) return 'annullata'
  if (!dataBuona(oggi) || attivi.some(s => !dataBuona(s.check_in) || !dataBuona(s.check_out))) return 'incerta'
  const giorno = oggi.slice(0, 10)
  const primoArrivo = attivi.reduce((m, s) => (s.check_in < m ? s.check_in : m), attivi[0].check_in).slice(0, 10)
  const ultimaPartenza = attivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), attivi[0].check_out).slice(0, 10)
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
