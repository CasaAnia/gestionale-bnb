// ============================================================================
// «NOTA E COLORE» (17/09/2026): il foglio della scheda nuova per la nota
// della prenotazione, il colore della barra sul calendario e da dove è
// arrivata la prenotazione (diretta, dal sito, WhatsApp). Erano le ultime
// tre cose di «Altre modifiche» della scheda attuale senza un foglio.
//
// I colori e le tre provenienze sono ESATTAMENTE quelli della scheda
// attuale: il calendario li legge così («#f97316» è l'esclusiva, il vuoto
// è il colore automatico). Si scrivono su tutte le camere della prenotazione,
// così la scheda dice la stessa cosa da qualunque riga si apra.
//
// Funzioni pure: niente Supabase.
// ============================================================================
export const TITOLO_NOTA = 'Nota e colore'
export const COMANDO_NOTA = 'Nota e colore'
export const SALVA_NOTA = 'Salva'
export const NOTA_SALVATA = 'Nota e colore salvati.'
export const ETICHETTA_NOTA_PRENOTAZIONE = 'Nota di questa prenotazione'
export const ETICHETTA_COLORE = 'Colore sul calendario'
export const ETICHETTA_ARRIVATA_DA = 'La prenotazione è arrivata'

/** I colori della barra sul calendario, come nella scheda attuale */
export const COLORI_CALENDARIO = [
  { valore: '', nome: 'Auto', fondo: '#22c55e' },
  { valore: '#1f2937', nome: 'Nero', fondo: '#1f2937' },
  { valore: '#3b82f6', nome: 'Blu', fondo: '#3b82f6' },
  { valore: '#a855f7', nome: 'Viola', fondo: '#a855f7' },
  { valore: '#f97316', nome: 'Esclusiva', fondo: '#f97316' },
  { valore: '#ec4899', nome: 'Rosa', fondo: '#ec4899' },
  { valore: '#eab308', nome: 'Giallo', fondo: '#eab308' },
] as const

/** Da dove è arrivata la prenotazione: le tre voci di sempre (bookings.source) */
export const ARRIVATA_DA = [
  { chiave: 'diretta', testo: 'Diretta' },
  { chiave: 'sito_web', testo: '🌐 Dal sito' },
  { chiave: 'whatsapp', testo: 'WhatsApp' },
] as const
export type ArrivataDa = typeof ARRIVATA_DA[number]['chiave']

export type ModuloNota = { nota: string; colore: string; arrivataDa: ArrivataDa }

export type RigaNota = { id: string; status?: string | null; notes?: string | null; color?: string | null; source?: string | null }

/** Il modulo com'è salvato sulla riga aperta */
export function moduloDaPrenotazione(b: RigaNota | null | undefined): ModuloNota {
  const source = (b?.source ?? '').trim()
  return {
    nota: (b?.notes ?? '').trim(),
    colore: COLORI_CALENDARIO.some(c => c.valore === (b?.color ?? '')) ? (b?.color ?? '') : '',
    arrivataDa: ARRIVATA_DA.some(a => a.chiave === source) ? (source as ArrivataDa) : 'diretta',
  }
}

/** I campi di bookings: la nota vuota è null, il colore vuoto è null (automatico) */
export function campiNota(m: ModuloNota): { notes: string | null; color: string | null; source: ArrivataDa } {
  return { notes: m.nota.trim() || null, color: m.colore || null, source: m.arrivataDa }
}

/** Le righe attive della prenotazione, dove si scrive */
export function idsDaScrivere(righe: RigaNota[]): string[] {
  return righe.filter(r => r.status !== 'annullata').map(r => r.id)
}

/** Vero se salvare non cambierebbe niente rispetto alla riga aperta */
export function nienteDaCambiare(m: ModuloNota, b: RigaNota | null | undefined): boolean {
  const prima = moduloDaPrenotazione(b)
  return prima.nota === m.nota.trim() && prima.colore === m.colore && prima.arrivataDa === m.arrivataDa
}
