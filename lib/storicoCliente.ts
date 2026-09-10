// ============================================================================
// STORICO DELLA SCHEDA CLIENTE (08/09/2026, sera): una riga per SOGGIORNO,
// dal più recente; ogni riga apre la scheda della prenotazione (il primo
// segmento) e la scheda torna al cliente con «← Indietro». Funzioni pure.
//
// Camere parallele (10/09/2026): una prenotazione può tenere PIÙ camere nelle
// stesse notti. Le tiene insieme `prenotazione_id`; `group_id` resta il cambio
// camera, cioè la stessa linea che si sposta da una camera all'altra. Quindi
// l'identità di un soggiorno è  prenotazione_id || group_id || id  e una riga
// può avere più linee: «Ambra → Lena + Amelia» = una linea che cambia camera
// più una seconda camera in parallelo. Le prenotazioni vecchie, senza
// prenotazione_id, restano com'erano: una linea sola con la freccia.
// Righe di clienti o date che si somigliano NON vanno mai unite: conta solo
// l'identità scritta nei dati.
// ============================================================================
export type SegmentoStorico = {
  id: string
  group_id?: string | null
  prenotazione_id?: string | null
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
  chiave: string          // prenotazione_id, group_id o id
  prenotazioneId: string  // il primo segmento: è la scheda che si apre
  camere: string[]        // nomi in ordine di arrivo, tutte le linee di seguito
  linee?: string[][]      // una voce per linea: dentro, le camere in ordine
  check_in: string        // arrivo più vecchio
  check_out: string       // partenza più lontana (anche se non è dell'ultimo arrivo)
  totaleCent: number
  status: string          // annullata solo se TUTTI i segmenti sono annullati; altrimenti lo stato del primo segmento non annullato
  extra_bed: boolean
  cancelled_reason: string | null
  segmenti: SegmentoStorico[]
}

const nomeCamera = (s: SegmentoStorico) => (s.rooms?.name || '').split(' ').slice(-1)[0] || '?'
const cent = (n: number | string | null | undefined) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) : 0 }

// L'identità del soggiorno: le camere parallele stanno insieme per
// prenotazione_id, il cambio camera per group_id, altrimenti la riga è sola.
export const identitaSoggiorno = (s: SegmentoStorico) => s.prenotazione_id || s.group_id || s.id

// Ordine stabile: prima chi arriva prima, poi chi parte prima, poi l'id.
const perData = (a: SegmentoStorico, b: SegmentoStorico) =>
  a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out) || a.id.localeCompare(b.id)

// Le linee di un soggiorno: `group_id` tiene insieme il cambio camera, ma se
// due segmenti dello stesso gruppo si accavallano nelle date sono camere
// parallele, non una freccia. Le linee restano in ordine di arrivo.
function lineeDi(segmenti: SegmentoStorico[]): SegmentoStorico[][] {
  const gruppi = new Map<string, SegmentoStorico[]>()
  for (const s of [...segmenti].sort(perData)) {
    const k = s.group_id || s.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(s)
  }
  const linee: SegmentoStorico[][] = []
  for (const gruppo of gruppi.values()) {
    const dentro: SegmentoStorico[][] = []
    for (const s of gruppo) {
      // la prima linea che si è già liberata quando questo segmento arriva
      const libera = dentro.find(l => l[l.length - 1].check_out <= s.check_in)
      if (libera) libera.push(s)
      else dentro.push([s])
    }
    linee.push(...dentro)
  }
  return linee.sort((a, b) => perData(a[0], b[0]))
}

export function righeStorico(prenotazioni: SegmentoStorico[]): RigaStorico[] {
  const gruppi = new Map<string, SegmentoStorico[]>()
  for (const b of prenotazioni) {
    const k = identitaSoggiorno(b)
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  const righe: RigaStorico[] = []
  for (const [chiave, segmenti] of gruppi) {
    const ordinati = [...segmenti].sort(perData)
    const validi = ordinati.filter(s => s.status !== 'annullata')
    // Tutta annullata: si conserva com'era, ragione e importo storici compresi.
    const contano = validi.length ? validi : ordinati
    const primo = contano[0]
    const linee = lineeDi(contano).map(l => {
      const nomi: string[] = []
      for (const s of l) { const n = nomeCamera(s); if (nomi[nomi.length - 1] !== n) nomi.push(n) }
      return nomi
    })
    righe.push({
      chiave, prenotazioneId: primo.id, camere: linee.flat(), linee,
      // arrivo minimo e partenza massima dei soli segmenti che contano: le
      // camere parallele possono avere durate diverse e l'ultima partenza non
      // è per forza dell'ultimo arrivo, ma una camera annullata (magari più
      // lunga) non deve allungare le date del soggiorno rimasto
      check_in: contano.reduce((m, s) => (s.check_in < m ? s.check_in : m), contano[0].check_in),
      check_out: contano.reduce((m, s) => (s.check_out > m ? s.check_out : m), contano[0].check_out),
      totaleCent: contano.reduce((s, x) => s + cent(x.total_amount), 0),
      status: validi.length ? primo.status : 'annullata',
      extra_bed: ordinati.some(s => !!s.extra_bed),
      cancelled_reason: validi.length ? null : (ordinati.find(s => s.cancelled_reason)?.cancelled_reason ?? null),
      segmenti: ordinati,
    })
  }
  return righe.sort((a, b) => b.check_in.localeCompare(a.check_in))
}

// «Ambra → Lena» per un cambio camera, «Ambra + Amelia» per due camere nelle
// stesse notti, «Ambra → Lena + Amelia» quando ci sono tutte e due le cose.
export const testoCamere = (r: RigaStorico) =>
  (r.linee && r.linee.length ? r.linee : [r.camere]).map(l => l.join(' → ')).join(' + ')
