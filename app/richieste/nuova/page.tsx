'use client'
import { useRouter } from 'next/navigation'
import BackBar from '@/components/BackBar'
import ModuloRichiesta from '@/components/richieste/ModuloRichiesta'
import { creaRichiesta } from '@/lib/richiesteDati'

// Nuova richiesta: il modulo vive in components/richieste/ModuloRichiesta
// (pezzo 9), condiviso con «Modifica».
export default function NuovaRichiesta() {
  const router = useRouter()
  return (
    <div className="p-4">
      {/* Si arriva qui solo dalle Richieste: la freccia ci riporta lì di sicuro */}
      <BackBar onClick={() => router.push('/richieste')} />
      <h1 className="ed-titolo-medio mb-4 max-lg:hidden">Nuova richiesta</h1>
      <ModuloRichiesta etichettaSalva="Salva richiesta" notaSotto="Va in «In attesa». Nessun messaggio parte da qui."
        onSalva={async valori => {
          const r = await creaRichiesta(valori)
          if (r.error) return r.error
          router.push('/richieste')
          return null
        }} />
    </div>
  )
}
