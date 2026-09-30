'use client'
// ============================================================================
// «ARRIVO E NAVETTA» NELLA VESTE «MAISON» (riferimento del 28/09/2026, i tre
// telefoni affiancati). Stesso piano del modulo di sempre (pianoModuloArrivo
// in lib/arrivo): quali gruppi si vedono lo decide lui, qui c'è solo la
// veste — scelte «a filo», chip tondi, campi col solo filo sotto. Il modulo
// classico (components/ArrivoNavetta) resta per le pagine d'inserimento.
// ============================================================================
import { oraDigitata } from '@/lib/ora'
import {
  type Arrivo, type ChiaveLuogo, type ModoOrario, type Navetta,
  pianoModuloArrivo, cambiaTipo, cambiaModo, cambiaNavetta, scriviOra, nomeLuogo,
  ETICHETTA_TIPO, ETICHETTA_LUOGO, ETICHETTA_ORARIO, ETICHETTA_STIMA, AIUTO_STIMA,
  ETICHETTA_NAVETTA, ETICHETTA_AUTISTA, ETICHETTA_PRELIEVO, ETICHETTA_LUOGO_ALTRO,
} from '@/lib/arrivo'

// Le frasi dei tre telefoni del riferimento (28/09/2026)
export const AIUTO_ARRIVA_DA_SOLO = 'Arriva da solo: nessun autista e nessun prelievo da chiedere.'
export const AIUTO_NESSUN_ORARIO = 'Nessun orario da inserire: in Home resta «Da definire» finché non lo saprai.'
export const AIUTO_NAVETTA_DA_CHIEDERE = 'Navetta da chiedere all’ospite: in Home compare «Navetta da definire · Da chiedere all’ospite».'

function Ora({ valore, onValore, dati, etichetta, larghezza }: { valore: string; onValore: (v: string) => void; dati: string; etichetta: string; larghezza?: number }) {
  return <input type="text" inputMode="numeric" maxLength={5} placeholder="--:--" className="mz-fld" style={larghezza ? { width: larghezza } : undefined}
    data-campo={dati} aria-label={etichetta} value={valore} onChange={e => onValore(oraDigitata(e.target.value))} />
}

function Seg({ voci, dati, onScegli }: { voci: { chiave: string; nome: string; acceso: boolean }[]; dati: string; onScegli: (chiave: string) => void }) {
  return <div className="mz-seg" role="group">
    {voci.map(v => <button key={v.chiave} type="button" data-pastiglia={`${dati}-${v.chiave}`} aria-pressed={v.acceso} className={v.acceso ? 'on' : ''} onClick={() => onScegli(v.chiave)}>{v.nome}</button>)}
  </div>
}

function Chips({ voci, dati, onScegli }: { voci: { chiave: string; nome: string; acceso: boolean }[]; dati: string; onScegli: (chiave: string) => void }) {
  return <div className="mz-chips">
    {voci.map(v => <button key={v.chiave} type="button" data-pastiglia={`${dati}-${v.chiave}`} aria-pressed={v.acceso} className={`mz-chip ${v.acceso ? 'on' : ''}`} onClick={() => onScegli(v.chiave)}>{v.nome}</button>)}
  </div>
}

export default function ArrivoNavettaMaison({ arrivo, onArrivo }: { arrivo: Arrivo; onArrivo: (a: Arrivo) => void }) {
  const piano = pianoModuloArrivo(arrivo)
  const luogo = arrivo.tipo === 'luogo' ? nomeLuogo(arrivo) : ''
  const fascia = piano.caselleOrario === 2
  // «A Linate»; nella fascia «Dalle» e «Alle»
  const etichettaOra = fascia ? 'Dalle' : arrivo.tipo === 'luogo' && luogo ? `A ${luogo}` : arrivo.tipo === 'luogo' ? 'Sul posto' : 'In struttura'
  const stima = piano.stima && (
    <div data-stima={fascia ? 'fascia' : 'ora'} style={{ gridColumn: 'span 2' }}>
      <span className="mz-lab">{ETICHETTA_STIMA}</span>
      <span className="mz-fld" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <input type="text" inputMode="numeric" maxLength={5} placeholder="--:--" data-campo="struttura-da" aria-label="In struttura, dalle" value={arrivo.stimaDa}
          onChange={e => onArrivo({ ...arrivo, stimaDa: oraDigitata(e.target.value) })} style={{ width: '4.2em', background: 'transparent', border: 0, outline: 'none', font: 'inherit', color: 'inherit' }} />
        <span aria-hidden>–</span>
        <input type="text" inputMode="numeric" maxLength={5} placeholder="--:--" data-campo="struttura-a" aria-label="In struttura, alle" value={arrivo.stimaA}
          onChange={e => onArrivo({ ...arrivo, stimaA: oraDigitata(e.target.value) })} style={{ width: '4.2em', background: 'transparent', border: 0, outline: 'none', font: 'inherit', color: 'inherit' }} />
      </span>
      <p className="mz-hint" data-aiuto-stima style={{ marginTop: 3 }}>{AIUTO_STIMA}</p>
    </div>
  )
  return (
    <div data-arrivo-navetta data-veste="maison">
      <span className="mz-lab">{ETICHETTA_TIPO}</span>
      <Seg voci={piano.tipo} dati="tipo" onScegli={k => onArrivo(cambiaTipo(arrivo, k as Arrivo['tipo']))} />

      {piano.luogo && <>
        <span className="mz-lab">{ETICHETTA_LUOGO}</span>
        <Chips voci={piano.luogo} dati="luogo" onScegli={k => onArrivo({ ...arrivo, luogo: k as ChiaveLuogo })} />
      </>}
      {piano.luogoAltro && <>
        <span className="mz-lab">{ETICHETTA_LUOGO_ALTRO}</span>
        <input type="text" maxLength={60} placeholder="es. casa di un’amica in centro" className="mz-fld" data-campo="luogo-altro" aria-label={ETICHETTA_LUOGO_ALTRO}
          value={arrivo.luogoAltro} onChange={e => onArrivo({ ...arrivo, luogoAltro: e.target.value })} />
      </>}

      {piano.orario && <>
        <span className="mz-lab">{ETICHETTA_ORARIO}</span>
        <Seg voci={piano.orario} dati="modo" onScegli={k => onArrivo(cambiaModo(arrivo, k as ModoOrario))} />
        <div className="mz-g3" style={{ marginTop: 10 }}>
          {/* Le caselle scrivono nella casella del tipo attivo: quelle dell'altro tipo restano nella bozza (scriviOra) */}
          <div><span className="mz-lab">{etichettaOra}</span><Ora valore={piano.oraDa} onValore={v => onArrivo(scriviOra(arrivo, 'da', v))} dati="ora-da" etichetta={fascia ? 'Inizio della fascia' : 'Ora di arrivo'} /></div>
          {fascia && <div><span className="mz-lab">Alle</span><Ora valore={piano.oraA} onValore={v => onArrivo(scriviOra(arrivo, 'a', v))} dati="ora-a" etichetta="Fine della fascia" /></div>}
          {!fascia && stima}
        </div>
        {fascia && stima && <div className="mz-g3" style={{ marginTop: 10 }}>{stima}</div>}
      </>}
      {arrivo.tipo === 'da_definire' && <p className="mz-hint" style={{ marginTop: 14 }} data-aiuto-nessun-orario>{AIUTO_NESSUN_ORARIO}</p>}

      <span className="mz-lab">{ETICHETTA_NAVETTA}</span>
      <Seg voci={piano.navetta} dati="navetta" onScegli={k => onArrivo(cambiaNavetta(arrivo, k as Navetta))} />
      {arrivo.tipo === 'struttura' && arrivo.navetta === 'non_richiesta' && <p className="mz-hint" data-aiuto-da-solo>{AIUTO_ARRIVA_DA_SOLO}</p>}
      {arrivo.tipo === 'da_definire' && arrivo.navetta === 'da_definire' && <p className="mz-hint" data-aiuto-navetta>{AIUTO_NAVETTA_DA_CHIEDERE}</p>}

      <span className="mz-lab">{ETICHETTA_AUTISTA}</span>
      <Chips voci={piano.autista} dati="autista" onScegli={k => onArrivo(cambiaNavetta(arrivo, k as Navetta))} />

      {piano.prelievo && <>
        <span className="mz-lab">{ETICHETTA_PRELIEVO}</span>
        <Ora valore={arrivo.prelievo} onValore={v => onArrivo({ ...arrivo, prelievo: v })} dati="prelievo" etichetta="Ora del prelievo" larghezza={90} />
      </>}
    </div>
  )
}
