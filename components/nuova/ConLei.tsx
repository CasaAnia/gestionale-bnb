'use client'
// ============================================================================
// «CON LEI» (14/09/2026): chi altro dorme qui. Una riga per persona — nome,
// chi è in maiuscolo grigio, telefono a destra — e un fogliettino per
// aggiungerne una. I dati finiscono nelle colonne che bookings ha già
// (extra_phone_1/2, extra_phone_1/2_name, chi_e): sono due, e quando sono
// piene la pagina lo dice invece di perdere la terza.
// Dal 22/10/2026 (Ania) ogni riga ha anche «Modifica»: il foglietto riparte
// dai dati di quella persona e la sostituisce al suo posto (lib/personaChiDorme).
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from '@/components/scheda/Foglio'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastinoTenue, stileCampo, useMaison } from './PezziNuova'
import { CHI_E_VOCI, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import CampiNomeCognome from '@/components/CampiNomeCognome'
import { nomeDaSalvare } from '@/lib/guestName'
import { ALTEZZE_FOGLI } from '@/lib/altezzeFogli'
import { personaInScrittura, personaSostituita } from '@/lib/personaChiDorme'

export const AGGIUNGI_PERSONA = '+ Aggiungi una persona'
export const TITOLO_FOGLIETTO = 'Chi dorme in camera'
export const ALTRO = 'Altro'
export const MODIFICA_PERSONA = 'Modifica'
export const SALVA_PERSONA = 'Salva'

/** Lo stato del foglietto di una persona: nuova (`apri()`) o da modificare (`apri(p)`) */
export function useFogliettoPersona(persone: PersonaConLei[], onPersone: (persone: PersonaConLei[]) => void) {
  const [aperto, setAperto] = useState(false)
  const [inModifica, setInModifica] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [chiE, setChiE] = useState('')
  const [libero, setLibero] = useState(false)
  function riempi(p?: PersonaConLei | null) {
    const d = personaInScrittura(p)
    setNome(d.nome); setCognome(d.cognome); setTelefono(d.telefono); setChiE(d.chiE); setLibero(d.libero)
  }
  function apri(p?: PersonaConLei) { riempi(p); setInModifica(p?.id ?? null); setAperto(true) }
  function chiudi() { riempi(null); setInModifica(null); setAperto(false) }
  function salva() {
    const completo = nomeDaSalvare({ nome, cognome })
    if (!completo) return
    const dati = { nome: completo, chiE: chiE.trim(), telefono: telefono.trim() }
    onPersone(inModifica && persone.some(p => p.id === inModifica)
      ? personaSostituita(persone, inModifica, dati)
      : [...persone, { id: `p${Date.now().toString(36)}`, ...dati }])
    chiudi()
  }
  return {
    aperto, inModifica: inModifica !== null, apri, chiudi, salva,
    nome, setNome, cognome, setCognome, telefono, setTelefono, chiE, libero,
    scegli: (v: string) => { setLibero(false); setChiE(v) },
    scegliAltro: () => { setLibero(true); setChiE('') },
    setChiE,
  }
}

export function RigaPersona({ persona, onTogli, onModifica }: { persona: PersonaConLei; onTogli: () => void; onModifica?: () => void }) {
  // veste «Maison» (28/09/2026): nome in Cormorant, chi è in maiuscoletto, telefono, Modifica, ✕
  if (useMaison()) return (
    <div data-persona className="np-persona">
      <span className="min-w-0"><span className="nm">{persona.nome}</span>{persona.chiE && <span className="ch">{persona.chiE}</span>}</span>
      <span className="tel">{persona.telefono}</span>
      {onModifica && <button type="button" data-modifica-persona onClick={onModifica} aria-label={`Modifica ${persona.nome}`} className="mz-lnk q np-mod">{MODIFICA_PERSONA}</button>}
      <button type="button" onClick={onTogli} aria-label={`Togli ${persona.nome}`} className="x">✕</button>
    </div>
  )
  return (
    <div data-persona className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-card-border)' }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-green-dark)' }}>{persona.nome}</span>
        {persona.chiE && <span className="block uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)', marginTop: 2 }}>{persona.chiE}</span>}
      </span>
      <span className="flex items-center shrink-0" style={{ gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--color-stone)' }}>{persona.telefono}</span>
        {onModifica && <button type="button" data-modifica-persona onClick={onModifica} aria-label={`Modifica ${persona.nome}`} className="ed-azione-tenue">{MODIFICA_PERSONA}</button>}
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
  const f = useFogliettoPersona(persone, onPersone)

  return (
    <section data-con-lei className={className}>
      {!senzaTitolo && <p className="ed-sezione">Con lei</p>}
      <div className="mt-2">
        {persone.map(p => <RigaPersona key={p.id} persona={p} onModifica={() => f.apri(p)} onTogli={() => onPersone(persone.filter(x => x.id !== p.id))} />)}
      </div>
      {avviso && <p data-avviso-persone style={{ marginTop: 8, fontSize: 12.5, color: '#8C3B2E' }}>{avviso}</p>}
      <div style={{ marginTop: 10 }}><TastinoTenue testo={AGGIUNGI_PERSONA} onClick={() => f.apri()} centrato={false} /></div>

      {f.aperto && (
        <Foglio titolo={TITOLO_FOGLIETTO} altezza={ALTEZZE_FOGLI.persona} onChiudi={f.chiudi}>
          <CampiNomeCognome nome={f.nome} cognome={f.cognome} onNome={f.setNome} onCognome={f.setCognome} prefissoDati="persona-"
            classeFila="flex" stileFila={{ gap: 12 }} stile={stileCampo}
            avvolgi={(etichetta, campo) => <RigaCampo etichetta={etichetta} ottone={etichetteOttone} className="flex-1 min-w-0">{campo}</RigaCampo>} />
          <RigaCampo etichetta="Telefono · può restare vuoto" ottone={etichetteOttone}>
            <input type="tel" inputMode="tel" data-campo="persona-telefono" value={f.telefono} onChange={e => f.setTelefono(e.target.value)} style={stileCampo} />
          </RigaCampo>
          <Etichetta testo="Chi è" ottone={etichetteOttone} />
          <FilaPastiglie>
            {CHI_E_VOCI.map(v => (
              <Pastiglia key={v} dati={`chi-${v}`} acceso={!f.libero && f.chiE === v} onClick={() => f.scegli(v)}>{v}</Pastiglia>
            ))}
            <Pastiglia dati="chi-altro" acceso={f.libero} onClick={f.scegliAltro}>{ALTRO}</Pastiglia>
          </FilaPastiglie>
          {f.libero && (
            <RigaCampo etichetta="Chi è" ottone={etichetteOttone} className="mt-2">
              <input type="text" data-campo="persona-chi" value={f.chiE} onChange={e => f.setChiE(e.target.value)} style={stileCampo} />
            </RigaCampo>
          )}
          {/* regola dei fogli (01/10/2026): i due tasti del piede comune */}
          <PiedeFoglio azione={f.inModifica ? SALVA_PERSONA : 'Aggiungi'} onAzione={f.salva} onAnnulla={f.chiudi} dati="persona" datiAzione={{ 'data-salva-persona': '' }} />
        </Foglio>
      )}
    </section>
  )
}
