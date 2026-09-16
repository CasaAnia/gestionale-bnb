// La scheda completa è la pagina vecchia (16/09/2026): in cima la riga in
// ottone che manda alla scheda nuova, /scheda/<id>. Il file della pagina non
// si tocca: la riga sta qui, nel layout.
import type { ReactNode } from 'react'
import AvvisoPaginaVecchia from '@/components/AvvisoPaginaVecchia'

export default async function LayoutSchedaVecchia({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <AvvisoPaginaVecchia href={`/scheda/${id}`} testoLink="qui ›" />
      {children}
    </>
  )
}
