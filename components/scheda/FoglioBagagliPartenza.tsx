'use client'
// ============================================================================
// IL FOGLIO «BAGAGLI E PARTENZA» (riferimento approvato da Ania il 01/10/2026,
// docs/design/pulizie-riferimento.html, terzo telefono). Si apre dalle due
// righe «Bagagli» e «Partenza» della linguetta Soggiorno.
//   - Bagagli prima dell'arrivo: «No» · «Sì, alle…» → bookings.bagagli_alle
//     sulla PRIMA riga della catena (lib/bagagliPartenza);
//   - Partenza: «Da chiedere» · «Alle…» → bookings.check_out_time sull'ULTIMA
//     riga della catena; «Chiedi orario» apre WhatsApp col messaggio nuovo.
// Veste e misure dei fogli delle Pulizie (FoglioPulizie: stessa altezza,
// tasti a 96 px dal fondo). Salvataggio con rilettura (lib/bagagliPartenzaDati):
// errore → il foglio resta aperto con quello che hai scritto; incerto → lo
// dice, senza invitare a risalvare.
// ============================================================================
import { useRef, useState } from 'react'
import FoglioPulizie from '@/components/pulizie/FoglioPulizie'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import { supabase } from '@/lib/supabase'
import { oraDigitata } from '@/lib/ora'
import { oraValida, oraBreve } from '@/lib/schema0064'
import { scrittureOrari, sottotitoloFoglio, giornoBreve, type CatenaOrari, type RigaOrari } from '@/lib/bagagliPartenza'
import { salvaOrari } from '@/lib/bagagliPartenzaDati'
import { whatsappRichiestaPartenza } from '@/lib/messaggiWhatsApp'
import { openWhatsApp } from '@/lib/whatsapp'

export const TITOLO_BAGAGLI_PARTENZA = 'Bagagli e partenza'
export const NOTA_PARTENZA = 'Se la sai, scrivila: le Pulizie sapranno da che ora la camera è libera.'

export default function FoglioBagagliPartenza({ catena, ospite, prenotazione, onChiudi, onSalvato }: {
  catena: CatenaOrari<RigaOrari>
  ospite: string
  /** per il messaggio: nome e telefono dell'ospite */
  prenotazione: { guest_name?: string | null; guests?: { full_name?: string | null; phone?: string | null } | null }
  onChiudi: () => void
  /** le righe RILETTE dal server */
  onSalvato: (righe: Record<string, unknown>[]) => void
}) {
  const [bagagliSi, setBagagliSi] = useState(!!catena.bagagli)
  const [bagagli, setBagagli] = useState(catena.bagagli ?? '')
  const [partenzaSi, setPartenzaSi] = useState(!!catena.oraPartenza)
  const [partenza, setPartenza] = useState(catena.oraPartenza ?? '')
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvato, setSalvato] = useState<(Salvataggio & { righe: Record<string, unknown>[] }) | null>(null)
  const freno = useRef(false)
  const wa = whatsappRichiestaPartenza(prenotazione, catena.partenza)
  const camere = catena.camere.join(' → ')

  async function salva() {
    if (freno.current) return
    if (bagagliSi && !oraValida(bagagli)) { setErrore('Scrivi l’ora dei bagagli, per esempio 11:00, oppure scegli «No».'); return }
    if (partenzaSi && !oraValida(partenza)) { setErrore('Scrivi l’ora della partenza, per esempio 10:00, oppure scegli «Da chiedere».'); return }
    const scritture = scrittureOrari(catena, bagagliSi ? oraBreve(bagagli) : null, partenzaSi ? oraBreve(partenza) : null)
    if (!scritture.length) { onChiudi(); return }
    freno.current = true; setSalvando(true); setErrore('')
    try {
      const esito = await salvaOrari(scritture,
        (id, campi) => supabase.from('bookings').update(campi).eq('id', id).select('id, bagagli_alle, check_out_time'),
        ids => supabase.from('bookings').select('id, bagagli_alle, check_out_time').in('id', ids))
      if (esito.stato === 'salvato') { setSalvato({ cosa: `${TITOLO_BAGAGLI_PARTENZA} · ${camere}`, quando: new Date(), righe: esito.righe }); return }
      if (esito.stato === 'non_salvato' && esito.righe?.length) onSalvato(esito.righe)
      setErrore(esito.messaggio)
    } finally { freno.current = false; setSalvando(false) }
  }

  return <FoglioPulizie dati="bagagli" eyebrow={`${TITOLO_BAGAGLI_PARTENZA} · ${camere}`} titolo={ospite} grande={28} sotto={sottotitoloFoglio(catena)}
    onChiudi={onChiudi} azione="Salva" onAzione={() => void salva()} salvando={salvando} disabilitato={!!salvato}
    salvato={salvato} onFineSalvato={() => { if (salvato) onSalvato(salvato.righe); onChiudi() }}>
    <div data-foglio-bagagli>
      <p className="pul-lb ampia">Bagagli prima dell’arrivo</p>
      <div className="pul-seg grande" role="group" aria-label="Bagagli prima dell’arrivo">
        <button type="button" className={!bagagliSi ? 'on' : ''} aria-pressed={!bagagliSi} data-bagagli="no" onClick={() => { setBagagliSi(false); setErrore('') }}>No</button>
        <button type="button" className={bagagliSi ? 'on' : ''} aria-pressed={bagagliSi} data-bagagli="si" onClick={() => setBagagliSi(true)}>Sì, alle…</button>
      </div>
      {bagagliSi && <label className="pul-fi"><input type="text" inputMode="numeric" maxLength={5} placeholder="--:--" aria-label="Ora dei bagagli" data-campo="bagagli"
        value={bagagli} onChange={e => setBagagli(oraDigitata(e.target.value))} /></label>}

      <p className="pul-lb ampia">Partenza · {giornoBreve(catena.partenza)}</p>
      <div className="pul-seg grande" role="group" aria-label="Partenza">
        <button type="button" className={!partenzaSi ? 'on' : ''} aria-pressed={!partenzaSi} data-partenza="da-chiedere" onClick={() => { setPartenzaSi(false); setErrore('') }}>Da chiedere</button>
        <button type="button" className={partenzaSi ? 'on' : ''} aria-pressed={partenzaSi} data-partenza="alle" onClick={() => setPartenzaSi(true)}>Alle…</button>
      </div>
      {partenzaSi && <label className="pul-fi"><input type="text" inputMode="numeric" maxLength={5} placeholder="--:--" aria-label="Ora della partenza" data-campo="partenza"
        value={partenza} onChange={e => setPartenza(oraDigitata(e.target.value))} /></label>}
      <p className="pul-nt">{NOTA_PARTENZA}</p>
      {wa && <div className="pul-lk"><a href={wa.href} target="_blank" rel="noopener noreferrer" className="pul-az" data-whatsapp="chiedi-partenza"
        onClick={e => { e.preventDefault(); openWhatsApp(wa.numero, wa.testo) }}>Chiedi orario</a></div>}
      {errore && <p role="alert" className="pul-errore" data-errore-orari>{errore}</p>}
    </div>
  </FoglioPulizie>
}
