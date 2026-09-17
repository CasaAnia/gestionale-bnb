'use client'
// ============================================================================
// «NOTA E COLORE» (17/09/2026): il foglio della scheda nuova per la nota
// della prenotazione, il colore della barra sul calendario e da dove è
// arrivata (diretta · dal sito · WhatsApp). Le regole stanno in
// lib/notaScheda (pure), la scrittura in lib/righeDati: su tutte le camere
// della prenotazione in una richiesta sola, con la verifica delle righe.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo } from '@/components/nuova/PezziNuova'
import {
  TITOLO_NOTA, SALVA_NOTA, ETICHETTA_NOTA_PRENOTAZIONE, ETICHETTA_COLORE, ETICHETTA_ARRIVATA_DA, COLORI_CALENDARIO, ARRIVATA_DA,
  moduloDaPrenotazione, campiNota, idsDaScrivere, nienteDaCambiare, type ModuloNota, type RigaNota,
} from '@/lib/notaScheda'
import { aggiornaInUnColpo } from '@/lib/righeDati'

const OTTONE = '#A9884E'

export default function FoglioNota({ booking, righe, onChiudi, onIncerto, onSalvato }: {
  booking: RigaNota
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaNota[]
  onChiudi: () => void
  /** la risposta è andata persa o le righe non tornano: la scheda rilegge */
  onIncerto: (messaggio: string) => void
  /** i campi appena scritti su tutte le camere attive; `cambiato` è falso se non c'era niente da salvare */
  onSalvato: (campi: ReturnType<typeof campiNota>, ids: string[], cambiato: boolean) => void
}) {
  const [modulo, setModulo] = useState<ModuloNota>(() => moduloDaPrenotazione(booking))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const cambia = (pezzo: Partial<ModuloNota>) => { setModulo(m => ({ ...m, ...pezzo })); setErrore(null) }

  async function salva() {
    if (salvando) return
    const campi = campiNota(modulo)
    const ids = idsDaScrivere(righe)
    if (nienteDaCambiare(modulo, booking)) { onSalvato(campi, ids, false); return }
    setSalvando(true)
    setErrore(null)
    // in una richiesta sola: o tutte le camere o nessuna
    const esito = await aggiornaInUnColpo(ids, campi)
    setSalvando(false)
    if (esito.esito === 'errore') {
      // incerto = qualcosa può essere stato scritto: la scheda non si fida più di quello che mostra
      if (esito.incerto) { onIncerto(esito.messaggio); return }
      setErrore(esito.messaggio)
      return
    }
    onSalvato(campi, ids, true)
  }

  return (
    <Foglio titolo={TITOLO_NOTA} onChiudi={onChiudi}>
      <RigaCampo etichetta={ETICHETTA_NOTA_PRENOTAZIONE} ottone>
        <textarea rows={2} data-campo="nota" value={modulo.nota} onChange={e => cambia({ nota: e.target.value })} style={{ ...stileCampo, resize: 'none' }} />
      </RigaCampo>

      <Etichetta testo={ETICHETTA_COLORE} ottone />
      <div data-colori className="flex flex-wrap items-center" style={{ gap: 10 }}>
        {COLORI_CALENDARIO.map(c => {
          const acceso = modulo.colore === c.valore
          return (
            <button key={c.valore || 'auto'} type="button" data-colore={c.valore || 'auto'} aria-pressed={acceso} aria-label={c.nome} title={c.nome}
              onClick={() => cambia({ colore: c.valore })}
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: 999, border: acceso ? `2px solid ${OTTONE}` : '2px solid transparent', background: 'transparent' }}>
              <span aria-hidden style={{ display: 'block', width: 24, height: 24, borderRadius: 999, background: c.fondo, opacity: acceso ? 1 : 0.75 }} />
            </button>
          )
        })}
      </div>
      <p data-colore-nome style={{ marginTop: 4, fontSize: 12.5, color: 'var(--color-stone)' }}>
        {COLORI_CALENDARIO.find(c => c.valore === modulo.colore)?.nome ?? 'Auto'}
      </p>

      <Etichetta testo={ETICHETTA_ARRIVATA_DA} ottone />
      <FilaPastiglie>
        {ARRIVATA_DA.map(a => (
          <Pastiglia key={a.chiave} dati={`arrivata-${a.chiave}`} acceso={modulo.arrivataDa === a.chiave} onClick={() => cambia({ arrivataDa: a.chiave })}>{a.testo}</Pastiglia>
        ))}
      </FilaPastiglie>

      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={SALVA_NOTA} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="nota" />
    </Foglio>
  )
}
