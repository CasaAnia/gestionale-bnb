// ============================================================================
// LE CAMERE TENUTE, SUL CALENDARIO (15/09/2026, richiesta di Ania)
//
// Quando parte una proposta la camera resta tenuta — tre ore per chi paga
// all'arrivo, ventiquattro per chi deve mandare caparra o saldo. Fino a oggi
// il calendario non lo diceva: la riga restava vuota e, al telefono, quella
// camera sembrava libera. Da qui nascono le barre tratteggiate.
//
// Ania: «se sono al telefono e vedo la barra bianca so che la risposta arriva
// in poche ore; se vedo quella a righine so che può volerci un giorno».
//
// Solo regole pure: chi legge il database sta nella pagina del calendario.
// ============================================================================
import { scadenzaOpzione, oraRoma, pagaInAnticipo, type RichiestaOpzione } from './opzioni.ts'
import { nomeCompleto } from './richieste.ts'
import { giorniTra } from './disponibilita.ts'

/** Un segmento proposto, come lo salva la proposta (lib/richiesteProposta) */
export type SegmentoTenuto = {
  camera?: { id?: string | null; name?: string | null } | null
  arrivo?: string | null
  partenza?: string | null
  lettoNotti?: string[] | null
  personeNotti?: number[] | null
  totale?: number | null
  prezzoNotte?: number | null
}

export type RichiestaTenuta = Omit<RichiestaOpzione, 'proposta_soluzione' | 'proposta_alternative'> & {
  proposta_soluzione?: { segmenti?: SegmentoTenuto[] | null } | null
  proposta_alternative?: ({ segmenti?: SegmentoTenuto[] | null } | null)[] | null
  telefono?: string | null
}

/** Una barra tratteggiata da disegnare su una riga del calendario */
export type BarraTenuta = {
  richiestaId: string
  ospite: string
  telefono: string | null
  cameraId: string
  cameraNome: string
  arrivo: string
  partenza: string
  notti: string[]
  lettoNotti: string[]
  persone: number
  prezzo: number | null
  scadenza: Date
  scaduta: boolean
  /** true = paga in anticipo: barra a righine, tenuta 24 ore */
  anticipato: boolean
  condizione: string | null
  /** la camera è una delle alternative proposte, non la soluzione principale */
  alternativa: boolean
}

const segmentiDi = (r: RichiestaTenuta) => [
  ...(r.proposta_soluzione?.segmenti ?? []).map(s => ({ s, alternativa: false })),
  ...(r.proposta_alternative ?? []).flatMap(a => (a?.segmenti ?? []).map(s => ({ s, alternativa: true }))),
]

function barreDi(r: RichiestaTenuta, scadenza: Date, adesso: Date): BarraTenuta[] {
  const viste = new Set<string>()
  const barre: BarraTenuta[] = []
  for (const { s, alternativa } of segmentiDi(r)) {
    const cameraId = s?.camera?.id
    if (!cameraId || !s.arrivo || !s.partenza || s.arrivo >= s.partenza) continue
    const chiave = `${cameraId}|${s.arrivo}|${s.partenza}`
    if (viste.has(chiave)) continue
    viste.add(chiave)
    barre.push({
      richiestaId: r.id,
      ospite: nomeCompleto(r),
      telefono: r.telefono ?? null,
      cameraId,
      cameraNome: s.camera?.name ?? '',
      arrivo: s.arrivo,
      partenza: s.partenza,
      notti: giorniTra(s.arrivo, s.partenza),
      lettoNotti: (s.lettoNotti ?? []).filter((g): g is string => typeof g === 'string'),
      persone: Math.max(1, ...(s.personeNotti ?? [1]).map(n => Number(n) || 1)),
      prezzo: s.totale == null ? null : Number(s.totale),
      scadenza,
      scaduta: scadenza.getTime() <= adesso.getTime(),
      anticipato: pagaInAnticipo(r.condizione_pagamento),
      condizione: r.condizione_pagamento ?? null,
      alternativa,
    })
  }
  return barre
}

/**
 * Tutte le camere tenute da una proposta ancora aperta: quelle ancora valide e
 * quelle appena scadute. Le scadute restano finché il controllo automatico non
 * chiude la richiesta (24 ore dopo), e si vedono smorzate: dicono ad Ania che
 * quella camera era promessa a qualcuno, e che adesso può darla.
 */
export function barreTenute(richieste: RichiestaTenuta[], adesso: Date): BarraTenuta[] {
  const barre: BarraTenuta[] = []
  for (const r of richieste) {
    const scadenza = scadenzaOpzione(r)
    if (!scadenza) continue
    barre.push(...barreDi(r, scadenza, adesso))
  }
  return barre
}

/** Le barre di una camera sola, in ordine di arrivo */
export const barrePerCamera = (barre: BarraTenuta[], cameraId: string): BarraTenuta[] =>
  barre.filter(b => b.cameraId === cameraId).sort((x, y) => x.arrivo.localeCompare(y.arrivo))

/**
 * I letti in più TENUTI per ogni notte: vanno nella riga «🛏 extra» accanto a
 * quelli già prenotati, ma dentro un riquadro tratteggiato — sono promessi,
 * non ancora impegnati. Le camere alternative non si contano due volte: se lo
 * stesso cliente ha due camere proposte per la stessa notte, il letto è uno.
 */
export function lettiTenutiPerNotte(barre: BarraTenuta[]): Map<string, number> {
  const perNotte = new Map<string, Set<string>>()
  for (const b of barre) {
    if (b.scaduta) continue
    for (const g of b.lettoNotti) {
      if (!perNotte.has(g)) perNotte.set(g, new Set())
      perNotte.get(g)!.add(b.richiestaId)
    }
  }
  return new Map([...perNotte].map(([g, chi]) => [g, chi.size]))
}

/** «tenuta fino alle 16:40» oppure «tenuta scaduta 40 minuti fa» */
export function testoTenuta(barra: BarraTenuta, adesso: Date): string {
  if (!barra.scaduta) return `tenuta fino alle ${oraRoma(barra.scadenza)}`
  const minuti = Math.max(1, Math.round((adesso.getTime() - barra.scadenza.getTime()) / 60000))
  if (minuti < 60) return `tenuta scaduta ${minuti} ${minuti === 1 ? 'minuto' : 'minuti'} fa`
  const ore = Math.round(minuti / 60)
  if (ore < 24) return `tenuta scaduta ${ore} ${ore === 1 ? 'ora' : 'ore'} fa`
  const giorni = Math.round(ore / 24)
  return `tenuta scaduta ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa`
}

/** Come doveva pagare, in parole: va sotto il nome nel foglietto */
export function comeDovevaPagare(barra: BarraTenuta): string {
  if (barra.condizione === 'caparra') return 'caparra in anticipo'
  if (barra.condizione === 'completo') return 'pagamento completo in anticipo'
  if (barra.condizione === 'personalizzata') return 'accordo personalizzato, in anticipo'
  return "paga all'arrivo"
}

/** La scritta piccola dentro la barra: il letto e fino a quando è tenuta */
export function segniDellaBarra(barra: BarraTenuta): string {
  const letto = barra.lettoNotti.length > 0 ? '🛏 · ' : ''
  if (barra.scaduta) return `${letto}scaduta`
  return `${letto}fino alle ${oraRoma(barra.scadenza)}`
}
