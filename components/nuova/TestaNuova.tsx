'use client'
// ============================================================================
// LA TESTATA della «Nuova prenotazione» in veste «Maison» (riferimento del
// 28/09/2026): «Nuova prenotazione» in Cormorant, sotto in maiuscoletto
// ottone la data di oggi e, quando c'è, il nome del cliente; a destra
// «‹ Indietro». L'indietro è quello di sempre (BackLink: smartBack con la
// riserva, registrato per la barra in alto), solo vestito da Maison. Sul
// telefono la barra in alto qui non c'è: la testata è la pagina.
// ============================================================================
import { useRouter } from 'next/navigation'
import { smartBack } from '@/lib/navHistory'
import { useRegistraIndietro } from '@/components/BackContext'
import { TITOLO_PAGINA } from '@/lib/nuovaPrenotazione'

export const INDIETRO = '‹ Indietro'

export default function TestaNuova({ data, sotto, riserva }: {
  /** «Lunedì 28 settembre 2026» */
  data: string
  /** il nome del cliente scelto, o «nuovo cliente»; niente = solo la data */
  sotto?: string | null
  /** dove tornare quando non c'è una pagina precedente nell'app */
  riserva: string
}) {
  const router = useRouter()
  const indietro = () => smartBack(router, riserva)
  useRegistraIndietro(indietro, 'Indietro')
  return (
    <header className="np-hd" data-testa-nuova>
      <h1>{TITOLO_PAGINA}<small data-oggi>{data}{sotto ? ` · ${sotto}` : ''}</small></h1>
      <button type="button" className="np-back" onClick={indietro} data-indietro>{INDIETRO}</button>
    </header>
  )
}
