'use client'
// ============================================================================
// «NUOVO CLIENTE» della pagina di inserimento (14/09/2026): chi è, se vuole la
// ricevuta, come lo valutiamo, come ci ha trovato e la nota che resta anche le
// prossime volte.
//
// Sola presentazione: i valori arrivano da fuori e le regole restano quelle di
// sempre (lib/valutazione per le tre voci, lib/provenienza per le quattro
// provenienze e le strutture già in uso).
//
// Dal 16/09/2026 lo stesso modulo sta anche nei fogli della scheda («Dati
// della cliente», «Cambia cliente» → nuovo): senza titoletto e senza il
// tasto «Avanti» (`titolo={null}`, `avanti={null}`, ci pensa il piede del
// foglio) e con le etichettine in ottone (`etichetteOttone`).
// ============================================================================
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastoAvanti, stileCampo, MATTONE, OTTONE } from './PezziNuova'
import { PROVENIENZE, type Provenienza } from '@/lib/provenienza'
import type { Valutazione } from '@/lib/valutazione'
import type { StrutturaNota } from '@/lib/provenienza'

export const TITOLO_NUOVO_CLIENTE = 'Nuovo cliente'
export const AVANTI = 'Avanti · date e camera'
export const ETICHETTA_NOTE = 'Note del cliente · restano anche le prossime volte'
export const ALTRA_STRUTTURA = 'altra…'

export type DatiNuovoCliente = {
  nome: string
  cognome: string
  telefono: string
  /** può restare vuota (17/09/2026: era solo nella scheda attuale) */
  email: string
  ricevuta: boolean
  valutazione: Valutazione
  motivo: string
  provenienza: Provenienza | null
  struttura: string
  note: string
}

export const NUOVO_CLIENTE_VUOTO: DatiNuovoCliente = {
  nome: '', cognome: '', telefono: '', email: '', ricevuta: false, valutazione: 'normale', motivo: '',
  provenienza: null, struttura: '', note: '',
}

// Le tre voci della valutazione come le vuole questa pagina: un segno solo
const SEGNI: { chiave: Valutazione; segno: string; colore?: string }[] = [
  { chiave: 'ottimo', segno: '★' },
  { chiave: 'normale', segno: 'Normale' },
  { chiave: 'problematico', segno: '!', colore: MATTONE },
]

export default function NuovoCliente({ dati, onDati, strutture, struttureDisponibili, onAvanti, avantiSpento = false, titolo = TITOLO_NUOVO_CLIENTE, avanti = AVANTI, etichetteOttone = false, className = '' }: {
  dati: DatiNuovoCliente
  onDati: (dati: DatiNuovoCliente) => void
  strutture: StrutturaNota[]
  struttureDisponibili: boolean
  onAvanti?: () => void
  avantiSpento?: boolean
  /** il titoletto ed-sezione; null quando sta in un foglio che ha già il suo titolo */
  titolo?: string | null
  /** il testo del tasto in fondo; null = nessun tasto (ci pensa il piede del foglio) */
  avanti?: string | null
  /** le etichettine in ottone, come nei fogli della scheda */
  etichetteOttone?: boolean
  className?: string
}) {
  const cambia = (pezzo: Partial<DatiNuovoCliente>) => onDati({ ...dati, ...pezzo })
  const ottone = etichetteOttone
  return (
    <section data-nuovo-cliente className={className}>
      {titolo && <p className="ed-sezione">{titolo}</p>}

      <Etichetta testo="Chi" primo ottone={ottone} className={titolo ? 'mt-3' : ''} />
      <div className="flex" style={{ gap: 12 }}>
        <RigaCampo etichetta="Nome" ottone={ottone} className="flex-1 min-w-0">
          <input type="text" value={dati.nome} data-campo="nome" onChange={e => cambia({ nome: e.target.value })} style={stileCampo} />
        </RigaCampo>
        <RigaCampo etichetta="Cognome" ottone={ottone} className="flex-1 min-w-0">
          <input type="text" value={dati.cognome} data-campo="cognome" onChange={e => cambia({ cognome: e.target.value })} style={stileCampo} />
        </RigaCampo>
      </div>
      <RigaCampo etichetta="Telefono" ottone={ottone}>
        <input type="tel" inputMode="tel" value={dati.telefono} data-campo="telefono" onChange={e => cambia({ telefono: e.target.value })} style={stileCampo} />
      </RigaCampo>
      <RigaCampo etichetta="Email · può restare vuota" ottone={ottone}>
        <input type="email" inputMode="email" autoCapitalize="none" value={dati.email} data-campo="email" onChange={e => cambia({ email: e.target.value })} style={stileCampo} />
      </RigaCampo>

      {/* Ricevuta e valutazione, affiancate con l'etichettina centrata sopra */}
      <div className="flex flex-wrap" style={{ gap: 22 }}>
        <div>
          <Etichetta testo="Ricevuta" centrata ottone={ottone} />
          <FilaPastiglie centrata>
            <Pastiglia dati="ricevuta-no" acceso={!dati.ricevuta} onClick={() => cambia({ ricevuta: false })}>No</Pastiglia>
            <Pastiglia dati="ricevuta-si" acceso={dati.ricevuta} onClick={() => cambia({ ricevuta: true })}>Sì 🧾</Pastiglia>
          </FilaPastiglie>
        </div>
        <div>
          <Etichetta testo="Valutazione" centrata ottone={ottone} />
          <FilaPastiglie centrata>
            {SEGNI.map(v => (
              <Pastiglia key={v.chiave} dati={`valutazione-${v.chiave}`} acceso={dati.valutazione === v.chiave} colore={v.colore}
                onClick={() => cambia({ valutazione: v.chiave, motivo: v.chiave === 'problematico' ? dati.motivo : '' })}>{v.segno}</Pastiglia>
            ))}
          </FilaPastiglie>
        </div>
      </div>
      {dati.valutazione === 'problematico' && (
        <RigaCampo etichetta="Perché" ottone={ottone} className="mt-3">
          <input type="text" value={dati.motivo} data-campo="motivo" placeholder="resta solo per noi"
            onChange={e => cambia({ motivo: e.target.value })} style={stileCampo} />
        </RigaCampo>
      )}

      {/* Come ci ha trovato, su una riga sola */}
      {struttureDisponibili && (
        <>
          <Etichetta testo="Come ci ha trovato" ottone={ottone} />
          <FilaPastiglie>
            {PROVENIENZE.map(p => (
              <Pastiglia key={p.chiave} dati={`provenienza-${p.chiave}`} acceso={dati.provenienza === p.chiave}
                onClick={() => cambia({ provenienza: p.chiave, struttura: p.chiave === 'altra_struttura' ? dati.struttura : '' })}>
                {p.chiave === 'altra_struttura' ? 'Struttura' : p.label}
              </Pastiglia>
            ))}
          </FilaPastiglie>
          {dati.provenienza === 'altra_struttura' && (
            <div data-strutture style={{ marginTop: 10, marginLeft: 10, paddingLeft: 12, borderLeft: `2px solid ${OTTONE}` }}>
              <FilaPastiglie>
                {strutture.map(s => (
                  <Pastiglia key={s.nome} dati={`struttura-${s.nome}`} acceso={dati.struttura === s.nome} onClick={() => cambia({ struttura: s.nome })}>{s.nome}</Pastiglia>
                ))}
                <Pastiglia dati="struttura-altra" acceso={!!dati.struttura && !strutture.some(s => s.nome === dati.struttura)} onClick={() => cambia({ struttura: ' ' })}>{ALTRA_STRUTTURA}</Pastiglia>
              </FilaPastiglie>
              {!!dati.struttura && !strutture.some(s => s.nome === dati.struttura) && (
                <RigaCampo etichetta="Quale struttura" ottone={ottone} className="mt-2">
                  <input type="text" value={dati.struttura.trimStart()} data-campo="struttura" onChange={e => cambia({ struttura: e.target.value })} style={stileCampo} />
                </RigaCampo>
              )}
            </div>
          )}
        </>
      )}

      <Etichetta testo={ETICHETTA_NOTE} ottone={ottone} />
      <RigaCampo etichetta="Nota" ottone={ottone}>
        <textarea rows={2} value={dati.note} data-campo="note" onChange={e => cambia({ note: e.target.value })} style={{ ...stileCampo, resize: 'none' }} />
      </RigaCampo>

      {avanti && onAvanti && <div style={{ marginTop: 22 }}><TastoAvanti testo={avanti} onClick={onAvanti} disabilitato={avantiSpento} dati="cliente" /></div>}
    </section>
  )
}
