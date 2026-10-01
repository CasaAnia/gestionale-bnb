'use client'
// Una camera da fare oggi, sotto il grafico (riferimento approvato da Ania il
// 01/10/2026, pulizie-riferimento.html, telefoni 1 e 2): nome e priorità, gli
// orari, cosa preparare, il timer grande e i tre comandi di sempre
// (ControlliPulizia, riusato). La scheda col timer in corso ha lo sfondo
// avorio sfumato. Parole e dati: lib/pulizieSchede.
import ControlliPulizia from '@/components/ControlliPulizia'
import { useTimerPulizie } from '@/lib/pulizieTempiDati'
import { chiaveTimerPulizia } from '@/lib/tempoPulizie'
import { etichettaScheda, orariScheda, rigaResta, pilloleLetti } from '@/lib/pulizieSchede'
import { whatsappRichiestaPartenza } from '@/lib/messaggiWhatsApp'
import { openWhatsApp } from '@/lib/whatsapp'
import { testoRitardo } from '@/lib/pulizieOggi'
import type { Pulizia, ProssimoArrivo, Priorita, Decisione } from '@/lib/pulizie'
import type { RispostaPulizia } from '@/lib/pulizieOperazioni'

export default function SchedaCameraOggi({ id, nome, chi, pulizia: p, arrivo, priorita, oggi, conOrari, ultimaId, nomeCamera, onVaiA, onSalvato }: {
  id?: string
  nome: string
  /** per «Rimanda o salta» del cambio biancheria: «Lucia Ferri · 4ª notte» */
  chi?: string
  pulizia: Pulizia
  arrivo: ProssimoArrivo | null
  priorita: Priorita
  oggi: string
  conOrari: boolean
  ultimaId: string | null
  nomeCamera: (bookingId: string) => string | null
  onVaiA: (chiave: string) => void
  onSalvato: (r: RispostaPulizia) => void
}) {
  const t = useTimerPulizie().timer.find(x => x.chiave === chiaveTimerPulizia(p.booking.id, p.tipo, p.due))
  const inCorso = !!t?.avviato_at
  const ore = orariScheda(p, arrivo, oggi, conOrari)
  const parte = ore.find(o => o.chiave === 'parte')
  const wa = parte && !parte.ora ? whatsappRichiestaPartenza(p.booking, p.booking.check_out) : null
  const decisione: Decisione = { room_id: p.roomId, booking_id: p.booking.id, tipo: p.tipo, stato: 'fatta', data_prevista: p.due, persone_servite: Number(p.booking.num_guests) || null }
  return <article id={id} className={`pul-card${inCorso ? ' cur' : ''}`} data-camera={nome} data-pulizia={p.tipo} data-in-corso={inCorso ? 1 : 0}>
    <div className="hd"><b>{nome}</b><span className={`pul-pr ${priorita}`} data-priorita={priorita}>{etichettaScheda(p, arrivo, priorita)}</span></div>
    {p.ritardo > 0 && <p className="pul-rit" data-ritardo>{testoRitardo(p.ritardo)}</p>}
    {p.tipo === 'soggiorno'
      ? <p className="pul-chi" data-resta>{rigaResta(p.booking)}</p>
      : ore.length > 0 && <div className="pul-ore" data-orari>{ore.map(o => <div key={o.chiave} className={o.chiave === 'parte' ? (o.ora ? '' : 'q') : 'a'} data-ora={o.chiave}><small>{o.etichetta}</small><b>{o.ora ?? 'da chiedere'}</b></div>)}</div>}
    {wa && <div className="pul-azioni" style={{ marginTop: 8 }}><a href={wa.href} target="_blank" rel="noopener noreferrer" className="pul-az" data-whatsapp="chiedi-partenza" onClick={e => { e.preventDefault(); openWhatsApp(wa.numero, wa.testo) }}>Chiedi orario</a></div>}
    <div className="pul-prep" data-prepara>{pilloleLetti(nome, p.booking, oggi).map(x => <span key={x}>{x}</span>)}</div>
    <ControlliPulizia pagina camera={nome} chi={chi} oggi={oggi} pulizia={decisione} ultimaId={ultimaId} persone={Number(p.booking.num_guests) || null}
      partenza={p.tipo === 'soggiorno' ? p.booking.check_out : undefined} nomeCamera={nomeCamera} onVaiA={onVaiA} onSalvato={onSalvato} />
  </article>
}
