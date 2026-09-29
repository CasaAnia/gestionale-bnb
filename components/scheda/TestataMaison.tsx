'use client'
// ============================================================================
// LA TESTATA «T2» DELLA SCHEDA, con le note «N1» (riferimento approvato da
// Ania il 28/09/2026: docs/design/scheda-riferimento.html).
//
//   «‹ Prenotazioni»                                          CONFERMATA
//                🧾 ★ Maria Rossi  (cornetta) (nuvoletta)
//           dorme Teresa Bianchi · mamma  (cornetta) (nuvoletta)
//            GIÀ OSPITE 4 VOLTE · DA NIDA · 640 €
//   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//                 Chiede sempre la camera silenziosa
//                            QUESTA VOLTA
//                    Marito ricoverato in Humanitas
//
// La cornetta chiama il numero della prenotazione, la nuvoletta apre la chat
// WhatsApp senza testo (waHrefTesto): al posto di «Scrivi» e della riga del
// telefono. La riga «dorme …» c'è SOLO con la spunta della Nuova
// prenotazione (lib/schedaMaison.chiDormeAlPosto). Date, orario, percorso,
// residuo, contatti e documento non stanno più qui: sono nelle linguette.
// ============================================================================
import { waHrefTesto, numeroWhatsAppPrenotazione } from '@/lib/messaggiWhatsApp'
import { pezziRigaCliente } from '@/lib/clienteCheTorna'
import { NESSUN_NUMERO, QUESTA_VOLTA, testoDorme, type PersonaCheDorme } from '@/lib/schedaMaison'
import { telefonoPerEsteso } from '@/lib/whatsapp'

const ICONA_TEL = <svg viewBox="0 0 24 24" aria-hidden><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
const ICONA_WA = <svg viewBox="0 0 24 24" aria-hidden><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6a9 9 0 1 1 16.6-4.9Z" /></svg>

/** I due cerchi a filo: cornetta (tel:) e nuvoletta WhatsApp. Senza numero, niente. */
export function IconeContatto({ telefono, nome, piccole = false, dati }: { telefono: string | null; nome: string; piccole?: boolean; dati?: string }) {
  const numero = numeroWhatsAppPrenotazione(telefono)
  if (!numero) return null
  return (
    <span className={`sch-ic ${piccole ? 'piccole' : ''}`} data-icone-contatto={dati}>
      <a href={`tel:+${numero}`} data-chiama={dati} aria-label={`Chiama ${nome}`} title={`Chiama ${nome}`}>{ICONA_TEL}</a>
      <a href={waHrefTesto(numero, '')} target="_blank" rel="noopener noreferrer" data-whatsapp={dati} className="wa" aria-label={`WhatsApp a ${nome}`} title={`WhatsApp a ${nome}`}>{ICONA_WA}</a>
    </span>
  )
}

export default function TestataMaison({ nome, stella, ricevuta, telefono, dorme, primaRiga, speso, chiediProvenienza, note }: {
  nome: string
  stella: boolean
  ricevuta: boolean
  /** il numero della prenotazione (guests.phone) */
  telefono: string | null
  /** chi dorme al posto dell'intestataria, solo con la spunta */
  dorme: PersonaCheDorme | null
  /** «Già ospite 4 volte · da Nida», già composta (primaRigaScheda) */
  primaRiga: string
  /** quanto ha speso nei soggiorni conclusi, «640 €», in mattone; null = niente */
  speso: string | null
  /** manca la provenienza: «da dove? ›», che apre il foglio */
  chiediProvenienza: (() => void) | null
  /** le note (noteScheda): la nota del cliente e quella «questa volta» */
  note: { etichetta: string; testo: string }[]
}) {
  const notePulite = note.map(n => ({ ...n, testo: (n.testo ?? '').trim() })).filter(n => n.testo)
  const senzaNumero = !numeroWhatsAppPrenotazione(telefono)
  return (
    <header className="sch-head" data-testa-scheda data-testata="T2">
      <div className="sch-nome">
        <h1 data-nome-testa>
          {(ricevuta || stella) && <b>{ricevuta && <span data-ricevuta aria-label="vuole la ricevuta" title="Vuole la ricevuta">🧾</span>}{ricevuta && stella && ' '}{stella && <span data-stella aria-label="cliente ottima" title="Cliente ottima">★</span>}</b>}
          {(ricevuta || stella) && ' '}{nome}
        </h1>
      </div>
      {/* Ritocchi del 29/09/2026 (C1): sotto il nome il numero per esteso in
          Cormorant 19 coi cerchi da 32 a destra, sulla stessa riga */}
      {senzaNumero
        ? <p data-senza-numero className="sch-senza-numero">{NESSUN_NUMERO}</p>
        : (
          <div className="sch-tel" data-telefono-testa>
            <span className="num">{telefonoPerEsteso(telefono)}</span>
            <IconeContatto telefono={telefono} nome={nome} dati="intestataria" />
          </div>
        )}

      {dorme && (
        <div className="sch-dorme" data-riga-dorme>
          <span>{testoDorme(dorme)}</span>
          <IconeContatto telefono={dorme.telefono} nome={dorme.nome} piccole dati="dorme" />
        </div>
      )}

      <p className="sch-k sch-gia" data-prima-riga>
        {/* numero delle volte e provenienza in grassetto (Ania, 18/09/2026) */}
        {pezziRigaCliente(primaRiga).map((p, i) => (p.grassetto ? <b key={i} data-grassetto-riga>{p.testo}</b> : <span key={i}>{p.testo}</span>))}
        {chiediProvenienza && <> · <button type="button" data-chiedi-provenienza onClick={chiediProvenienza} className="sch-k-azione">da dove? ›</button></>}
        {speso && <> · <span data-totale-cliente className="mat">{speso}</span></>}
      </p>

      {notePulite.length > 0 && (
        <div className="sch-note" data-note-testa>
          {notePulite.map((n, i) => (
            <div key={n.etichetta + i} data-nota-cliente>
              {n.etichetta && <span className="sch-k mat">{n.etichetta === 'questa volta' ? QUESTA_VOLTA : n.etichetta}</span>}
              {n.testo}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
