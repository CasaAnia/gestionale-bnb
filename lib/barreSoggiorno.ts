// Modello soltanto visivo: le righe originali restano separate per salvare
// ospiti e prezzi delle singole notti. Si raggruppa prima del filtro date.
import { nottiLettoExtra } from './lettiAggiuntivi.ts'
type Tratto = {
  id: string; room_id: string; group_id?: string | null; check_in: string; check_out: string
  status?: string | null; num_guests?: number | string | null; total_amount?: number | string | null
  pagato?: boolean | null; extra_bed?: boolean | null; extra_bed_dates?: string[] | null
}
export type BarraSoggiorno<T> = T & { trattiBarra?: T[]; ospitiPeriodo?: string }
export function barreSoggiorno<T extends Tratto>(righe: T[]): BarraSoggiorno<T>[] {
  const gruppi = new Map<string,T[]>()
  for (const r of righe) { const k=r.group_id || `riga:${r.id}`; gruppi.set(k,[...(gruppi.get(k)||[]),r]) }
  const sostituzioni=new Map<string,BarraSoggiorno<T>>(), nascosti=new Set<string>()
  for (const gruppo of gruppi.values()) {
    if (gruppo.length<2) continue
    const s=[...gruppo].sort((a,b)=>a.check_in.localeCompare(b.check_in))
    if (s.some((r,i)=>r.room_id!==s[0].room_id || r.status!==s[0].status || (i>0 && s[i-1].check_out!==r.check_in))) continue
    const persone=s.map(r=>Number(r.num_guests)||1).filter((n,i,a)=>i===0||n!==a[i-1])
    sostituzioni.set(s[0].id,{
      ...s[0], check_out:s.at(-1)!.check_out,
      total_amount:s.reduce((n,r)=>n+Number(r.total_amount||0),0),
      pagato:s.every(r=>r.pagato===true),
      extra_bed:s.some(r=>r.extra_bed), extra_bed_dates:s.flatMap(nottiLettoExtra),
      trattiBarra:s, ospitiPeriodo:persone.length>1?`${persone.join(' → ')} ospiti`:undefined,
    })
    s.slice(1).forEach(r=>nascosti.add(r.id))
  }
  return righe.filter(r=>!nascosti.has(r.id)).map(r=>sostituzioni.get(r.id)||r)
}
export function nottiPagateBarra<T extends Tratto>(barra: BarraSoggiorno<T>, pagate: Record<string,number>): number | undefined {
  if (!barra.trattiBarra) return pagate[barra.id]
  if (barra.trattiBarra.every(r=>r.pagato || pagate[r.id]===-1)) return -1
  let totale=0
  for (const r of barra.trattiBarra) {
    const notti=(Date.parse(r.check_out)-Date.parse(r.check_in))/86400000
    const n=r.pagato||pagate[r.id]===-1?notti:pagate[r.id]||0
    totale+=n
    if(n<notti)break
  }
  return totale||undefined
}
