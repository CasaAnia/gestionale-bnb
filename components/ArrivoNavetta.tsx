'use client'
// ============================================================================
// «ARRIVO E NAVETTA» — IL MODULO, UNO SOLO (21/09/2026).
//
// È la prima delle tre superfici del riferimento approvato da Ania. Lo
// montano tutti i punti in cui l'arrivo si scrive o si corregge: il foglio
// «Arrivo» della scheda nuova, la pagina «Nuova prenotazione», e le due
// pagine di prima (/nuova e /prenotazioni/<id>) finché restano raggiungibili.
// Un modulo solo, così non ricapita che una pagina nuova nasca con campi
// suoi e senza le regole (è già successo coi nomi, regola fissa n. 1).
//
// Qui dentro non c'è nessuna decisione: quali gruppi si vedono e quali no lo
// dice `pianoModuloArrivo` (lib/arrivo), che è provato in Node. Questo file
// mette la veste di casa: etichettine in ottone maiuscolo, pastiglie e fili,
// niente riquadri bianchi.
// ============================================================================
import { Clock } from 'lucide-react'
import { Etichetta, FilaPastiglie, Pastiglia, stileCampo, OTTONE, BORDO_SPENTA } from '@/components/nuova/PezziNuova'
import { oraDigitata } from '@/lib/ora'
import {
  type Arrivo, type ChiaveLuogo, type ModoOrario, type Navetta,
  pianoModuloArrivo, cambiaTipo, cambiaModo, cambiaNavetta,
  ETICHETTA_TIPO, ETICHETTA_LUOGO, ETICHETTA_ORARIO, ETICHETTA_STIMA, AIUTO_STIMA,
  ETICHETTA_NAVETTA, ETICHETTA_AUTISTA, ETICHETTA_PRELIEVO, ETICHETTA_LUOGO_ALTRO,
} from '@/lib/arrivo'

/** La casellina dell'ora: bordo tenue, orologino in ottone, cifre a mano
 *  (Ania, 09/09/2026: «la ruota che gira è scocciante»). */
export function CasellaOra({ valore, onValore, dati, etichetta }: {
  valore: string
  onValore: (v: string) => void
  dati: string
  etichetta: string
}) {
  return (
    <span className="inline-flex items-center flex-1 min-w-[104px]"
      style={{ border: `1px solid ${BORDO_SPENTA}`, borderRadius: 8, padding: '7px 10px', gap: 8 }}>
      <input type="text" inputMode="numeric" maxLength={5} placeholder="--:--"
        data-campo={dati} aria-label={etichetta} value={valore}
        onChange={e => onValore(oraDigitata(e.target.value))}
        style={{ ...stileCampo, marginTop: 0, fontSize: 16, fontWeight: 600 }} />
      <Clock size={15} color={OTTONE} aria-hidden className="shrink-0" />
    </span>
  )
}

export default function ArrivoNavetta({ arrivo, onArrivo, prefisso = '' }: {
  arrivo: Arrivo
  onArrivo: (a: Arrivo) => void
  /** per distinguere i `data-` quando in pagina c'è più di un modulo */
  prefisso?: string
}) {
  const piano = pianoModuloArrivo(arrivo)
  const d = (nome: string) => `${prefisso}${nome}`
  const primo = { primo: true as const }

  return (
    <div data-arrivo-navetta>
      {/* ── Dove arriva ─────────────────────────────────────────────────── */}
      <Etichetta testo={ETICHETTA_TIPO} ottone {...primo} />
      <FilaPastiglie>
        {piano.tipo.map(s => (
          <Pastiglia key={s.chiave} dati={d(`tipo-${s.chiave}`)} acceso={s.acceso}
            onClick={() => onArrivo(cambiaTipo(arrivo, s.chiave as Arrivo['tipo']))}>{s.nome}</Pastiglia>
        ))}
      </FilaPastiglie>

      {piano.luogo && (
        <>
          <Etichetta testo={ETICHETTA_LUOGO} ottone />
          <FilaPastiglie>
            {piano.luogo.map(s => (
              <Pastiglia key={s.chiave} dati={d(`luogo-${s.chiave}`)} acceso={s.acceso}
                onClick={() => onArrivo({ ...arrivo, luogo: s.chiave as ChiaveLuogo, luogoAltro: s.chiave === 'altro' ? arrivo.luogoAltro : '' })}>{s.nome}</Pastiglia>
            ))}
          </FilaPastiglie>
        </>
      )}

      {piano.luogoAltro && (
        <>
          <Etichetta testo={ETICHETTA_LUOGO_ALTRO} ottone />
          <label className="block" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-card-border)' }}>
            <input type="text" maxLength={60} placeholder="es. casa di un’amica in centro"
              data-campo={d('luogo-altro')} aria-label={ETICHETTA_LUOGO_ALTRO} value={arrivo.luogoAltro}
              onChange={e => onArrivo({ ...arrivo, luogoAltro: e.target.value })} style={stileCampo} />
          </label>
        </>
      )}

      {/* ── A che ora, LÌ ───────────────────────────────────────────────── */}
      {piano.orario && (
        <>
          <Etichetta testo={ETICHETTA_ORARIO} ottone />
          <FilaPastiglie>
            {piano.orario.map(s => (
              <Pastiglia key={s.chiave} dati={d(`modo-${s.chiave}`)} acceso={s.acceso}
                onClick={() => onArrivo(cambiaModo(arrivo, s.chiave as ModoOrario))}>{s.nome}</Pastiglia>
            ))}
          </FilaPastiglie>
          <div className="flex items-center mt-[10px]" style={{ gap: 10 }}>
            <CasellaOra valore={arrivo.oraDa} onValore={v => onArrivo({ ...arrivo, oraDa: v })}
              dati={d('ora-da')} etichetta={piano.caselleOrario === 2 ? 'Inizio della fascia' : 'Ora di arrivo'} />
            {piano.caselleOrario === 2 && (
              <>
                <span aria-hidden style={{ color: 'var(--color-stone)' }}>—</span>
                <CasellaOra valore={arrivo.oraA} onValore={v => onArrivo({ ...arrivo, oraA: v })}
                  dati={d('ora-a')} etichetta="Fine della fascia" />
              </>
            )}
          </div>
        </>
      )}

      {/* ── La stima in struttura: la scrive Ania, non si calcola ───────── */}
      {piano.stima && (
        <>
          <Etichetta testo={ETICHETTA_STIMA} ottone />
          <div className="flex items-center" style={{ gap: 10 }}>
            <CasellaOra valore={arrivo.strutturaDa} onValore={v => onArrivo({ ...arrivo, strutturaDa: v })}
              dati={d('struttura-da')} etichetta="In struttura, dalle" />
            <span aria-hidden style={{ color: 'var(--color-stone)' }}>—</span>
            <CasellaOra valore={arrivo.strutturaA} onValore={v => onArrivo({ ...arrivo, strutturaA: v })}
              dati={d('struttura-a')} etichetta="In struttura, alle" />
          </div>
          <p data-aiuto-stima className="mt-1.5" style={{ fontSize: 12, color: 'var(--color-stone)' }}>{AIUTO_STIMA}</p>
        </>
      )}

      {/* ── La navetta: le sette scelte sono una sola scelta ─────────────── */}
      <Etichetta testo={ETICHETTA_NAVETTA} ottone />
      <FilaPastiglie>
        {piano.navetta.map(s => (
          <Pastiglia key={s.chiave} dati={d(`navetta-${s.chiave}`)} acceso={s.acceso}
            onClick={() => onArrivo(cambiaNavetta(arrivo, s.chiave as Navetta))}>{s.nome}</Pastiglia>
        ))}
      </FilaPastiglie>

      <Etichetta testo={ETICHETTA_AUTISTA} ottone />
      <FilaPastiglie>
        {piano.autista.map(s => (
          <Pastiglia key={s.chiave} dati={d(`autista-${s.chiave}`)} acceso={s.acceso}
            onClick={() => onArrivo(cambiaNavetta(arrivo, s.chiave as Navetta))}>{s.nome}</Pastiglia>
        ))}
      </FilaPastiglie>

      {piano.prelievo && (
        <>
          <Etichetta testo={ETICHETTA_PRELIEVO} ottone />
          <div className="flex items-center" style={{ gap: 10 }}>
            <CasellaOra valore={arrivo.prelievo} onValore={v => onArrivo({ ...arrivo, prelievo: v })}
              dati={d('prelievo')} etichetta="Ora del prelievo" />
            <span className="flex-1" />
          </div>
        </>
      )}
    </div>
  )
}
