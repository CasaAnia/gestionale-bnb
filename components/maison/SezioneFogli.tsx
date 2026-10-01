'use client'
// La sezione dei fogli di una pagina (regola di Ania del 01/10/2026): tutti i
// fogli che si aprono qui dentro hanno la stessa altezza, lib/altezzeFogli.
import type { ReactNode } from 'react'
import { SezioneFogliContesto } from './FoglioMaison'
import type { SezioneFogli as Sezione } from '@/lib/altezzeFogli'

export default function SezioneFogli({ sezione, children }: { sezione: Sezione; children: ReactNode }) {
  return <SezioneFogliContesto.Provider value={sezione}>{children}</SezioneFogliContesto.Provider>
}
