'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { supabase } from '@/lib/supabase'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { osservaAggiornamentiPulizie } from '@/lib/aggiornamentiPulizie'
import { resocontoPulizie, TIPI_PULIZIA } from '@/lib/pulizieResoconto'
import { type Decisione } from '@/lib/pulizie'

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
  const dati = lettura?.chiave === chiave ? lettura : null
  const report = dati && !dati.errore ? resocontoPulizie([], [], dati.righe, null, da, a, oggi) : null
  return <div className="ed-riga py-4 mt-3" data-interventi-pulizie>
    <p className="text-sm font-semibold text-gray-600">Pulizie e cambi biancheria</p>
    <p className="text-xs text-gray-400 mb-2">Periodo scelto · interventi confermati, contati una sola volta nella data in cui sono stati fatti</p>
    {dati?.errore ? <AvvisoAzione testo={dati.errore} onRiprova={() => setTentativo(n => n + 1)} /> : report ? <>
      <p className="text-sm font-semibold text-green-dark" data-totale-pulizie-statistiche>{report.fatte.length} interventi confermati</p>
      {report.perTipo.map(r => <p key={r.tipo} className="flex justify-between text-sm py-1"><span>{TIPI_PULIZIA[r.tipo]}</span><span>{r.n}</span></p>)}
    </> : <p className="text-sm text-gray-400">Lettura delle pulizie…</p>}
    <Link href="/pulizie#statistiche" className="text-xs text-green-mid underline underline-offset-4">Apri il resoconto e il registro delle pulizie</Link>
  </div>
}
