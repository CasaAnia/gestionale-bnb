import { giorniSoggiorno } from './prezzoNotti.ts'

type SegmentoPeriodo = {
  check_in: string
  check_out: string
  num_guests?: number | string | null
  status?: string | null
}

/** Le notti realmente prenotate: una pausa non è soggiorno né cambio camera.
 * Camere contemporanee occupano le stesse notti, con ospiti sommati per notte. */
export function riepilogoPeriodi(segmenti: SegmentoPeriodo[]) {
  const attivi = segmenti.filter(s => s.status !== 'annullata').sort((a, b) => a.check_in.localeCompare(b.check_in))
  const periodi: { arrivo: string; partenza: string }[] = []
  const persone = new Map<string, number>()
  for (const s of attivi) {
    const giorni = giorniSoggiorno(s.check_in, s.check_out)
    if (!giorni.length) continue
    const ultimo = periodi.at(-1)
    if (!ultimo || s.check_in > ultimo.partenza) periodi.push({ arrivo: s.check_in, partenza: s.check_out })
    else if (s.check_out > ultimo.partenza) ultimo.partenza = s.check_out
    for (const g of giorni) persone.set(g, (persone.get(g) ?? 0) + (Number(s.num_guests) || 1))
  }
  return {
    periodi,
    separati: periodi.length > 1,
    notti: persone.size,
    ospiti: persone.size ? Math.max(...persone.values()) : 0,
    ospitiVariabili: new Set(persone.values()).size > 1,
  }
}
