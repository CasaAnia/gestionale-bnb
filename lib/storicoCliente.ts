// ============================================================================
// STORICO DELLA SCHEDA CLIENTE (08/09/2026, sera): una riga per SOGGIORNO
// (group_id, cambio camera = una riga sola con le camere elencate), dal più
// recente; ogni riga apre la scheda della prenotazione (il primo segmento) e
// la scheda torna al cliente con «← Indietro». Funzioni pure.
// ============================================================================
export type SegmentoStorico = {
  id: string
  group_id?: string | null
  check_in: string
  check_out: string
  status: string
  total_amount?: number | string | null
  rooms?: { name?: string | null } | null
  extra_bed?: boolean | null
  cancelled_reason?: string | null
  check_in_time?: string | null
  shuttle?: string | null
}
export type RigaStorico = {
  chiave: string          // group_id o id
  prenotazioneId: string  // il primo segmento: è la scheda che si apre
  camere: string[]        // nomi in ordine di arrivo (cambio camera: più di uno)
  check_in: string
  check_out: string
  totaleCent: number
  status: string          // annullata solo se TUTTI i segmenti sono annullati; altrimenti lo stato del primo segmento non annullato
  extra_bed: boolean
  cancelled_reason: string | null
  segmenti: SegmentoStorico[]
}

const nomeCamera = (s: SegmentoStorico) => (s.rooms?.name || '').split(' ').slice(-1)[0] || '?'
const cent = (n: number | string | null | undefined) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) : 0 }

export function righeStorico(prenotazioni: SegmentoStorico[]): RigaStorico[] {
  const gruppi = new Map<string, SegmentoStorico[]>()
  for (const b of prenotazioni) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  const righe: RigaStorico[] = []
  for (const [chiave, segmenti] of gruppi) {
    const ordinati = [...segmenti].sort((a, b) => a.check_in.localeCompare(b.check_in))
    const validi = ordinati.filter(s => s.status !== 'annullata')
    const primo = validi[0] ?? ordinati[0]
    const camere: string[] = []
    for (const s of (validi.length ? validi : ordinati)) { const n = nomeCamera(s); if (camere[camere.length - 1] !== n) camere.push(n) }
    righe.push({
      chiave, prenotazioneId: primo.id, camere,
      check_in: ordinati[0].check_in, check_out: ordinati[ordinati.length - 1].check_out,
      totaleCent: (validi.length ? validi : ordinati).reduce((s, x) => s + cent(x.total_amount), 0),
      status: validi.length ? primo.status : 'annullata',
      extra_bed: ordinati.some(s => !!s.extra_bed),
      cancelled_reason: validi.length ? null : (ordinati.find(s => s.cancelled_reason)?.cancelled_reason ?? null),
      segmenti: ordinati,
    })
  }
  return righe.sort((a, b) => b.check_in.localeCompare(a.check_in))
}

// «Ambra → Lena» per un cambio camera, «Ambra» altrimenti
export const testoCamere = (r: RigaStorico) => r.camere.join(' → ')
