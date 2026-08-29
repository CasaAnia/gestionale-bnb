'use client'
// Pannello dei filtri (Fase 3.1): foglio dal basso, sei dimensioni semplici.
// Le scelte si applicano subito sul filtro in memoria; "Mostra" chiude e
// fa vedere il risultato, "Azzera" riporta tutto ai valori iniziali.
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta } from './mattoni'
import { FILTRI_INIZIALI, type FiltriSpese } from '@/lib/spese/vista'

const OPZIONI: { chiave: keyof FiltriSpese; nome: string; voci: string[] }[] = [
  { chiave: 'periodo', nome: 'Periodo', voci: ['Agosto', 'Luglio', 'Anno'] },
  { chiave: 'persona', nome: 'Di chi', voci: ['Tutti', 'Casa', 'Ania', 'Teo', 'A + M'] },
  { chiave: 'categoria', nome: 'Categoria', voci: ['Tutte', 'Spesa alimentare', 'Mangiare fuori', 'Scuola e formazione', 'Casa e consumabili', 'Auto e trasporti'] },
  { chiave: 'ambito', nome: 'Ambito', voci: ['Tutti', 'Casa Mia', 'Casa Ania', 'Misti'] },
  { chiave: 'metodo', nome: 'Pagamento', voci: ['Tutti', 'Contanti', 'Carta', 'Bonifico', 'Carta attività'] },
  { chiave: 'stato', nome: 'Stato documento', voci: ['Tutti', 'Da controllare', 'Da pagare', 'Confermati'] },
]

export function FiltriPanel({ filtri, setFiltri, risultati, chiudi }: {
  filtri: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  risultati: number
  chiudi: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filtri">
      <button className="absolute inset-0" style={{ background: 'rgba(20,25,20,.45)' }} onClick={chiudi} aria-label="Chiudi i filtri" />
      <div className="relative max-h-[82%] overflow-y-auto px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        style={{ background: t.fondo, borderRadius: `${t.r} ${t.r} 0 0` }}>
        <div className="mx-auto w-10 h-1 rounded-full mb-4" style={{ background: t.bordo }} />
        <div className="flex items-center justify-between mb-4">
          <p className={`${DISPLAY} text-[19px]`} style={{ color: t.inchiostro }}>Filtri</p>
          <button onClick={() => setFiltri(FILTRI_INIZIALI)}
            className="text-[13px] font-bold min-h-11 px-2" style={{ color: t.terracotta }}>Azzera</button>
        </div>

        {OPZIONI.map(({ chiave, nome, voci }) => (
          <div key={chiave} className="mb-4">
            <Etichetta>{nome}</Etichetta>
            <div className="flex gap-1.5 flex-wrap">
              {voci.map(v => (
                <Chip key={v} attivo={filtri[chiave] === v}
                  onClick={() => setFiltri({ ...filtri, [chiave]: v })}>
                  {v}
                </Chip>
              ))}
            </div>
          </div>
        ))}

        <button onClick={chiudi} className="w-full min-h-12 text-[15px] font-bold text-white mt-1"
          style={{ background: t.verde, borderRadius: t.rPill }}>
          {risultati === 0 ? 'Nessun movimento — chiudi' : risultati === 1 ? 'Mostra 1 movimento' : `Mostra ${risultati} movimenti`}
        </button>
      </div>
    </div>
  )
}
