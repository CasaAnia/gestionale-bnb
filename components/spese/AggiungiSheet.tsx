'use client'
// Foglio "Aggiungi" (Fase 3.1): quattro strade per una spesa o un documento.
// In questa fase NON scrive nulla: ogni voce può richiamare in modo sicuro
// il vecchio inserimento (callback opzionale) oppure spiegare che arriverà
// con le fasi 4-5. Nessuna logica duplicata.
import { Camera, Images, FolderOpen, PencilLine, RotateCcw, X } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Foglio } from './mattoni'

const VOCI = [
  { id: 'scatta', icona: Camera, nome: 'Scatta scontrino', sotto: 'si apre la fotocamera' },
  { id: 'libreria', icona: Images, nome: 'Dalla libreria', sotto: 'foto già fatte' },
  { id: 'documento', icona: FolderOpen, nome: 'Carica documento', sotto: 'fattura o PDF' },
  { id: 'manuale', icona: PencilLine, nome: 'Spesa manuale', sotto: 'senza documento' },
] as const
export type VoceAggiungi = typeof VOCI[number]['id']

export function AggiungiSheet({ chiudi, scegli, nota, inSospeso, riprendi }: {
  chiudi: () => void
  scegli?: (voce: VoceAggiungi) => void   // se assente, il foglio è solo dimostrativo
  nota?: string
  inSospeso?: number                      // caricamenti pendenti nel deposito
  riprendi?: () => void                   // apre la coda senza passare dal selettore
}) {
  return (
    <Foglio aria="Aggiungi" chiudi={chiudi}>
      <div className="flex items-center justify-between mb-3">
        <p className={`${DISPLAY} text-[19px]`} style={{ color: t.inchiostro }}>Aggiungi</p>
        <button onClick={chiudi} aria-label="Chiudi" className="grid place-items-center w-11 h-11" style={{ color: t.sub }}>
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {VOCI.map(({ id, icona: Icona, nome, sotto }) => (
          <button key={id} onClick={scegli ? () => scegli(id) : undefined}
            className="flex flex-col items-start gap-2 p-3.5 min-h-24 text-left"
            style={{ background: t.carta, borderRadius: t.r, border: t.bordoCarta, boxShadow: t.ombra }}>
            <span className="grid place-items-center w-9 h-9" style={{ background: t.verdeTenue, color: t.verde, borderRadius: 99 }}>
              <Icona size={17} />
            </span>
            <span className="text-[14px] font-bold leading-tight" style={{ color: t.inchiostro }}>{nome}
              <span className="block text-[11.5px] font-normal" style={{ color: t.sub }}>{sotto}</span>
            </span>
          </button>
        ))}
      </div>
      {(inSospeso ?? 0) > 0 && riprendi && (
        <button onClick={riprendi}
          className="w-full mt-2.5 flex items-center gap-2.5 p-3.5 min-h-14 text-left"
          style={{ background: t.terraTenue, borderRadius: t.r, border: t.bordoCarta }}>
          <span className="grid place-items-center w-9 h-9" style={{ background: t.terracotta, color: '#fff', borderRadius: 99 }}>
            <RotateCcw size={17} />
          </span>
          <span className="text-[14px] font-bold leading-tight" style={{ color: t.inchiostro }}>
            Riprendi i caricamenti in sospeso
            <span className="block text-[11.5px] font-normal" style={{ color: t.sub }}>
              {inSospeso === 1 ? '1 operazione da completare' : `${inSospeso} operazioni da completare`}
            </span>
          </span>
        </button>
      )}
      {nota && <p className="text-center text-[12px] mt-3" style={{ color: t.sub }}>{nota}</p>}
    </Foglio>
  )
}
