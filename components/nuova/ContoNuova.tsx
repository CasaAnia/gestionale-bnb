'use client'
// ============================================================================
// IL CONTO della pagina di inserimento (14/09/2026): le righe di ogni camera,
// il letto in più, il totale, lo sconto e quanto c'è da pagare. Le cifre
// arrivano già fatte da lib/nuovaPrenotazione (che a sua volta usa le regole
// di lib/prezzoNotti e il letto a prezzo fisso di lib/tariffe).
//
// Veste «Maison» (28/09/2026): raggruppato per camera. Con più camere ogni
// camera ha l'etichetta maiuscoletta «Camera 1 · 28 set → 4 ott», le sue
// righe e il subtotale; con una camera sola niente etichette né subtotali.
// Lo sconto si sceglie subito sopra, e il tasto «Salva la prenotazione»
// resta in fondo alla pagina (TastoSalva): il conto resta uno solo.
// ============================================================================
import { TastoAvanti } from './PezziNuova'
import { RigaConto, TotaleConto, ScontoConto, DaPagareConto, FILO_OTTONE } from '@/components/ContoRighe'
import type { ContoNuova as Conto } from '@/lib/nuovaPrenotazione'

export { FILO_OTTONE }
export const TITOLO_CONTO = 'Il conto'
export const SALVA = 'Salva la prenotazione'
export const DA_COMPLETARE = 'da completare'

/** Il tasto che chiude la pagina, con l'avviso di cosa manca */
export function TastoSalva({ onSalva, spento, avviso, className = '' }: {
  onSalva: () => void
  spento?: boolean
  /** l'avviso in mattone sotto il tasto: il campo che ferma il salvataggio */
  avviso?: string | null
  className?: string
}) {
  return (
    <div data-salva-prenotazione className={className}>
      <TastoAvanti testo={SALVA} onClick={onSalva} disabilitato={spento} dati="salva" />
      {avviso && <p data-avviso-salva className="np-hint m c" style={{ marginTop: 10 }}>{avviso}</p>}
    </div>
  )
}

// Le righe sono quelle di components/ContoRighe (le stesse della scheda),
// nella veste «Maison» quando la pagina è dentro VesteMaison.
export default function ContoNuova({ conto, manca, className = '' }: {
  conto: Conto
  /** cosa manca davvero perché il conto sia intero: si scrive in ottone */
  manca?: string | null
  className?: string
}) {
  const euroGrande = (testo: string | null) => testo ?? DA_COMPLETARE
  const perCamera = conto.gruppi.length > 1
  return (
    <section data-conto-nuova className={`np-sec ${className}`}>
      <p className="mz-eyebrow">{TITOLO_CONTO}</p>
      <div className="np-conto">
        {conto.gruppi.map(g => (
          <div key={g.chiave} data-conto-camera={g.nome}>
            {perCamera && <p className="np-lab" data-etichetta-camera>{g.date ? `${g.nome} · ${g.date}` : g.nome}</p>}
            {g.righe.map(r => <RigaConto key={r.chiave} riga={r} />)}
            {perCamera && <div className="np-conto-sub" data-subtotale><span>{g.nome}</span><b>{g.subtotale}</b></div>}
          </div>
        ))}
        <TotaleConto importo={euroGrande(conto.totale)} />
        {conto.sconto && <ScontoConto sconto={conto.sconto} />}
        {/* Sotto «Da pagare» niente «2 notti · 80 € a notte» (Ania, 18/09/2026, regola fissa n. 7) */}
        <DaPagareConto importo={euroGrande(conto.daPagare)}>
          {manca && <p data-manca-conto className="np-hint o" style={{ textAlign: 'right', marginTop: 2 }}>{manca}</p>}
        </DaPagareConto>
      </div>
    </section>
  )
}
