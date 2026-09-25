// Regole approvate da Ania il 25/09/2026. Funzioni pure: nessuna lettura
// della prenotazione durante il riepilogo di una pulizia già registrata.
export const VOCI_DOTAZIONE = [
  ['sotto_matrimoniale', 'Lenzuola sotto matrimoniali'],
  ['sopra_matrimoniale', 'Lenzuola sopra matrimoniali'],
  ['sotto_singolo', 'Lenzuola sotto singole'],
  ['sopra_singolo', 'Lenzuola sopra singole'],
  ['federe', 'Federe'], ['telo_doccia', 'Teli doccia'],
  ['asciugamano_viso', 'Asciugamani viso'], ['asciugamano_mani', 'Asciugamani mani'],
  ['tappeto_bagno', 'Tappeti bagno'], ['scendidoccia', 'Scendidoccia'],
] as const
export type VoceDotazione = typeof VOCI_DOTAZIONE[number][0]
export type PezziPulizie = Record<VoceDotazione, number>
export type AssettoPulizia = { matrimoniali: number; singoli: number; ospiti: number; federeMatrimoniale: 2 | 4 }
export type TipoIntervento = 'fine_soggiorno' | 'soggiorno' | 'cambio_camera'
export type RegistrazionePulizia = {
  id: string; camera: string; data: string; tipo: TipoIntervento
  // Null per dati storici non documentati: mai ricostruiti come certi.
  assetto: AssettoPulizia | null; dotazione: PezziPulizie | null
  recuperi: PezziPulizie | null; minuti: number | null
}
const intero = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
export function pezziVuoti(): PezziPulizie {
  return Object.fromEntries(VOCI_DOTAZIONE.map(([k]) => [k, 0])) as PezziPulizie
}
export function validaAssetto(a: AssettoPulizia): string | null {
  if (!intero(a.matrimoniali, 0, 1) || !intero(a.singoli, 0, 2) || a.matrimoniali + a.singoli === 0) return 'Controlla i letti preparati.'
  if (!intero(a.ospiti, 1, 4) || a.ospiti > a.matrimoniali * 2 + a.singoli) return 'Gli ospiti superano i posti dei letti preparati.'
  if (![2, 4].includes(a.federeMatrimoniale)) return 'Scegli due o quattro federe per il matrimoniale.'
  return null
}
// Proposta iniziale, sempre correggibile prima della conferma. Il letto
// aggiuntivo con due persone conta anche se non è necessario alla capienza.
export function proponiAssetto(camera: string, ospiti: number, lettoAggiuntivo: boolean, federeUsoSingolo?: 2 | 4): AssettoPulizia | null {
  if (!['Amelia', 'Allegra', 'Ambra', 'Lena'].includes(camera) || !intero(ospiti, 1, 4)) return null
  if (camera === 'Amelia') {
    if (ospiti > 2) return null
    return { matrimoniali: 0, singoli: ospiti === 2 || lettoAggiuntivo ? 2 : 1, ospiti, federeMatrimoniale: 4 }
  }
  if (camera !== 'Lena' && ospiti > 3) return null
  if (ospiti === 1 && federeUsoSingolo === undefined) return null
  return { matrimoniali: 1, singoli: Math.max(ospiti - 2, lettoAggiuntivo ? 1 : 0, 0), ospiti, federeMatrimoniale: ospiti === 1 ? federeUsoSingolo! : 4 }
}
export function dotazioneDaAssetto(a: AssettoPulizia): PezziPulizie {
  const errore = validaAssetto(a); if (errore) throw new Error(errore)
  return { sotto_matrimoniale: a.matrimoniali, sopra_matrimoniale: a.matrimoniali,
    sotto_singolo: a.singoli, sopra_singolo: a.singoli,
    federe: a.matrimoniali * a.federeMatrimoniale + a.singoli * 2,
    telo_doccia: a.ospiti, asciugamano_viso: a.ospiti, asciugamano_mani: a.ospiti,
    tappeto_bagno: 1, scendidoccia: 1 }
}
export function totalePezzi(p: PezziPulizie): number {
  return VOCI_DOTAZIONE.reduce((n, [k]) => n + p[k], 0)
}
export function validaPezzi(p: PezziPulizie): string | null {
  return VOCI_DOTAZIONE.some(([k]) => !intero(p[k], 0, 100)) ? 'Le quantità devono essere numeri interi, non negativi.' : null
}
export function daLavare(dotazione: PezziPulizie, recuperi: PezziPulizie): PezziPulizie {
  if (validaPezzi(dotazione) || validaPezzi(recuperi)) throw new Error('Quantità non valide.')
  const risultato = pezziVuoti()
  for (const [k] of VOCI_DOTAZIONE) {
    if (recuperi[k] > dotazione[k]) throw new Error('Il recupero supera la dotazione: controlla i letti e i pezzi preparati.')
    risultato[k] = dotazione[k] - recuperi[k]
  }
  return risultato
}
export function fotografaPulizia(r: RegistrazionePulizia): RegistrazionePulizia {
  if (!r.id || !r.camera || !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || !['fine_soggiorno', 'soggiorno', 'cambio_camera'].includes(r.tipo)) throw new Error('Pulizia non valida.')
  const d = new Date(`${r.data}T12:00:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== r.data) throw new Error('Data non valida.')
  if (r.minuti !== null && !intero(r.minuti, 1, 1440)) throw new Error('Inserisci i minuti effettivi oppure lascia il campo vuoto.')
  if (r.assetto && validaAssetto(r.assetto)) throw new Error(validaAssetto(r.assetto)!)
  if (r.dotazione && validaPezzi(r.dotazione)) throw new Error('Dotazione non valida.')
  if (r.recuperi && validaPezzi(r.recuperi)) throw new Error('Recuperi non validi.')
  if (r.assetto && r.dotazione) {
    const attesa = dotazioneDaAssetto(r.assetto)
    if (VOCI_DOTAZIONE.some(([k]) => attesa[k] !== r.dotazione![k])) throw new Error('Dotazione e letti preparati non coincidono.')
  }
  if (r.dotazione && r.recuperi) daLavare(r.dotazione, r.recuperi)
  return structuredClone(r)
}
export function salvaNelRegistro(registro: RegistrazionePulizia[], r: RegistrazionePulizia): RegistrazionePulizia[] {
  const copia = fotografaPulizia(r)
  return [...registro.filter(x => x.id !== copia.id), copia]
}
export function riepilogoDotazione(registro: RegistrazionePulizia[], da: string, a: string) {
  const perId = new Map<string, RegistrazionePulizia>()
  for (const r of registro) {
    if (perId.has(r.id)) throw new Error('Pulizia duplicata nel registro: rileggere prima di mostrare i totali.')
    perId.set(r.id, fotografaPulizia(r))
  }
  const righe = [...perId.values()].filter(r => r.data >= da && r.data < a)
  const dotazione = pezziVuoti(), recuperi = pezziVuoti(), lavaggio = pezziVuoti()
  let matrimoniali = 0, singoli = 0, completiAsciugamani = 0, minuti = 0, conDurata = 0, conAssetto = 0, conRecuperi = 0, conLavaggio = 0
  for (const r of righe) {
    if (r.assetto) { conAssetto++; matrimoniali += r.assetto.matrimoniali; singoli += r.assetto.singoli; completiAsciugamani += r.assetto.ospiti }
    if (r.minuti !== null) { minuti += r.minuti; conDurata++ }
    if (r.recuperi) { conRecuperi++; for (const [k] of VOCI_DOTAZIONE) recuperi[k] += r.recuperi[k] }
    if (r.dotazione) for (const [k] of VOCI_DOTAZIONE) dotazione[k] += r.dotazione[k]
    if (r.dotazione && r.recuperi) { conLavaggio++; const l = daLavare(r.dotazione, r.recuperi); for (const [k] of VOCI_DOTAZIONE) lavaggio[k] += l[k] }
  }
  return { righe, interventi: righe.length, camereDistinte: new Set(righe.map(r => r.camera)).size,
    matrimoniali, singoli, completiAsciugamani, dotazione, recuperi, lavaggio,
    minuti, conDurata, conAssetto, conRecuperi, conLavaggio,
    minutiMedi: conDurata ? minuti / conDurata : null,
    percentualeRecupero: conLavaggio === righe.length && totalePezzi(dotazione) > 0 ? totalePezzi(recuperi) / totalePezzi(dotazione) * 100 : null }
}

// ── Salvataggio centrale (proposta 0059) ────────────────────────────────────
// Stessi nomi delle colonne: cleanings.assetto/dotazione e le misure di
// biancheria_recuperata. Lo scendidoccia usa la colonna tappetino_doccia di
// sempre; lenzuolo_sotto/lenzuolo_sopra restano lo storico SENZA misura.
export type AssettoSql = { matrimoniali: number; singoli: number; ospiti: number; federe_matrimoniale: 2 | 4 }
export type SenzaMisura = { lenzuolo_sotto: number; lenzuolo_sopra: number }
export type RecuperoSql = PezziPulizie & SenzaMisura

export const assettoPerSql = (a: AssettoPulizia): AssettoSql => ({ matrimoniali: a.matrimoniali, singoli: a.singoli, ospiti: a.ospiti, federe_matrimoniale: a.federeMatrimoniale })
export function assettoDaSql(a: unknown): AssettoPulizia | null {
  const x = a as Partial<AssettoSql> | null
  if (!x || typeof x !== 'object') return null
  const assetto = { matrimoniali: Number(x.matrimoniali), singoli: Number(x.singoli), ospiti: Number(x.ospiti), federeMatrimoniale: Number(x.federe_matrimoniale) as 2 | 4 }
  return validaAssetto(assetto) ? null : assetto
}
export function pezziDaSql(p: unknown): PezziPulizie | null {
  if (!p || typeof p !== 'object') return null
  const out = pezziVuoti()
  for (const [k] of VOCI_DOTAZIONE) { const n = Number((p as Record<string, unknown>)[k]); if (!Number.isInteger(n) || n < 0) return null; out[k] = n }
  return out
}
// Riga di biancheria_recuperata → recuperi per misura + storico senza misura.
// Nessun valore si perde: quello che non ha misura resta separato.
export function recuperoDaRiga(r: Record<string, unknown> | null | undefined): { pezzi: PezziPulizie; senzaMisura: SenzaMisura } | null {
  if (!r) return null
  const n = (k: string) => { const v = Math.floor(Number(r[k] ?? 0)); return Number.isFinite(v) && v > 0 ? v : 0 }
  return {
    pezzi: { sotto_matrimoniale: n('sotto_matrimoniale'), sopra_matrimoniale: n('sopra_matrimoniale'), sotto_singolo: n('sotto_singolo'), sopra_singolo: n('sopra_singolo'),
      federe: n('federe'), telo_doccia: n('telo_doccia'), asciugamano_viso: n('asciugamano_viso'), asciugamano_mani: n('asciugamano_mani'),
      tappeto_bagno: n('tappeto_bagno'), scendidoccia: n('tappetino_doccia') },
    senzaMisura: { lenzuolo_sotto: n('lenzuolo_sotto'), lenzuolo_sopra: n('lenzuolo_sopra') },
  }
}
export const recuperoPerSql = (p: PezziPulizie, s: SenzaMisura): RecuperoSql => ({ ...p, ...s })
export const totaleSenzaMisura = (s: SenzaMisura | null | undefined) => (s?.lenzuolo_sotto ?? 0) + (s?.lenzuolo_sopra ?? 0)

// Articoli recuperati oltre la dotazione (dati di prima o letti corretti):
// si mostrano e si chiede di correggerli, mai azzerati in silenzio.
export function recuperiOltre(dotazione: PezziPulizie, recuperi: PezziPulizie, s: SenzaMisura = { lenzuolo_sotto: 0, lenzuolo_sopra: 0 }): string[] {
  const oltre = VOCI_DOTAZIONE.filter(([k]) => recuperi[k] > dotazione[k]).map(([, l]) => l)
  if (recuperi.sotto_matrimoniale + recuperi.sotto_singolo + s.lenzuolo_sotto > dotazione.sotto_matrimoniale + dotazione.sotto_singolo
    || recuperi.sopra_matrimoniale + recuperi.sopra_singolo + s.lenzuolo_sopra > dotazione.sopra_matrimoniale + dotazione.sopra_singolo) oltre.push('Lenzuola senza misura')
  return [...new Set(oltre)]
}

// Proposta dai dati del soggiorno che si pulisce: gli ospiti della
// prenotazione e il letto aggiuntivo della NOTTE appena passata (quella dei
// letti che si disfano), non il flag di oggi. Senza dati certi: null.
export function nottePulita(checkIn: string, checkOut: string, giorno: string): string {
  const prima = new Date(Date.parse(`${giorno}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const ultima = new Date(Date.parse(`${checkOut}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
  return prima < checkIn ? checkIn : prima > ultima ? ultima : prima
}
export function proponiAssettoDaSoggiorno(camera: string, b: { check_in: string; check_out: string; num_guests?: unknown; extra_bed?: unknown; extra_bed_dates?: unknown }, giorno: string, ospitiFotografati?: number | null): AssettoPulizia | null {
  const ospiti = Number(ospitiFotografati ?? b.num_guests)
  if (!Number.isInteger(ospiti) || ospiti < 1) return null
  const date = Array.isArray(b.extra_bed_dates) ? b.extra_bed_dates.map(String) : []
  const letto = date.length > 0 ? date.includes(nottePulita(b.check_in, b.check_out, giorno)) : !!b.extra_bed
  return proponiAssetto(camera, ospiti, letto, 4)
}
