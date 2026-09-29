// ============================================================================
// SOTTOTITOLI DELLA TESTA DAL MAC (29/09/2026, Ania): la riga maiuscoletta
// d'ottone sotto il titolo (components/TestaPagina `sottotitolo` e
// components/TestaMac), solo dove c'è un dato utile. Il maiuscolo lo fa il CSS.
// ============================================================================
import { periodoCompatto, dataLunga, GIORNI_LUNGHI } from './dateItaliane.ts'

// Calendario: il periodo in vista e le camere, «26 set → 9 ott · 4 camere»
export function sottotitoloCalendario(dal: string | null | undefined, al: string | null | undefined, camere: number): string {
  const periodo = periodoCompatto(dal, al)
  if (!periodo) return ''
  return `${periodo} · ${camere === 1 ? '1 camera' : `${camere} camere`}`
}

// Il mese intero di un giorno («2026-09-14» → 1 set … 30 set), per la vista a mese
export function meseIntero(iso: string): { dal: string; al: string } {
  const [a, m] = iso.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { dal: `${a}-${mm}-01`, al: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

// Arrivi: la stessa nota che dal telefono sta nella riga dei mesi
export function sottotitoloArrivi(giorni: number): string {
  return `arrivi dei prossimi ${giorni} giorni`
}

// Richieste: le nuove da gestire, lo stesso numero del bollino d'ottone del
// menu. Mentre carica (o se la lettura è fallita) la riga resta vuota: un
// errore non deve mai sembrare «nessuna».
export function sottotitoloRichieste(nuove: number | null): string {
  if (nuove === null) return ''
  return nuove === 0 ? 'nessuna da gestire' : `${nuove} da gestire`
}

// Prenotazioni: quante righe ha l'archivio (tutte, come il filtro «tutte»)
export function sottotitoloPrenotazioni(n: number): string {
  return `${n} in archivio`
}

// Clienti: quanti ce ne sono in anagrafica
export function sottotitoloClienti(n: number): string {
  return n === 1 ? '1 cliente' : `${n} clienti`
}

// Pulizie: la data di oggi, «martedì 29 settembre 2026»
export function sottotitoloOggi(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  if (!a || !m || !g) return ''
  return `${GIORNI_LUNGHI[new Date(a, m - 1, g).getDay()].toLowerCase()} ${dataLunga(iso)}`
}

// Spese: il periodo scelto nei filtri («Settembre 2026»); per l'intervallo
// le due date, «1 set → 15 set»
export function sottotitoloSpese(periodi: { id: string; etichetta: string; tipo: string }[], filtri: { periodo: string; dal: string; al: string }): string {
  const p = periodi.find(x => x.id === filtri.periodo)
  if (p?.tipo === 'intervallo' || filtri.periodo === 'intervallo') return filtri.dal && filtri.al ? periodoCompatto(filtri.dal, filtri.al) : (p?.etichetta ?? '')
  return p?.etichetta ?? ''
}
