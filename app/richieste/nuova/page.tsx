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
      <BackBar href="/richieste" />
      <h1 className="text-[22px] text-green-dark leading-tight mb-4 max-lg:hidden" style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}>Nuova richiesta</h1>
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
