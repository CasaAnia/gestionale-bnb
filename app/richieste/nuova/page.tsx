'use client'
import { useRouter } from 'next/navigation'
import ModuloRichiesta from '@/components/richieste/ModuloRichiesta'
import { creaRichiesta } from '@/lib/richiesteDati'

// Nuova richiesta «Maison» (29/09/2026, telefono 12 del riferimento): la
// barra «‹ Richieste», il titolo in Cormorant e il modulo condiviso con
// «Modifica» (components/richieste/ModuloRichiesta). Dopo il salvataggio la
// conferma «B», poi si torna all'elenco.
export default function NuovaRichiesta() {
  const router = useRouter()
  return (
    <div className="maison cal ric-pag" data-nuova-richiesta-maison>
      {/* Si arriva qui solo dalle Richieste: la freccia ci riporta lì di sicuro */}
      <div className="sch-top ric-top" data-riga-navigazione>
        <button type="button" className="np-back" onClick={() => router.push('/richieste')}>‹ Richieste</button>
        <p className="sch-scritta">Nuova richiesta</p>
      </div>
      <header className="ric-testa"><div className="hd3"><h1 className="ti">Nuova richiesta</h1></div></header>
      <ModuloRichiesta etichettaSalva="Salva la richiesta" notaSotto="Va in «In attesa». Nessun messaggio parte da qui."
        onSalva={async valori => {
          const r = await creaRichiesta(valori)
          return r.error ?? null
        }}
        onSalvato={() => router.push('/richieste')} />
    </div>
  )
}
