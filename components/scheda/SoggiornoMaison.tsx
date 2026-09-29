'use client'
// ============================================================================
// I PEZZI DELLA LINGUETTA «SOGGIORNO» della scheda «Maison» (riferimento del
// 28/09/2026, telefoni 2 e 2b). La pagina li mette in fila con la striscia
// delle notti (StrisciaNottiCamere nella veste della Nuova prenotazione).
//
//   ArrivoMaison  — l'orario grande in Cormorant con «Modifica arrivo» a
//                   destra; sotto il blocco «Arrivo a Malpensa» e il blocco
//                   «Navetta». Con più arrivi la pagina ne mette uno per
//                   arrivo, con l'etichetta «Arrivo 10 settembre · Camera».
//   CamereMaison  — «Camere · 2 cambi»: una riga per tratto col nome in
//                   Cormorant («⇄ » davanti dal secondo), date · notti ·
//                   ospiti · letto, la nota d'ottone sui cambi e l'importo.
// Le parole vengono da lib/schedaMaison.
// ============================================================================
import { arrivoGrande, luogoInSoggiorno, navettaInSoggiorno, type RigaCameraSoggiorno } from '@/lib/schedaMaison'
import type { Arrivo } from '@/lib/arrivo'

export function ArrivoMaison({ arrivo, checkIn, oggi, etichetta, onModifica, ariaModifica }: {
  arrivo: Arrivo
  checkIn: string
  oggi: string
  /** con più arrivi: «Arrivo 10 settembre · Ambra» */
  etichetta?: string
  onModifica: () => void
  ariaModifica?: string
}) {
  const grande = arrivoGrande(arrivo, checkIn, oggi)
  const luogo = luogoInSoggiorno(arrivo)
  const navetta = navettaInSoggiorno(arrivo)
  return (
    <div className="sch-arrivo" data-arrivo-maison>
      {etichetta && <p className="sch-k" data-etichetta-arrivo>{etichetta}</p>}
      <div className="sch-arrivo-ora">
        <span className="sch-big" data-orario-grande>{grande.testo}{grande.circa && <small> circa</small>}</span>
        <button type="button" className="mz-lnk" data-modifica-arrivo onClick={onModifica} aria-label={ariaModifica}>Modifica arrivo</button>
      </div>
      {luogo && (
        <div className="sch-blk" data-blocco-luogo>
          <p className="sch-k">{luogo.etichetta}</p>
          <p>{luogo.testo}</p>
        </div>
      )}
      <div className="sch-blk filo" data-blocco-navetta>
        <p className="sch-k">Navetta</p>
        <p><b>{navetta.forte}</b>{navetta.resto}</p>
      </div>
    </div>
  )
}

export function CamereMaison({ righe }: { righe: RigaCameraSoggiorno[] }) {
  return (
    <>
      {righe.map(r => (
        <div key={r.id} className="sch-camera" data-riga-camera={r.id} data-cambio={r.cambio || undefined}>
          <span className="min-w-0">
            <span className="sch-big nm">{r.cambio ? `⇄ ${r.nome}` : r.nome}</span>
            <span className="de">{r.dettaglio}</span>
            {r.nota && <span className="nota" data-nota-cambio>{r.nota}</span>}
          </span>
          <span className="sch-big eur">{r.importo}</span>
        </div>
      ))}
    </>
  )
}
