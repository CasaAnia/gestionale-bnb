'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import BackBar from '@/components/BackBar'
import ModuloRichiesta, { valoriDaRichiesta } from '@/components/richieste/ModuloRichiesta'
import { fetchRichiesta, aggiornaRichiesta, colonne0031Presenti, AVVISO_0031 } from '@/lib/richiesteDati'
import { modificabile, nomeCompleto, type Richiesta } from '@/lib/richieste'

// Modifica di una richiesta (pezzo 9): lo stesso modulo di /richieste/nuova,
// precompilato. Solo in_attesa e proposta_inviata. Se la proposta inviata
// viene superata (date, persone o camera), lo stato torna in_attesa, la
// proposta finisce nello storico e qui compare l'avviso con il link per
// rigenerarla.
const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }

export default function ModificaRichiesta() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [manca0031, setManca0031] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetchRichiesta(id).then(r => {
      setRichiesta(r.data)
      setErrore(r.error)
      setManca0031(!!r.data && !colonne0031Presenti(r.data as unknown as Record<string, unknown>))
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-4"><BackBar href="/richieste" /><div className="text-center py-10 text-stone">Caricamento…</div></div>
  if (!richiesta) return <div className="p-4"><BackBar href="/richieste" /><div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore || 'Richiesta non trovata.'}</div></div>

  if (avviso) {
    return (
      <div className="p-4">
        <BackBar href="/richieste" />
        <h1 className="text-[22px] text-green-dark leading-tight mb-3" style={FRAUNCES}>Richiesta modificata</h1>
        <div role="status" className="bg-sand border border-card-border rounded-xl p-3 text-sm text-green-dark">{avviso}</div>
        <Link href={`/richieste/${richiesta.id}/proposta`} className="block w-full mt-4 text-center bg-green-mid text-cream-text rounded-xl py-3.5 font-semibold text-[15px]">Rigenera la proposta</Link>
        <Link href="/richieste" className="block w-full mt-2 text-center bg-white text-green-dark rounded-xl py-3 font-semibold text-sm border" style={{ borderColor: '#C9BFA8' }}>Torna alle richieste</Link>
      </div>
    )
  }

  return (
    <div className="p-4">
      <BackBar href="/richieste" />
      <h1 className="text-[22px] text-green-dark leading-tight mb-1" style={FRAUNCES}>Modifica richiesta</h1>
      <p className="text-sm text-stone mb-3">{nomeCompleto(richiesta)}</p>
      {!modificabile(richiesta) ? (
        <div role="alert" className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">Una richiesta confermata o rifiutata non si modifica.</div>
      ) : (
        <>
          {manca0031 && (
            <div role="alert" className="mb-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">
              {AVVISO_0031} Finché manca, non si salvano persone diverse per notte né modifiche a una richiesta con proposta inviata.
            </div>
          )}
          {richiesta.stato === 'proposta_inviata' && (
            <p className="text-xs text-stone mb-3">Questa richiesta ha una proposta inviata: se cambi date, persone o camera, la proposta va rigenerata e reinviata.</p>
          )}
          <ModuloRichiesta iniziale={valoriDaRichiesta(richiesta)} etichettaSalva="Salva le modifiche"
            notaSotto="Nessun messaggio parte da qui."
            onSalva={async valori => {
              const r = await aggiornaRichiesta(richiesta, valori)
              if (r.error) return r.error
              if (r.avviso) { setAvviso(r.avviso); return null }
              router.push('/richieste')
              return null
            }} />
        </>
      )}
    </div>
  )
}
