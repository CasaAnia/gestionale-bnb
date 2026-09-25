// Statistiche approvate da Ania il 25/09/2026, sui dati confermati: una
// riga = un intervento nella sua data effettiva. Ogni totale dichiara su
// quanti interventi è documentato; «non annotato» non diventa mai zero e i
// dati dello storico senza misura restano in una riga a parte.
import { VOCI_DOTAZIONE, pezziVuoti, totalePezzi, assettoDaSql, pezziDaSql, recuperoDaRiga, dotazioneDaAssetto, type AssettoPulizia, type PezziPulizie, type SenzaMisura, type TipoIntervento } from './dotazionePulizie.ts'

export type InterventoStat = {
  id: string; roomId: string; data: string; tipo: TipoIntervento
  assetto: AssettoPulizia | null; dotazione: PezziPulizie | null
  recuperi: PezziPulizie | null; senzaMisura: SenzaMisura; minuti: number | null
}
type RigaCleaning = { id?: string; room_id: string; tipo: TipoIntervento; stato: string; data_prevista: string; data_effettiva?: string | null; assetto?: unknown; dotazione?: unknown; minuti?: number | null }

// Dalla tabella: pulizia confermata + la sua riga di recupero (se annotata).
export function interventiDaTabelle(cleanings: RigaCleaning[], recuperi: Record<string, unknown>[] | null): InterventoStat[] {
  const perId = new Map((recuperi ?? []).map(r => [String(r.cleaning_id), r]))
  return cleanings.filter(c => c.stato === 'fatta' && c.id).map(c => {
    const assetto = assettoDaSql(c.assetto)
    const salvata = pezziDaSql(c.dotazione)
    // La fotografia salvata comanda; se manca ma i letti ci sono, si ricava con la stessa regola.
    const dotazione = salvata ?? (assetto ? dotazioneDaAssetto(assetto) : null)
    const rec = recuperi === null ? null : recuperoDaRiga(perId.get(c.id!) ?? null)
    return { id: c.id!, roomId: c.room_id, data: c.data_effettiva || c.data_prevista, tipo: c.tipo,
      assetto, dotazione, recuperi: rec?.pezzi ?? null, senzaMisura: rec?.senzaMisura ?? { lenzuolo_sotto: 0, lenzuolo_sopra: 0 },
      minuti: Number.isInteger(c.minuti) && Number(c.minuti) > 0 ? Number(c.minuti) : null }
  })
}

export function statistichePulizie(tutti: InterventoStat[], da: string, aEsclusa: string, roomId = '') {
  const visti = new Set<string>()
  const doppi: string[] = []
  const righe = tutti.filter(r => {
    if (visti.has(r.id)) { doppi.push(r.id); return false }
    visti.add(r.id)
    return r.data >= da && r.data < aEsclusa && (!roomId || r.roomId === roomId)
  })
  const dotazione = pezziVuoti(), recuperi = pezziVuoti(), lavaggio = pezziVuoti()
  let matrimoniali = 0, singoli = 0, completi = 0, minuti = 0, conDurata = 0, conAssetto = 0, conRecuperi = 0, conLavaggio = 0
  let senzaMisuraSotto = 0, senzaMisuraSopra = 0
  const daCorreggere: string[] = []
  for (const r of righe) {
    if (r.assetto) { conAssetto++; matrimoniali += r.assetto.matrimoniali; singoli += r.assetto.singoli; completi += r.assetto.ospiti }
    if (r.minuti !== null) { minuti += r.minuti; conDurata++ }
    if (r.dotazione) for (const [k] of VOCI_DOTAZIONE) dotazione[k] += r.dotazione[k]
    if (r.recuperi) { conRecuperi++; for (const [k] of VOCI_DOTAZIONE) recuperi[k] += r.recuperi[k] }
    senzaMisuraSotto += r.senzaMisura.lenzuolo_sotto; senzaMisuraSopra += r.senzaMisura.lenzuolo_sopra
    if (r.dotazione && r.recuperi) {
      const oltre = VOCI_DOTAZIONE.some(([k]) => r.recuperi![k] > r.dotazione![k])
      if (oltre) { daCorreggere.push(r.id); continue }
      // Con lenzuola senza misura il bucato di quell'intervento non è certo.
      if (r.senzaMisura.lenzuolo_sotto + r.senzaMisura.lenzuolo_sopra > 0) continue
      conLavaggio++
      for (const [k] of VOCI_DOTAZIONE) lavaggio[k] += r.dotazione[k] - r.recuperi[k]
    }
  }
  const tipi = (['fine_soggiorno', 'soggiorno', 'cambio_camera'] as const).map(tipo => ({ tipo, n: righe.filter(r => r.tipo === tipo).length }))
  // Dotazione e lavaggio si confrontano solo sugli stessi interventi: la
  // percentuale esiste solo se TUTTI gli interventi hanno il bilancio completo.
  const dotazioneBilancio = pezziVuoti(), recuperiBilancio = pezziVuoti()
  for (const r of righe) if (r.dotazione && r.recuperi) for (const [k] of VOCI_DOTAZIONE) { dotazioneBilancio[k] += r.dotazione[k]; recuperiBilancio[k] += r.recuperi[k] }
  const completo = righe.length > 0 && conLavaggio === righe.length && totalePezzi(dotazioneBilancio) > 0
  return {
    righe, interventi: righe.length, perTipo: tipi, camereDistinte: new Set(righe.map(r => r.roomId)).size,
    matrimoniali, singoli, completi, dotazione, recuperi, lavaggio,
    senzaMisura: { lenzuolo_sotto: senzaMisuraSotto, lenzuolo_sopra: senzaMisuraSopra },
    minuti, conDurata, conAssetto, conRecuperi, conLavaggio,
    minutiMedi: conDurata ? minuti / conDurata : null,
    percentualeRecupero: completo ? totalePezzi(recuperiBilancio) / totalePezzi(dotazioneBilancio) * 100 : null,
    daCorreggere, doppi,
  }
}

export const oreMinuti = (n: number) => `${Math.floor(n / 60)} h ${n % 60} min`

// Esportazione: una riga per intervento confermato, con dotazione e recuperi
// per articolo; vuoto = non annotato (mai uno zero inventato).
export function csvInterventi(righe: InterventoStat[], nomeCamera: (roomId: string) => string): string {
  const TIPI = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
  const tabella: (string | number | null)[][] = [['Data', 'Camera', 'Tipo', 'Matrimoniali', 'Singoli', 'Completi asciugamani', 'Minuti',
    ...VOCI_DOTAZIONE.map(([, l]) => `Dotazione ${l.toLowerCase()}`), ...VOCI_DOTAZIONE.map(([, l]) => `Recuperati ${l.toLowerCase()}`), 'Lenzuola senza misura recuperate', 'ID pulizia']]
  for (const r of [...righe].sort((a, b) => a.data.localeCompare(b.data))) tabella.push([r.data, nomeCamera(r.roomId), TIPI[r.tipo], r.assetto?.matrimoniali ?? null, r.assetto?.singoli ?? null, r.assetto?.ospiti ?? null, r.minuti,
    ...VOCI_DOTAZIONE.map(([k]) => r.dotazione ? r.dotazione[k] : null), ...VOCI_DOTAZIONE.map(([k]) => r.recuperi ? r.recuperi[k] : null),
    r.recuperi ? r.senzaMisura.lenzuolo_sotto + r.senzaMisura.lenzuolo_sopra : null, r.id])
  return '﻿' + tabella.map(r => r.map(v => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(';')).join('\r\n')
}
