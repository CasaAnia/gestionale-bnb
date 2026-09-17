'use client'
// ============================================================================
// «CON LEI» (14/09/2026): chi altro dorme qui. Una riga per persona — nome,
// chi è in maiuscolo grigio, telefono a destra — e un fogliettino per
// aggiungerne una. I dati finiscono nelle colonne che bookings ha già
// (extra_phone_1/2, extra_phone_1/2_name, chi_e): sono due, e quando sono
// piene la pagina lo dice invece di perdere la terza.
// ============================================================================
import { useState } from 'react'
import Foglio from '@/components/scheda/Foglio'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastinoTenue, stileCampo } from './PezziNuova'
import { CHI_E_VOCI, type PersonaConLei } from '@/lib/nuovaPrenotazione'

export const AGGIUNGI_PERSONA = '+ Aggiungi una persona'
export const TITOLO_FOGLIETTO = 'Chi dorme con lei'
export const ALTRO = 'altro…'

export function RigaPersona({ persona, onTogli }: { persona: PersonaConLei; onTogli: () => void }) {
  return (
    <div data-persona className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-card-border)' }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-green-dark)' }}>{persona.nome}</span>
        {persona.chiE && <span className="block uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)', marginTop: 2 }}>{persona.chiE}</span>}
      </span>
      <span className="flex items-center shrink-0" style={{ gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--color-stone)' }}>{persona.telefono}</span>
        <button type="button" onClick={onTogli} aria-label={`Togli ${persona.nome}`} className="py-2 -my-2" style={{ fontSize: 16, color: 'var(--color-stone)' }}>✕</button>
      </span>
    </div>
  )
}

export default function ConLei({ persone, onPersone, avviso, senzaTitolo = false, etichetteOttone = false, className = '' }: {
  persone: PersonaConLei[]
  onPersone: (persone: PersonaConLei[]) => void
  /** «di persone in più se ne possono salvare due…» */
  avviso: string | null
  /** dentro il foglio «Con lei» della scheda il titolo c'è già (17/09/2026) */
  senzaTitolo?: boolean
  /** le etichettine del foglietto in ottone, come nei fogli della scheda */
  etichetteOttone?: boolean
  className?: string
}) {
  const [aperto, setAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [chiE, setChiE] = useState('')
  const [libero, setLibero] = useState(false)

  function salva() {
    const completo = [nome.trim(), cognome.trim()].filter(Boolean).join(' ')
    if (!completo) return
    onPersone([...persone, { id: `p${Date.now().toString(36)}`, nome: completo, chiE: chiE.trim(), telefono: telefono.trim() }])
    setNome(''); setCognome(''); setTelefono(''); setChiE(''); setLibero(false); setAperto(false)
  }

  return (
    <section data-con-lei className={className}>
      {!senzaTitolo && <p className="ed-sezione">Con lei</p>}
      <div className="mt-2">
        {persone.map(p => <RigaPersona key={p.id} persona={p} onTogli={() => onPersone(persone.filter(x => x.id !== p.id))} />)}
      </div>
      {avviso && <p data-avviso-persone style={{ marginTop: 8, fontSize: 12.5, color: '#8C3B2E' }}>{avviso}</p>}
      <div style={{ marginTop: 10 }}><TastinoTenue testo={AGGIUNGI_PERSONA} onClick={() => setAperto(true)} centrato={false} /></div>

      {aperto && (
        <Foglio titolo={TITOLO_FOGLIETTO} onChiudi={() => setAperto(false)}>
          <div className="flex" style={{ gap: 12 }}>
            <RigaCampo etichetta="Nome" ottone={etichetteOttone} className="flex-1 min-w-0">
              <input type="text" data-campo="persona-nome" value={nome} onChange={e => setNome(e.target.value)} style={stileCampo} />
            </RigaCampo>
            <RigaCampo etichetta="Cognome" ottone={etichetteOttone} className="flex-1 min-w-0">
              <input type="text" data-campo="persona-cognome" value={cognome} onChange={e => setCognome(e.target.value)} style={stileCampo} />
            </RigaCampo>
          </div>
          <RigaCampo etichetta="Telefono · può restare vuoto" ottone={etichetteOttone}>
            <input type="tel" inputMode="tel" data-campo="persona-telefono" value={telefono} onChange={e => setTelefono(e.target.value)} style={stileCampo} />
          </RigaCampo>
          <Etichetta testo="Chi è" ottone={etichetteOttone} />
          <FilaPastiglie>
            {CHI_E_VOCI.map(v => (
              <Pastiglia key={v} dati={`chi-${v}`} acceso={!libero && chiE === v} onClick={() => { setLibero(false); setChiE(v) }}>{v}</Pastiglia>
            ))}
            <Pastiglia dati="chi-altro" acceso={libero} onClick={() => { setLibero(true); setChiE('') }}>{ALTRO}</Pastiglia>
          </FilaPastiglie>
          {libero && (
            <RigaCampo etichetta="Chi è" ottone={etichetteOttone} className="mt-2">
              <input type="text" data-campo="persona-chi" value={chiE} onChange={e => setChiE(e.target.value)} style={stileCampo} />
            </RigaCampo>
          )}
          <div className="flex gap-2 mt-4 mb-1">
            <button type="button" data-salva-persona onClick={salva} className="ed-pillola flex-1" style={{ minHeight: 44 }}>Aggiungi</button>
            <button type="button" onClick={() => setAperto(false)} className="ed-pillola-tenue" style={{ minHeight: 44 }}>Annulla</button>
          </div>
        </Foglio>
      )}
    </section>
  )
}
