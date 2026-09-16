// L'inserimento di prima è la pagina vecchia (16/09/2026): in cima la riga in
// ottone che manda all'inserimento nuovo, /nuova-prenotazione. Il file della
// pagina non si tocca: la riga sta qui, nel layout.
import type { ReactNode } from 'react'
import AvvisoPaginaVecchia from '@/components/AvvisoPaginaVecchia'

export default function LayoutInserimentoVecchio({ children }: { children: ReactNode }) {
  return (
    <>
      <AvvisoPaginaVecchia href="/nuova-prenotazione" testoLink="qui ›" />
      {children}
    </>
  )
}
