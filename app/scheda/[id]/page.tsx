'use client'
// ============================================================================
// LA NUOVA SCHEDA PRENOTAZIONE — /scheda/<id> (13/09/2026, parte 1 di 2).
// Nasce a un indirizzo a parte: la scheda vecchia (/prenotazioni/<id>) resta
// com'è finché questa non è completa. Stile della pagina della proposta delle
// richieste e della Home: testa col cliente (TestaCliente), fascia delle
// sezioni ferma in cima (FasciaSezioni), schedine di «Da controllare»
// (SchedinaControllo), parte CLIENTE (ParteCliente).
//
// Parte 1: testa, fascia, DA CONTROLLARE, SOGGIORNO. Le parti CONTO e
// MESSAGGI arrivano con la parte 2: qui c'è solo il loro titolo, così la
// fascia ha già le cinque voci e ognuna porta da qualche parte.
//
// I dati sono quelli veri della prenotazione: tutte le camere della stessa
// prenotazione con lib/prenotazioneUnica (la stessa lettura della scheda
// attuale), i pagamenti, gli altri soggiorni della cliente. Le cifre del
// conto vengono da contoPrenotazione, mai ricalcolate qui.
//
// I fogli di modifica: «Modifica arrivo» e «da dove?» si aprono qui
// (salvataggi condivisi: lib/arrivoOrario, lib/provenienzaDati); «Modifica
// soggiorno» e il tocco su una notte portano alla scheda attuale, dove quel
// foglio vive ancora (il file è in carico a un'altra attività).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BackBar from '@/components/BackBar'
import TestaCliente from '@/components/TestaCliente'
import FasciaSezioni from '@/components/FasciaSezioni'
import SchedinaControllo from '@/components/SchedinaControllo'
import ParteCliente from '@/components/ParteCliente'
import AvvisoAzione from '@/components/AvvisoAzione'
import { RigaDocumentiPrenotazione } from '@/components/DocumentiCliente'
import StrisciaNottiScheda from '@/components/scheda/StrisciaNottiScheda'
import { RigaArrivo, TrattiCameraScheda, LinkSoggiorno } from '@/components/scheda/SoggiornoScheda'
import ArriviPrecedenti from '@/components/scheda/ArriviPrecedenti'
import FoglioArrivo from '@/components/scheda/FoglioArrivo'
import FoglioProvenienza from '@/components/scheda/FoglioProvenienza'
import { supabase } from '@/lib/supabase'
import { leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, chiavePrenotazione, ERRORE_CONTO_INCOMPLETO, type RigaPrenotazione } from '@/lib/prenotazioneUnica'
import {
  SEZIONI_SCHEDA, TUTTO_A_POSTO, statoScheda, primaRigaScheda, etichettaArrivoScheda, rigaGrandeScheda, statoConto, noteScheda,
  caselleSoggiorno, arrivoScheda, trattiCamera, daControllareScheda, segmentiAttivi, type SegmentoScheda,
} from '@/lib/schedaPrenotazione'
import { nomeOspite } from '@/lib/guestName'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { provenienzaInParole, provenienzaDi, normalizzaProvenienza, type CampiProvenienza } from '@/lib/provenienza'
import { elencoSoggiorniPersona, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { numeroWhatsAppPrenotazione } from '@/lib/messaggiWhatsApp'
import { openWhatsApp, telefonoAGruppi } from '@/lib/whatsapp'
import { oggiARoma } from '@/lib/spese/adattatore'
import type { PrenotazioneDC } from '@/lib/daControllare'
import type { PagamentoStat } from '@/lib/statistiche/tipi'
import type { SegmentoStorico } from '@/lib/storicoCliente'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const VERDE_MESE = '#5B6559'
const ROSSO_CONTO = '#D40000'
const COLONNE_ALTRE = '*, rooms(name), guests(full_name, phone)'

type Prenotazione = SegmentoScheda & RigaPrenotazione & {
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null; notes?: string | null; provenienza?: string | null; struttura_nome?: string | null } | null
  provenienza?: string | null
  struttura_nome?: string | null
}

// La riga grande: OSPITI e CAMERA (con «⇄ 2» se cambia camera)
function RigaGrande({ ospiti, camere, cambi }: { ospiti: number; camere: string; cambi: number }) {
  const etichetta = { marginTop: 6, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--color-stone)' }
  return (
    <div data-riga-grande className="flex items-start justify-center" style={{ gap: 44 }}>
      <div className="text-center" data-ospiti-testa>
        <p className="leading-[1.15]" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>{ospiti}</p>
        <p style={etichetta}>ospiti</p>
      </div>
      <div className="text-center min-w-0" data-camera-scheda>
        <p className="leading-[1.15] truncate" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>
          {camere}
          {cambi > 0 && <span data-cambi style={{ fontSize: 15, color: VERDE_MESE }}> ⇄ {cambi}</span>}
        </p>
        <p style={etichetta}>camera</p>
      </div>
    </div>
  )
}

export default function SchedaPage() {
  const { id } = useParams<{ id: string }>()
  const oggi = oggiARoma()
  const [booking, setBooking] = useState<Prenotazione | null>(null)
  const [righe, setRighe] = useState<Prenotazione[]>([])
  const [pagamenti, setPagamenti] = useState<PagamentoStat[]>([])
  const [altreCliente, setAltreCliente] = useState<SoggiornoStorico[]>([])
  const [altreNotti, setAltreNotti] = useState<PrenotazioneDC[]>([])
  const [documenti, setDocumenti] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [foglioArrivo, setFoglioArrivo] = useState(false)
  const [foglioProvenienza, setFoglioProvenienza] = useState(false)
  const [arriviAperti, setArriviAperti] = useState(false)

  useEffect(() => {
    if (!id) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      const { data: b, error } = await supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single()
      if (!vivo) return
      if (error || !b) { setBooking(null); setErrore(error?.message || 'Prenotazione non trovata.'); setLoading(false); return }
      const scheda = b as Prenotazione
      setBooking(scheda)
      // Tutte le camere della prenotazione: la stessa lettura della scheda attuale
      const conto = await leggiPrenotazioneUnica(scheda, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
      if (!vivo) return
      // Le righe arrivano con la camera ma senza il cliente: è lo stesso per tutte
      const tutte = (conto.errore ? [scheda] : (conto.righe as Prenotazione[])).map(r => ({ ...r, guests: r.guests ?? scheda.guests, guest_name: r.guest_name ?? scheda.guest_name }))
      setRighe(tutte)
      if (conto.errore) setAvviso(conto.errore)
      const ids = tutte.map(r => r.id)
      const attive = segmentiAttivi(tutte)
      const arrivo = attive[0]?.check_in ?? scheda.check_in
      const partenza = attive.reduce((m, s) => (s.check_out > m ? s.check_out : m), scheda.check_out)
      const [pag, altre, vicine, doc] = await Promise.all([
        supabase.from('payments').select('*').in('booking_id', ids).order('paid_on'),
        scheda.guest_id
          ? supabase.from('bookings').select('*, rooms(name), guests(full_name, phone)').eq('guest_id', scheda.guest_id).order('check_in', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        // le altre prenotazioni nelle stesse notti: sovrapposizioni e letti oltre il pool
        supabase.from('bookings').select(COLONNE_ALTRE).neq('status', 'annullata').lt('check_in', partenza).gt('check_out', arrivo),
        scheda.guest_id
          ? supabase.from('documenti_cliente').select('id', { count: 'exact', head: true }).eq('guest_id', scheda.guest_id)
          : Promise.resolve({ count: null, error: null }),
      ])
      if (!vivo) return
      if (pag.error) setAvviso(a => a ?? `Non riesco a leggere i pagamenti: ${pag.error.message}`)
      setPagamenti((pag.data ?? []) as PagamentoStat[])
      const chiave = chiavePrenotazione(scheda)
      setAltreCliente(((altre.data ?? []) as SoggiornoStorico[]).filter(x => chiavePrenotazione(x as RigaPrenotazione) !== chiave))
      setAltreNotti(((vicine.data ?? []) as PrenotazioneDC[]).filter(x => !ids.includes(x.id)))
      setDocumenti(doc.error ? null : (doc.count ?? 0))
      setLoading(false)
    })().catch(() => { if (vivo) { setErrore(ERRORE_CONTO_INCOMPLETO); setLoading(false) } })
    return () => { vivo = false }
  }, [id])

  const guest = booking?.guests ?? null
  const hrefCliente = booking?.guest_id ? `/clienti/${booking.guest_id}` : null
  const attive = useMemo(() => segmentiAttivi(righe), [righe])
  const primoArrivo = attive[0]?.check_in ?? booking?.check_in ?? ''
  const ultimaPartenza = attive.reduce((m, s) => (s.check_out > m ? s.check_out : m), booking?.check_out ?? '')
  const nottiTotali = useMemo(() => caselleSoggiorno(attive, oggi), [attive, oggi])
  const tratti = useMemo(() => trattiCamera(attive), [attive])
  const grande = useMemo(() => rigaGrandeScheda(attive), [attive])
  // Il conto: contoPrenotazione di lib/prenotazioneUnica, come la scheda attuale
  const conto = useMemo(() => {
    try { return contoPrenotazione(righe, pagamenti.map(p => ({ booking_id: p.booking_id, amount: p.amount }))) } catch { return null }
  }, [righe, pagamenti])
  const accordo = useMemo(() => accordoPrenotazione(righe) ?? booking, [righe, booking])
  const stato = conto ? statoConto({ totaleCent: conto.totaleCent, ricevutiCent: conto.ricevutiCent, pagato: righe.some(r => r.pagato), bonifico: accordo?.bonifico }) : null
  // Chi è: soggiorni conclusi della stessa persona, fuori questa prenotazione
  const soggiorni = useMemo(() => {
    if (!booking) return []
    const persona = { guest_id: booking.guest_id ?? null, telefono: guest?.phone ?? null, full_name: booking.guest_name || guest?.full_name || null }
    return elencoSoggiorniPersona(persona, altreCliente, oggi, chiavePrenotazione(booking))
  }, [booking, guest, altreCliente, oggi])
  const totaleSoggiorniCent = soggiorni.reduce((t, s) => t + s.totaleCent, 0)
  const provenienza = provenienzaInParole(guest ?? booking)
  const primaRiga = primaRigaScheda(soggiorni.length, provenienza)
  const note = noteScheda(guest?.notes, booking?.notes)
  const arrivoTesto = booking ? arrivoScheda(primoArrivo, oggi, attive[0]?.check_in_time ?? booking.check_in_time, attive[0]?.shuttle ?? booking.shuttle) : null
  const controlli = useMemo(() => booking ? daControllareScheda({
    segmenti: attive, altre: altreNotti, pagamenti, oggi, documenti, hrefDocumenti: hrefCliente ? `${hrefCliente}#documenti` : null,
  }) : [], [booking, attive, altreNotti, pagamenti, oggi, documenti, hrefCliente])

  const telefono = guest?.phone ?? null
  const waNumero = numeroWhatsAppPrenotazione(telefono)
  const primoSegmento = attive[0] ?? booking
  const hrefVecchia = (segmentoId: string) => `/prenotazioni/${segmentoId}`

  if (loading) return <div className="p-4"><BackBar href="/prenotazioni" /><div className="text-center py-10 text-stone">Caricamento…</div></div>
  if (!booking) return <div className="p-4"><BackBar href="/prenotazioni" /><div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore || 'Prenotazione non trovata.'}</div></div>

  return (
    /* Margini laterali 22 px, tutto centrato, come la proposta */
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href="/prenotazioni" /></div>

      {/* La riga di navigazione: «‹ Prenotazioni» a sinistra, lo stato a destra */}
      <div data-riga-navigazione className="flex items-center justify-between gap-3">
        <Link href="/prenotazioni" className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>‹ Prenotazioni</Link>
        <span data-stato-scheda className="uppercase" style={{ fontSize: 11, letterSpacing: '1.5px', color: OTTONE }}>{statoScheda(booking.status, ultimaPartenza, oggi)}</span>
      </div>
      {avviso && <AvvisoAzione testo={avviso} className="mt-3" />}

      <div style={{ marginTop: 14 }}>
        <TestaCliente
          nome={nomeOspite(booking)}
          stella={valutazioneDi(guest) === 'ottimo'}
          ricevuta={vuoleRicevuta(guest)}
          nomeNormale
          primaRiga={primaRiga.testo}
          chiediProvenienza={primaRiga.chiediProvenienza && booking.guest_id ? { testo: 'da dove? ›', onClick: () => setFoglioProvenienza(true) } : null}
          volte={soggiorni.length}
          inArchivio
          totaleCent={totaleSoggiorniCent}
          hrefCliente="#cliente"
          arrivo={primoArrivo}
          partenza={ultimaPartenza}
          notti={nottiTotali.length}
          etichettaArrivo={etichettaArrivoScheda(primoSegmento?.check_in_time, primoSegmento?.shuttle)}
          etichettaPartenza="parte"
          personeNotti={[grande.ospiti]}
          rigaGrande={<RigaGrande ospiti={grande.ospiti} camere={grande.camere} cambi={grande.cambi} />}
          sottoRigaGrande={stato && (
            <p data-stato-conto={stato.tipo} className="text-center" style={{ marginTop: 12, fontFamily: GEORGIA, fontSize: 22, lineHeight: 1.2, color: stato.tipo === 'pagato' ? 'var(--color-green-mid)' : ROSSO_CONTO }}>{stato.testo}</p>
          )}
          telefono={telefonoAGruppi(telefono) || telefono}
          telefonoDaChiamare={waNumero}
          telefonoWhatsApp={waNumero}
          onScrivi={() => waNumero && openWhatsApp(waNumero, '')}
          dopoContatti={<p className="text-center mt-2"><RigaDocumentiPrenotazione guestId={booking.guest_id} conteggio={documenti} scheda /></p>}
          note={note}
          noteScheda
        />
      </div>

      <FasciaSezioni voci={SEZIONI_SCHEDA} className="mt-[22px]" top="top-12 lg:top-0" spaziatura={0.6} />

      {/* ── Da controllare ────────────────────────────────────────────────── */}
      <section id="controllare" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Da controllare {controlli.length > 0 && <small>{controlli.length}</small>}</p>
        {controlli.length === 0
          ? <p data-tutto-a-posto className="mt-2 font-semibold" style={{ fontSize: 14, color: 'var(--color-green-mid)' }}>{TUTTO_A_POSTO}</p>
          : <div className="mt-2 flex flex-col gap-2">
            {controlli.map(v => <SchedinaControllo key={v.chiave} etichetta={v.etichetta} titolo={v.titolo} dettaglio={v.dettaglio} link={v.link} grande />)}
          </div>}
      </section>

      {/* ── Soggiorno ─────────────────────────────────────────────────────── */}
      <section id="soggiorno" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Soggiorno</p>
        <StrisciaNottiScheda caselle={nottiTotali} hrefNotte={c => hrefVecchia(c.segmentoId)} className="mt-3" />
        {arrivoTesto && <RigaArrivo arrivo={arrivoTesto} className="mt-3" />}
        <TrattiCameraScheda tratti={tratti} className="mt-2" />
        <LinkSoggiorno
          onArrivo={() => setFoglioArrivo(true)}
          hrefSoggiorno={hrefVecchia(primoSegmento?.id ?? booking.id)}
          onArriviPrecedenti={() => setArriviAperti(a => !a)}
          arriviAperti={arriviAperti}
          className="mt-1"
        />
        {arriviAperti && <ArriviPrecedenti altre={altreCliente as unknown as SegmentoStorico[]} oggi={oggi} className="mt-3" />}
      </section>

      {/* ── Conto e Messaggi: arrivano con la parte 2 ─────────────────────── */}
      <section id="conto" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Conto</p>
        <p className="mt-2" style={{ fontSize: 13, color: 'var(--color-stone)' }}>Questa parte arriva con il prossimo rilascio. Intanto il conto si tocca dalla <Link href={hrefVecchia(booking.id)} className="underline underline-offset-2" style={{ color: 'var(--color-green-mid)', fontWeight: 600 }}>scheda attuale</Link>.</p>
      </section>
      <section id="messaggi" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Messaggi</p>
        <p className="mt-2" style={{ fontSize: 13, color: 'var(--color-stone)' }}>Questa parte arriva con il prossimo rilascio. Intanto i messaggi si mandano dalla <Link href={hrefVecchia(booking.id)} className="underline underline-offset-2" style={{ color: 'var(--color-green-mid)', fontWeight: 600 }}>scheda attuale</Link>.</p>
      </section>

      {/* ── Cliente: la stessa parte della proposta ───────────────────────── */}
      <section id="cliente" className="pt-[34px] pb-6 scroll-mt-28 lg:scroll-mt-16">
        <ParteCliente soggiorni={soggiorni} totaleCent={totaleSoggiorniCent} ricevuta={vuoleRicevuta(guest)} provenienza={provenienza}
          nota={guest?.notes ?? null} hrefCliente={hrefCliente} />
      </section>

      {foglioArrivo && primoSegmento && (
        <FoglioArrivo bookingId={primoSegmento.id} ora={primoSegmento.check_in_time} navetta={primoSegmento.shuttle}
          onChiudi={() => setFoglioArrivo(false)}
          onSalvato={(campi, msg) => {
            const aggiorna = (r: Prenotazione) => (r.id === primoSegmento.id ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setFoglioArrivo(false)
            if (msg) setAvviso(msg)
          }} />
      )}
      {foglioProvenienza && booking.guest_id && (
        <FoglioProvenienza guestId={booking.guest_id}
          iniziale={{ provenienza: normalizzaProvenienza(provenienzaDi(booking).provenienza), struttura: provenienzaDi(booking).struttura_nome ?? '' }}
          onChiudi={() => setFoglioProvenienza(false)}
          onSalvata={(campi: CampiProvenienza) => {
            setBooking(b => (b ? { ...b, guests: { ...(b.guests ?? {}), ...campi } } : b))
            setFoglioProvenienza(false)
          }} />
      )}
    </div>
  )
}
