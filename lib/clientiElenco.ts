// ============================================================================
// L'ELENCO CLIENTI «MAISON» (ritocchi del 29/09/2026, D2; riferimento 2,
// schermata 1): le regole pure di una riga. Il disegno sta in
// app/clienti/page.tsx.
//
// Ogni riga: davanti al nome le icone (🧾 se vuole la ricevuta, ★ se ottima,
// «!» in mattone se problematica), il nome («Senza nome» se manca); sotto il
// numero per esteso coi cerchi; sotto «da Nida · 4 soggiorni · 640 €»
// (rigaCliente di lib/provenienza: provenienza, soggiorni conclusi, speso in
// mattone), «prima volta» senza soggiorni conclusi, «· motivo interno» se c'è
// il motivo problematico. Ordine (dal più recente) e ricerca (nome o
// telefono) come prima.
// ============================================================================
import { rigaCliente, testoFonte } from './provenienza.ts'
import { valutazioneDi, vuoleRicevuta } from './valutazione.ts'
import { soggiorniConclusi, type SoggiornoStorico } from './clienteCheTorna.ts'

export type ClienteElenco = {
  id: string
  full_name?: string | null
  phone?: string | null
  rating?: string | null
  vuole_ricevuta?: boolean | null
  provenienza?: string | null
  struttura_nome?: string | null
  motivo_problematico?: string | null
}

export const SENZA_NOME = 'Senza nome'
export const PRIMA_VOLTA = 'prima volta'
export const MOTIVO_INTERNO = 'motivo interno'

/** La ricerca di sempre: il nome contiene il testo (senza maiuscole) o il telefono lo contiene */
export function filtraElenco<T extends ClienteElenco>(clienti: T[], ricerca: string): T[] {
  const q = ricerca.toLowerCase()
  return clienti.filter(g => g.full_name?.toLowerCase().includes(q) || g.phone?.includes(ricerca))
}

/** Le icone davanti al nome */
export function iconeCliente(g: ClienteElenco): { ricevuta: boolean; stella: boolean; problema: boolean } {
  const v = valutazioneDi(g)
  return { ricevuta: vuoleRicevuta(g), stella: v === 'ottimo', problema: v === 'problematico' }
}

export type PezzoRiga = { testo: string; mat?: boolean }

/** «da Nida · 4 soggiorni · 640 €» a pezzi (lo speso in mattone) */
export function rigaElenco(g: ClienteElenco, conclusi: { n: number; ricaviCent: number }): PezzoRiga[] {
  const motivo = (g.motivo_problematico ?? '').trim() ? [{ testo: ` · ${MOTIVO_INTERNO}` }] : []
  if (conclusi.n === 0) return [{ testo: `${testoFonte(g)} · ${PRIMA_VOLTA}` }, ...motivo]
  const intera = rigaCliente(g, conclusi.n, conclusi.ricaviCent)
  const i = intera.lastIndexOf(' · ')
  return [{ testo: intera.slice(0, i + 3) }, { testo: intera.slice(i + 3), mat: true }, ...motivo]
}

/** Soggiorni conclusi e speso di ogni cliente, dalle prenotazioni lette una volta sola */
export function conclusiPerCliente(prenotazioni: SoggiornoStorico[], oggi: string): Map<string, { n: number; ricaviCent: number }> {
  const perCliente = new Map<string, SoggiornoStorico[]>()
  for (const b of prenotazioni) {
    if (!b.guest_id) continue
    if (!perCliente.has(b.guest_id)) perCliente.set(b.guest_id, [])
    perCliente.get(b.guest_id)!.push(b)
  }
  const esito = new Map<string, { n: number; ricaviCent: number }>()
  for (const [id, righe] of perCliente) esito.set(id, soggiorniConclusi(righe, oggi))
  return esito
}
