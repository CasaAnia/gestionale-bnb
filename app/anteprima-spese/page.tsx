// ANTEPRIMA SPESE — Fase 3A (prototipo visivo locale).
//
// SOLO SVILUPPO: fuori dal dev locale questa pagina risponde notFound(),
// anche in caso di deploy accidentale (e il proxy, in produzione, chiede
// comunque il login prima di arrivarci: doppia serratura).
// Dati esclusivamente sintetici: nessuna query a Supabase.
// Non tocca /spese, /spese-famiglia né SpeseTracker.
import { notFound } from 'next/navigation'
import { Fraunces } from 'next/font/google'
import Anteprima from './Anteprima'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

export const metadata = { title: 'Anteprima spese (solo sviluppo)' }

export default function PaginaAnteprima() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <div className={fraunces.variable}>
      <Anteprima />
    </div>
  )
}
