'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { supabase } from '@/lib/supabase'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { resocontoPulizie, TIPI_PULIZIA } from '@/lib/pulizieResoconto'
import { addDaysStr, type Decisione } from '@/lib/pulizie'
import { leggiFuoriCamera } from '@/lib/pulizieTempiDati'
import { oreMinuti } from '@/lib/pulizieDotazioneStatistiche'

// Stessa fonte e stessa regola del registro: una riga confermata = un
// intervento, nella data effettiva. Le previsioni non sono lavori eseguiti.
export default function RiepilogoInterventiPulizie({ da, a, oggi }: { da: string; a: string; oggi: string }) {
  const [tentativo, setTentativo] = useState(0)
  const [lettura, setLettura] = useState<{ chiave: string; righe: Decisione[]; errore: string | null } | null>(null)
  const chiave = `${da}:${a}:${oggi}:${tentativo}`
  useEffect(() => osservaAggiornamentiPulizie(window, () => setTentativo(n => n + 1)), [])
  useEffect(() => {
    let viva = true
    raccogliPagine<Decisione>((o, n) => supabase.from('cleanings').select('*').eq('stato', 'fatta').order('id').range(o, o + n - 1))
      .then(r => { if (viva) setLettura({ chiave, righe: r.data ?? [], errore: r.error ? 'Non riesco a leggere tutte le pulizie.' : null }) })
      .catch(() => { if (viva) setLettura({ chiave, righe: [], errore: 'Non riesco a leggere tutte le pulizie.' }) })
    return () => { viva = false }
  }, [chiave])
  // Tempi (0059): minuti delle camere confermate + lavoro fuori camera, separati.
  const [fuori, setFuori] = useState<{ chiave: string; minuti: number | null } | null>(null)
  useEffect(() => {
    let viva = true
    leggiFuoriCamera(da, addDaysStr(a, -1)).then(r => { if (viva) setFuori({ chiave, minuti: r.righe ? r.righe.reduce((s, x) => s + x.minuti, 0) : null }) })
    return () => { viva = false }
  }, [chiave, da, a])
  const dati = lettura?.chiave === chiave ? lettura : null
  const report = dati && !dati.errore ? resocontoPulizie([], [], dati.righe, null, da, a, oggi) : null
  return <div className="ed-riga py-4 mt-3" data-interventi-pulizie>
    <p className="text-sm font-semibold text-gray-600">Pulizie e cambi biancheria</p>
    <p className="text-xs text-gray-400 mb-2">Periodo scelto · interventi confermati, contati una sola volta nella data in cui sono stati fatti</p>
    {dati?.errore ? <AvvisoAzione testo={dati.errore} onRiprova={() => setTentativo(n => n + 1)} /> : report ? <>
      <p className="text-sm font-semibold text-green-dark" data-totale-pulizie-statistiche>{report.fatte.length} interventi confermati</p>
      {report.perTipo.map(r => <p key={r.tipo} className="flex justify-between text-sm py-1"><span>{TIPI_PULIZIA[r.tipo]}</span><span>{r.n}</span></p>)}
      {(() => { const conDurata = report.fatte.filter(e => Number((e as { minuti?: number | null }).minuti) > 0); const min = conDurata.reduce((s, e) => s + Number((e as { minuti?: number }).minuti), 0); const f = fuori?.chiave === chiave ? fuori.minuti : null
        return <>
          <p className="flex justify-between text-sm py-1" data-minuti-camere={min}><span>Tempo nelle camere</span><span>{conDurata.length ? oreMinuti(min) : '—'} · nota per {conDurata.length} su {report.fatte.length}</span></p>
          <p className="flex justify-between text-sm py-1" data-minuti-fuori={f ?? ''}><span>Fuori dalle camere</span><span>{f === null ? '—' : `${f} min`}</span></p>
          {f !== null && <p className="flex justify-between text-sm py-1" data-totale-lavoro={min + f}><span>Totale lavoro registrato</span><span>{oreMinuti(min + f)}</span></p>}
        </> })()}
    </> : <p className="text-sm text-gray-400">Lettura delle pulizie…</p>}
    <Link href="/pulizie#statistiche" className="text-xs text-green-mid underline underline-offset-4">Apri il resoconto e il registro delle pulizie</Link>
  </div>
}
