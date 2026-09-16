'use client'
// ============================================================================
// COME PAGA (13/09/2026) — si sceglie allo STESSO modo in tutto il gestionale:
// nell'inserimento di una nuova prenotazione e nella scheda.
//
// Due gruppi con la loro etichetta piccola — QUANDO ARRIVA e PRIMA DI
// ARRIVARE — e sei pastiglie, una sola accesa alla volta. Sotto, la frase per
// esteso del modo scelto; con «Caparra del 50%» accanto alla frase c'è
// l'importo, con «Caparra» il campo per scriverlo, e con tutte e due i campi
// della scadenza.
//
// Sola presentazione: i nomi, le frasi e le regole stanno in lib/comePaga,
// il salvataggio lo fa la pagina. Nessuna chiamata al database qui dentro.
// ============================================================================
import { GRUPPI_COME_PAGA, NOME_COME_PAGA, FRASE_COME_PAGA, chiedeImporto, chiedeScadenza, type ComePaga } from '@/lib/comePaga'
import { dataConGiorno } from '@/lib/dateItaliane'
import { apriSelettore } from '@/components/nuova/CampoData'
import { oraDigitata } from '@/lib/ora'

export const ALTEZZA_PASTIGLIA = 30
export const BORDO_SPENTA = '#C9BFA8'
export const TITOLO_COME_PAGA = 'Come paga'
const OTTONE = '#A9884E'

const etichettaGruppo = {
  fontSize: 9.5,
  letterSpacing: '1.4px',
  textTransform: 'uppercase' as const,
  color: 'var(--color-stone)',
}

const euro = (n: number) => `${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export default function ComePaga({
  modo, onModo, totaleCent, importo, onImporto, data, ora, onData, onOra, titolo = null, ottone = false, className = '',
}: {
  modo: ComePaga
  onModo: (modo: ComePaga) => void
  /** il totale della prenotazione in centesimi: serve per l'importo del 50% */
  totaleCent?: number | null
  /** la caparra decisa da Ania, in euro */
  importo: number | null
  onImporto: (importo: number | null) => void
  data: string
  ora: string
  onData: (data: string) => void
  onOra: (ora: string) => void
  /** il titoletto della parte, quando la pagina non ce l'ha già */
  titolo?: string | null
  /** nei fogli della scheda le etichettine dei gruppi sono in ottone (16/09/2026) */
  ottone?: boolean
  className?: string
}) {
  const meta = totaleCent != null && totaleCent > 0 ? Math.round(totaleCent / 2) / 100 : null
  const etichetta = ottone ? { ...etichettaGruppo, color: OTTONE } : etichettaGruppo
  return (
    <div data-come-paga className={className}>
      {titolo && <p className="ed-sezione">{titolo}</p>}
      {GRUPPI_COME_PAGA.map(gruppo => (
        <div key={gruppo.id} data-gruppo={gruppo.id} className={gruppo.id === 'arrivo' ? '' : 'mt-3'}>
          <p style={etichetta}>{gruppo.etichetta}</p>
          <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }} role="group" aria-label={gruppo.etichetta}>
            {gruppo.modi.map(m => {
              const acceso = modo === m
              return (
                <button key={m} type="button" data-modo={m} aria-pressed={acceso} onClick={() => onModo(m)}
                  className="py-[7px] -my-[7px]"
                  style={{
                    height: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 12px', fontSize: 12.5, fontWeight: 600,
                    background: acceso ? 'var(--color-green-mid)' : 'transparent',
                    color: acceso ? 'var(--color-cream)' : 'var(--color-green-dark)',
                    border: `1px solid ${acceso ? 'var(--color-green-mid)' : BORDO_SPENTA}`,
                  }}>{NOME_COME_PAGA[m]}</button>
              )
            })}
          </div>
        </div>
      ))}

      {/* La frase per esteso; col 50% anche quanto viene */}
      <p data-frase-come-paga style={{ marginTop: 12, fontSize: 12.5, color: 'var(--color-stone)' }}>
        {FRASE_COME_PAGA[modo]}
        {modo === 'meta' && meta !== null && <span data-meta-importo style={{ fontWeight: 600, color: 'var(--color-green-dark)' }}> · {euro(meta)}</span>}
      </p>

      {chiedeImporto(modo) && (
        <label className="block" style={{ marginTop: 10 }}>
          <span className="block" style={etichetta}>Quanto</span>
          <input type="number" inputMode="decimal" className="ed-campo mt-1" data-importo-caparra placeholder="€"
            value={importo ?? ''} onChange={e => onImporto(e.target.value === '' ? null : Number(e.target.value))} />
        </label>
      )}

      {chiedeScadenza(modo) && (
        <div className="flex flex-wrap" style={{ gap: 10, marginTop: 10 }} data-scadenza>
          <label className="block min-w-0" style={{ flex: '1 1 140px' }}>
            <span className="block" style={etichetta}>Entro il</span>
            {/* il calendario del telefono, con la data scritta in italiano:
                stesso campo di ARRIVO e PARTENZA (Ania, 14/09/2026) */}
            <span className="relative block mt-1">
              <span className="ed-campo block" data-data-scritta style={{ fontSize: 16, fontWeight: 600, color: data ? 'var(--color-green-dark)' : 'var(--color-stone)' }}>
                {dataConGiorno(data) || 'da scegliere'}
              </span>
              <input type="date" data-entro-il value={data} onChange={e => onData(e.target.value)}
                onClick={e => apriSelettore(e.currentTarget)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', background: 'transparent', padding: 0, margin: 0, WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer' }} />
            </span>
          </label>
          <label className="block min-w-0" style={{ flex: '1 1 90px' }}>
            <span className="block" style={etichetta}>alle</span>
            <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 18:00" className="ed-campo mt-1" data-entro-ora
              value={ora} onChange={e => onOra(oraDigitata(e.target.value))} />
          </label>
        </div>
      )}
    </div>
  )
}
