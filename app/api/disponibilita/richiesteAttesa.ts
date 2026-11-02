// Richieste IN ATTESA sull'endpoint di disponibilità (Ania, 02/11/2026).
// Logica pura, senza Supabase: la route legge le righe e passa di qui.
//
// Quali richieste contano: quelle con stato aperto (lib/richieste.STATI_APERTI:
// 'in_attesa' e 'proposta_inviata'). Confermate, rifiutate e chiuse (scadute
// o rifiutate) sono escluse a monte dalla query e ricontrollate qui.
//
// A quali camere e notti si collegano: la stessa regola del nastro delle
// Richieste (lib/richiesteNastro.postiRichiesta):
//  · proposta inviata → le camere e i periodi dei segmenti della proposta
//    (soluzione + alternative, senza doppioni), anche con cambio camera;
//  · altrimenti, camera preferita → le notti della richiesta su quella camera
//    (notti_richieste se presenti, altrimenti da arrivo a partenza esclusa);
//  · altrimenti → richiesta «senza camera»: solo date e persone.
// Nessun nome, telefono, nota o importo esce da qui: i tipi non li prevedono.
// Percorsi relativi con .ts, come fanno i file di lib: così il file di prova
// accanto gira con `node --test` senza passare da Next.
import { STATI_APERTI, type StatoRichiesta } from '../../../lib/richieste.ts'
import { nottiDellaRichiesta } from '../../../lib/nottiRichieste.ts'
import { giorniTra } from '../../../lib/disponibilita.ts'

type Segmento = { camera?: { id?: string | null } | null; arrivo?: string | null; partenza?: string | null }
export type RichiestaAttesa = {
  id: string
  stato: string
  arrivo: string
  partenza: string
  persone: number | string | null
  camera_id: string | null
  notti_richieste?: string[] | null
  proposta_soluzione?: { segmenti?: Segmento[] | null } | null
  proposta_alternative?: ({ segmenti?: Segmento[] | null } | null)[] | null
}
export type SenzaCamera = { dal: string; al: string; persone: number }
export type EsitoAttesa = {
  perCamera: Map<string, Set<string>>   // id camera → notti (ISO) con richiesta in attesa
  senzaCamera: SenzaCamera[]
}

export const eInAttesa = (stato: string) => (STATI_APERTI as string[]).includes(stato as StatoRichiesta)

// Le camere proposte in una proposta inviata (soluzione e alternative, senza doppioni)
function tratti(r: RichiestaAttesa): { cameraId: string; notti: string[] }[] {
  const tutti = [...(r.proposta_soluzione?.segmenti ?? []), ...(r.proposta_alternative ?? []).flatMap(a => a?.segmenti ?? [])]
  const visti = new Set<string>()
  const out: { cameraId: string; notti: string[] }[] = []
  for (const s of tutti) {
    const id = s?.camera?.id
    if (!id || !s.arrivo || !s.partenza || s.arrivo >= s.partenza) continue
    const k = `${id}|${s.arrivo}|${s.partenza}`
    if (visti.has(k)) continue
    visti.add(k)
    out.push({ cameraId: id, notti: giorniTra(s.arrivo, s.partenza) })
  }
  return out
}

function nottiSicure(r: RichiestaAttesa): string[] {
  try { return nottiDellaRichiesta(r) } catch { return giorniTra(r.arrivo, r.partenza) }
}

// Dove sta la richiesta: per camera (id → notti) oppure senza camera.
export function postiInAttesa(r: RichiestaAttesa): { perCamera: { cameraId: string; notti: string[] }[]; senzaCamera: boolean } {
  if (r.stato === 'proposta_inviata') {
    const t = tratti(r)
    if (t.length > 0) return { perCamera: t, senzaCamera: false }
  }
  const notti = nottiSicure(r)
  if (notti.length === 0) return { perCamera: [], senzaCamera: false }
  if (r.camera_id) return { perCamera: [{ cameraId: r.camera_id, notti }], senzaCamera: false }
  return { perCamera: [], senzaCamera: true }
}

// Tutte le richieste in attesa che toccano l'intervallo: notti per camera
// (solo quelle dentro l'intervallo) e richieste senza camera (con le LORO date).
export function richiesteInAttesa(richieste: RichiestaAttesa[], nottiIntervallo: string[]): EsitoAttesa {
  const dentro = new Set(nottiIntervallo)
  const perCamera = new Map<string, Set<string>>()
  const senzaCamera: SenzaCamera[] = []
  for (const r of richieste) {
    if (!eInAttesa(r.stato)) continue
    const posti = postiInAttesa(r)
    for (const p of posti.perCamera) {
      const notti = p.notti.filter(n => dentro.has(n))
      if (notti.length === 0) continue
      if (!perCamera.has(p.cameraId)) perCamera.set(p.cameraId, new Set())
      for (const n of notti) perCamera.get(p.cameraId)!.add(n)
    }
    if (posti.senzaCamera && nottiSicure(r).some(n => dentro.has(n))) {
      senzaCamera.push({ dal: r.arrivo, al: r.partenza, persone: Math.max(1, Number(r.persone) || 1) })
    }
  }
  senzaCamera.sort((a, b) => a.dal.localeCompare(b.dal) || a.al.localeCompare(b.al))
  return { perCamera, senzaCamera }
}

export function nottiOrdinate(esito: EsitoAttesa, cameraId: string): string[] {
  return [...(esito.perCamera.get(cameraId) ?? [])].sort()
}
