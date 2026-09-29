'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import ModuloRichiesta, { valoriDaRichiesta } from '@/components/richieste/ModuloRichiesta'
import { fetchRichiesta, aggiornaRichiesta, colonne0031Presenti, AVVISO_0031 } from '@/lib/richiesteDati'
import { modificabile, nomeCompleto, ritornoDallaModifica, type Richiesta } from '@/lib/richieste'

// Modifica di una richiesta (pezzo 9): lo stesso modulo di /richieste/nuova,
// precompilato. Solo in_attesa e proposta_inviata. Se la proposta inviata
// viene superata (date, persone o camera), lo stato torna in_attesa, la
// proposta finisce nello storico e qui compare l'avviso con il link per
// rigenerarla.

export default function ModificaRichiesta() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // Da dove si è arrivati: finita la modifica — o con la freccia «Indietro» —
  // si torna lì, senza chiedere niente alla cronologia (Ania, 12/09/2026)
  const indietro = ritornoDallaModifica(id, useSearchParams().get('da'))
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [manca0031, setManca0031] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const avvisoRef = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetchRichiesta(id).then(r => {
      setRichiesta(r.data)
      setErrore(r.error)
      setManca0031(!!r.data && !colonne0031Presenti(r.data as unknown as Record<string, unknown>))
      setLoading(false)
    })
  }, [id])

  // La barra «‹ Richieste» (Richieste «Maison», 29/09/2026): torna da dove si è arrivati
  const barra = (
    <div className="sch-top ric-top" data-riga-navigazione>
      <button type="button" className="np-back" onClick={() => router.push(indietro)}>‹ Richieste</button>
      <p className="sch-scritta">Modifica richiesta</p>
    </div>
  )
  if (loading) return <div className="maison cal ric-pag">{barra}<div className="mz-caricamento">Caricamento…</div></div>
  if (!richiesta) return <div className="maison cal ric-pag">{barra}<p className="ric-avviso" role="alert">{errore || 'Richiesta non trovata.'}</p></div>

  if (avviso) {
    return (
      <div className="maison cal ric-pag">
        {barra}
        <header className="ric-testa"><div className="hd3"><h1 className="ti">Richiesta modificata</h1></div></header>
        <div className="sec">
          <p role="status" className="so ott">{avviso}</p>
          <Link href={`/richieste/${richiesta.id}/proposta`} className="ric-cta">Rigenera la proposta</Link>
          {indietro === '/richieste' && <div className="ric-ac centro"><Link href="/richieste" className="mz-lnk q">Torna alle richieste</Link></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="maison cal ric-pag" data-modifica-richiesta-maison>
      {barra}
      <header className="ric-testa">
        <div className="hd3"><h1 className="ti">Modifica richiesta</h1></div>
        <p className="hs">{nomeCompleto(richiesta)}</p>
      </header>
      {!modificabile(richiesta) ? (
        <p role="alert" className="ric-avviso">Una richiesta confermata o rifiutata non si modifica.</p>
      ) : (
        <>
          {manca0031 && (
            <p role="alert" className="ric-avviso">{AVVISO_0031} Finché manca, non si salvano persone diverse per notte né modifiche a una richiesta con proposta inviata.</p>
          )}
          {richiesta.stato === 'proposta_inviata' && (
            <p className="ric-avviso">Questa richiesta ha una proposta inviata: se cambi date, persone o camera, la proposta va rigenerata e reinviata.</p>
          )}
          <ModuloRichiesta iniziale={valoriDaRichiesta(richiesta)} etichettaSalva="Salva le modifiche"
            notaSotto="Nessun messaggio parte da qui."
            onSalva={async valori => {
              const r = await aggiornaRichiesta(richiesta, valori)
              if (r.error) return r.error
              avvisoRef.current = r.avviso ?? null
              return null
            }}
            onSalvato={() => { if (avvisoRef.current) setAvviso(avvisoRef.current); else router.push(indietro) }} />
        </>
      )}
    </div>
  )
}
