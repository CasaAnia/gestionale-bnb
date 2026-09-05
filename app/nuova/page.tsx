'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import BackBar from '@/components/BackBar'
import { tariffaCamera } from '@/lib/tariffe'
import { prezzoPrenotazione, riallineaTariffa, testoDettaglioNotti, dettaglioNottiSalvato } from '@/lib/prezzoNotti'
import { lettiPoolPrenotazione } from '@/lib/lettiAggiuntivi'
import { contoSoggiorno } from '@/lib/conto'
import { smartBack, returnToSicuro } from '@/lib/navHistory'
import { messaggioErroreDati } from '@/lib/connessione'
import { scriviPoiAggiorna } from '@/lib/scritturaSicura'
import { leggiConEsito } from '@/lib/prenotazioneScritture'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampoProvenienza from '@/components/CampoProvenienza'
import { campiProvenienza, type Provenienza, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, salvaProvenienzaCliente, cercaClientePerTelefono } from '@/lib/provenienzaDati'
import { normalizzaProvenienza } from '@/lib/provenienza'
import { etichettaGiaStato } from '@/lib/clienteCheTorna'

// forme MINIME delle righe lette da Supabase (solo i campi usati qui)
type ClienteRiga = {
  id: string; full_name: string | null; email: string | null
  phone: string | null; rating: string
}
type SoggiornoRiga = {
  id: string; status: string; check_in: string; check_out: string
  total_amount: number | string; price_per_night: number | string
  num_guests: number; extra_bed?: boolean | null; notes?: string | null
  extra_bed_dates?: string[] | null; extra_bed_total?: number | string | null
  cancelled_reason?: string | null; pagato?: boolean | null
  bonifico?: boolean | null; guest_name?: string | null
  extra_phone_1_name?: string | null; chi_e?: string | null
  rooms?: { name?: string | null } | null
  guests?: ClienteRiga | null
}
type CameraRiga = {
  id: string; name: string; base_price: number | string
  bathroom_type?: string | null
  has_extra_bed?: boolean | null
  extra_bed_price?: number | string | null
  matrimoniale_price?: number | string | null
}

import CampoValutazione from '@/components/CampoValutazione'
import { valutazioneDi, vuoleRicevuta, payloadValutazione, colonnaRicevutaPresente, ETICHETTA_VALUTAZIONE, COLORE_VALUTAZIONE, ETICHETTA_RICEVUTA, ETICHETTA_RICEVUTA_BREVE, type Valutazione } from '@/lib/valutazione'

export default function NuovaPrenotazionePage() {
  return <Suspense><NuovaPrenotazione /></Suspense>
}

function NuovaPrenotazione() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedRoomId = searchParams.get('room_id') || ''
  function getTodayStr() {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }
  const preselectedCheckIn = searchParams.get('check_in') || getTodayStr()
  const preselectedGuestId = searchParams.get('guest_id') || ''
  const preselectedGroupId = searchParams.get('group_id') || ''
  // Dove tornare dopo il salvataggio: la pagina di provenienza (?returnTo=),
  // se è un percorso interno ammesso; altrimenti l'elenco prenotazioni.
  // Sta nell'URL, quindi sopravvive a refresh e apertura in nuova scheda.
  const returnTo = returnToSicuro(searchParams.get('returnTo')) || '/prenotazioni'
  function addOneDay(dateStr: string) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  }

  const [step, setStep] = useState<'telefono' | 'cliente' | 'dettagli'>('telefono')
  const [phone, setPhone] = useState('')
  const [searchName, setSearchName] = useState('')
  const [nameResults, setNameResults] = useState<ClienteRiga[]>([])
  const [guest, setGuest] = useState<ClienteRiga | null>(null)
  const [guestHistory, setGuestHistory] = useState<SoggiornoRiga[]>([])
  // Errori di salvataggio visibili, parte 2 (05/09/2026): lo storico del
  // cliente con errore lo dice (con Riprova) invece di sembrare vuoto; l'update
  // del cliente esistente è controllato prima di inserire la prenotazione
  const [erroreStorico, setErroreStorico] = useState<string | null>(null)
  const [erroreCliente, setErroreCliente] = useState<string | null>(null)
  const [rooms, setRooms] = useState<CameraRiga[]>([])
  const [form, setForm] = useState({ room_id: preselectedRoomId, check_in: preselectedCheckIn, check_out: addOneDay(preselectedCheckIn), check_in_time: '', shuttle: '', num_guests: 1, extra_bed: false, extra_bed_dates: [] as string[], use_matrimoniale: false, price_per_night: 0, notes: '', bonifico: false, source: 'diretta', extra_phone_1_name: '', chi_e: '' })
  const [guestForm, setGuestForm] = useState({ full_name: '', email: '', rating: 'normale' as Valutazione, ricevuta: false })
  // Provenienza (08/09/2026): «Come ci ha trovato»; salvata solo se la 0036 è applicata
  const [provenienza, setProvenienza] = useState<{ provenienza: Provenienza; struttura: string }>({ provenienza: 'non_so', struttura: '' })
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const [avvisoProvenienza, setAvvisoProvenienza] = useState<string | null>(null)
  const [giaStato, setGiaStato] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) { setStrutture({ disponibile: r.disponibile, lista: r.strutture }); if (r.errore) setAvvisoProvenienza(r.errore) } })
    return () => { vivo = false }
  }, [])
  // Cliente esistente: chip precompilati con la SUA provenienza e «Già stato da noi · N»
  useEffect(() => {
    let vivo = true
    // Non in modo sincrono nell'effetto (regola react-hooks): al giro dopo
    const t = setTimeout(() => {
      if (!vivo) return
      if (!guest) { setGiaStato(null); return }
      const g = guest as unknown as Record<string, unknown>
      if ('provenienza' in g) setProvenienza({ provenienza: normalizzaProvenienza(g.provenienza), struttura: (g.struttura_nome as string) ?? '' })
      const d = new Date(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      cercaClientePerTelefono(String(g.phone ?? ''), iso).then(c => { if (vivo) setGiaStato(c ? etichettaGiaStato(c.soggiorniConclusi) : null) })
    }, 0)
    return () => { vivo = false; clearTimeout(t) }
  }, [guest])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedGroupId, setSavedGroupId] = useState<string | null>(null)
  const [savedCheckOut, setSavedCheckOut] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  // Ricerca fallita (rete o server): si dice e si resta sulla ricerca. Prima
  // un errore di rete passava per «nessun risultato» e proponeva «nuovo
  // cliente»: rischio di doppioni e, senza linea, tasto bloccato su «Ricerca...».
  const [searchError, setSearchError] = useState<string | null>(null)
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set())
  const [conflitto, setConflitto] = useState<string | null>(null)
  const [lettiOccupati, setLettiOccupati] = useState(0)
  const [extraBedsPerDay, setExtraBedsPerDay] = useState<Record<string, number>>({})
  const checkOutRef = useRef<HTMLInputElement>(null)
  function getDaysBetween(checkIn: string, checkOut: string): string[] {
    if (!checkIn || !checkOut) return []
    const days: string[] = []
    const [sy, sm, sd] = checkIn.split('-').map(Number)
    const [ey, em, ed] = checkOut.split('-').map(Number)
    const d = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    while (d < end) {
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      d.setDate(d.getDate() + 1)
    }
    return days
  }

  useEffect(() => {
    supabase.from('rooms').select('*').eq('active', true).then(({ data }) => {
      const ORDER = ['Amelia', 'Allegra', 'Ambra', 'Lena']
      const sorted = (data || []).sort((a, b) => {
        const ai = ORDER.findIndex(o => a.name.includes(o))
        const bi = ORDER.findIndex(o => b.name.includes(o))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      setRooms(sorted)
      if (preselectedRoomId) {
        const room = ((data || []) as CameraRiga[]).find(r => r.id === preselectedRoomId)
        if (room) setForm(f => ({ ...f, price_per_night: Number(room.base_price) }))
        if (preselectedCheckIn) checkDisponibilita(preselectedRoomId, preselectedCheckIn, addOneDay(preselectedCheckIn))
      }
    })
    if (preselectedGuestId) loadGuestById(preselectedGuestId)
  }, [])

  // Storico soggiorni del cliente: con un errore la lista resta vuota MA
  // compare l'avviso con «Riprova» (lib/prenotazioneScritture.leggiConEsito)
  async function caricaStorico(guestId: string) {
    setErroreStorico(null)
    const { data, errore } = await leggiConEsito<SoggiornoRiga[]>(
      () => supabase.from('bookings').select('*, rooms(name)').eq('guest_id', guestId).order('check_in', { ascending: false }),
      'caricare lo storico del cliente')
    setGuestHistory(errore ? [] : (data || []))
    setErroreStorico(errore)
  }

  async function loadGuestById(guestId: string) {
    const { data: g, error } = await supabase.from('guests').select('*').eq('id', guestId).single()
    if (error) { setSearchError(messaggioErroreDati(error, 'caricare il cliente')); return }
    if (g) {
      setGuest(g)
      setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: valutazioneDi(g), ricevuta: vuoleRicevuta(g) })
      await caricaStorico(g.id)
      setStep('cliente')
    }
  }

  async function searchByName() {
    if (!searchName.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    try {
      await cercaPerNome(searchName.trim())
    } catch (err) {
      setSearchError(messaggioErroreDati(err, 'cercare il cliente'))
    } finally {
      setSearchLoading(false)
    }
  }

  async function cercaPerNome(q: string) {
    // cerca tra i clienti principali
    const { data: guestMatches, error: e1 } = await supabase.from('guests').select('*').ilike('full_name', `%${q}%`).order('created_at', { ascending: false }).limit(10)
    if (e1) { setSearchError(messaggioErroreDati(e1, 'cercare il cliente')); return }

    // cerca tra i nomi secondari nelle prenotazioni
    const { data: extraMatches, error: e2 } = await supabase.from('bookings')
      .select('*, guests(*)')
      .or(`extra_phone_1_name.ilike.%${q}%,extra_phone_2_name.ilike.%${q}%`)
      .neq('status', 'annullata')
      .order('check_in', { ascending: false })
      .limit(5)
    if (e2) { setSearchError(messaggioErroreDati(e2, 'cercare il cliente')); return }

    // unisci i risultati (evita duplicati per id)
    const seen = new Set<string>()
    const combined: ClienteRiga[] = []
    for (const g of guestMatches || []) { if (!seen.has(g.id)) { seen.add(g.id); combined.push(g) } }
    for (const b of extraMatches || []) { if (b.guests && !seen.has(b.guests.id)) { seen.add(b.guests.id); combined.push(b.guests) } }

    if (combined.length === 1) {
      const g = combined[0]
      setGuest(g)
      setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: valutazioneDi(g), ricevuta: vuoleRicevuta(g) })
      await caricaStorico(g.id)
      setNameResults([])
      setStep('cliente')
    } else if (combined.length > 1) {
      setNameResults(combined)
    } else {
      setGuest(null)
      setGuestForm({ full_name: q, email: '', rating: 'normale', ricevuta: false })
      setGuestHistory([])
      setNameResults([])
      setStep('cliente')
    }
  }

  async function selectGuestFromList(g: ClienteRiga) {
    setGuest(g)
    setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: valutazioneDi(g), ricevuta: vuoleRicevuta(g) })
    await caricaStorico(g.id)
    setNameResults([])
    setStep('cliente')
  }

  async function searchPhone() {
    if (!phone.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    try {
      await cercaPerTelefono()
    } catch (err) {
      setSearchError(messaggioErroreDati(err, 'cercare il cliente'))
    } finally {
      setSearchLoading(false)
    }
  }

  async function cercaPerTelefono() {
    const raw = phone.trim().replace(/\D/g, '')
    const t = raw.startsWith('39') ? raw : `39${raw}`
    const { data: existingGuest, error: e1 } = await supabase.from('guests').select('*').eq('phone', t).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (e1) { setSearchError(messaggioErroreDati(e1, 'cercare il cliente')); return }
    if (existingGuest) {
      setGuest(existingGuest)
      setGuestForm({ full_name: existingGuest.full_name || '', email: existingGuest.email || '', rating: valutazioneDi(existingGuest), ricevuta: vuoleRicevuta(existingGuest) })
      await caricaStorico(existingGuest.id)
    } else {
      // cerca nei contatti extra (prova sia con che senza prefisso 39)
      const tShort = t.startsWith('39') ? t.slice(2) : t
      // maybeSingle e non single: «nessuna riga» qui è normale, non un errore
      const { data: extraMatch, error: e2 } = await supabase.from('bookings')
        .select('*, guests(*)')
        .or(`extra_phone_1.eq.${t},extra_phone_2.eq.${t},extra_phone_1.eq.${tShort},extra_phone_2.eq.${tShort}`)
        .neq('status', 'annullata')
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e2) { setSearchError(messaggioErroreDati(e2, 'cercare il cliente')); return }
      if (extraMatch?.guests) {
        const g = extraMatch.guests
        setGuest(g)
        setGuestForm({ full_name: g.full_name || '', email: g.email || '', rating: valutazioneDi(g), ricevuta: vuoleRicevuta(g) })
        await caricaStorico(g.id)
      } else {
        setGuest(null)
        setGuestForm({ full_name: '', email: '', rating: 'normale', ricevuta: false })
        setGuestHistory([])
      }
    }
    setStep('cliente')
  }

  // Totale dalla funzione unica del conto (nessuno sconto alla creazione:
  // gli sconti si applicano dalla modifica della prenotazione)
  function calcTotal() {
    if (!form.check_in || !form.check_out) return 0
    return contoSoggiorno({
      check_in: form.check_in, check_out: form.check_out,
      price_per_night: form.price_per_night, extra_bed_total: extraBedTotal(),
    }).totale
  }

  // Conto NOTTE PER NOTTE (lib/prezzoNotti): nelle notti col letto ci sono
  // num_guests persone, nelle altre la capienza base; la tariffa del form è
  // quella della notte più economica. Con persone uguali è il conto di sempre.
  function contoNotti() {
    const room = rooms.find(r => r.id === form.room_id)
    return prezzoPrenotazione(room, { ...form, extra_bed_dates: form.extra_bed ? form.extra_bed_dates : [] })
  }

  // Letto e differenze di tariffa fra le notti: tutto ciò che supera tariffa × notti
  // (0 quando il letto è già compreso nella tariffa: Lena fino a 3 ospiti)
  function extraBedTotal() {
    if (!form.extra_bed) return 0
    return contoNotti().lettoTotale
  }

  // Campo «Tariffa/notte» dopo una modifica di date o notti col letto: se
  // seguiva il listino continua a seguirlo, se scritto a mano resta
  function tariffaDopo(f: typeof form, dopo: Partial<typeof form>) {
    const room = rooms.find(r => r.id === (dopo.room_id ?? f.room_id))
    return riallineaTariffa(room, f, { ...f, ...dopo })
  }

  function parseDate(s: string) { return new Date(s.replace(/-/g, '/')) }

  function fmtRange(ci: string, co: string) {
    if (!ci || !co) return ''
    const a = parseDate(ci), b = parseDate(co)
    const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    const left = sameMonth ? String(a.getDate()) : a.toLocaleDateString('it-IT', short)
    return `${left}–${b.toLocaleDateString('it-IT', short)} ${b.getFullYear()}`
  }

  function statusBadge(h: SoggiornoRiga) {
    if (h.status === 'annullata') return { label: 'Annullata', dot: '#8C3B2E' }
    if (h.pagato) return { label: 'Pagato', dot: '#7D9DB0' }
    if (h.bonifico) return { label: 'Bonifico', dot: '#9B8EC4' }
    return { label: 'Prenotazione', dot: '#6C9A7C' }
  }

  function toggleHistory(id: string) {
    setOpenHistory(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function notti() {
    if (!form.check_in || !form.check_out) return 0
    return Math.round((parseDate(form.check_out).getTime() - parseDate(form.check_in).getTime()) / 86400000)
  }

  async function checkDisponibilita(room_id: string, check_in: string, check_out: string) {
    if (!room_id || !check_in || !check_out) return
    const [{ data: conf }, { data: letti }] = await Promise.all([
      supabase.from('bookings')
        .select('id, check_in, check_out, guest_name, rooms(name), guests(full_name)')
        .eq('room_id', room_id).neq('status', 'annullata')
        .lt('check_in', check_out).gt('check_out', check_in),
      supabase.from('bookings')
        .select('id, room_id, num_guests, extra_bed, extra_bed_dates, check_in, check_out').eq('extra_bed', true).neq('status', 'annullata')
        .lt('check_in', check_out).gt('check_out', check_in),
    ])
    if (conf && conf.length > 0) {
      const b = conf[0] as unknown as SoggiornoRiga
      setConflitto(`⚠️ ${b.rooms?.name || 'Camera'} già occupata dal ${b.check_in} al ${b.check_out} (${b.guest_name || b.guests?.full_name || 'altro cliente'})`)
    } else {
      setConflitto(null)
    }
    const perDay: Record<string, number> = {}
    for (const b of letti || []) {
      const bDays = b.extra_bed_dates?.length > 0 ? b.extra_bed_dates : getDaysBetween(b.check_in, b.check_out)
      const contrib = lettiPoolPrenotazione(b)
      for (const day of bDays) perDay[day] = (perDay[day] || 0) + contrib
    }
    setExtraBedsPerDay(perDay)
    setLettiOccupati(Math.max(0, ...Object.values(perDay), 0))
  }

  async function save() {
    // Blocco di sicurezza: non salvare mai date impossibili (check-out non successivo al check-in)
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setSaveError('Date non valide: il check-out deve essere almeno una notte dopo il check-in.')
      return
    }
    setSaving(true)
    setSaveError(null)
    let guestId = guest?.id
    if (!guestId) {
      const rawP = phone.trim().replace(/\D/g, '')
      const formattedPhone = rawP ? (rawP.startsWith('39') ? rawP : `39${rawP}`) : null
      // Cliente nuovo: la provenienza nasce con lui (solo a 0037 applicata)
      const baseCliente = { phone: formattedPhone, full_name: guestForm.full_name || null, email: guestForm.email || null, ...(strutture.disponibile ? campiProvenienza(provenienza.provenienza, provenienza.struttura) : {}) }
      // Valutazione + ricevuta (0038): colonna nuova se c'è, altrimenti la forma vecchia
      let { data: newGuest, error: guestError } = await supabase.from('guests').insert({ ...baseCliente, ...payloadValutazione(guestForm.rating, guestForm.ricevuta, true) }).select().single()
      if (guestError && /vuole_ricevuta/i.test(guestError.message || '')) ({ data: newGuest, error: guestError } = await supabase.from('guests').insert({ ...baseCliente, ...payloadValutazione(guestForm.rating, guestForm.ricevuta, false) }).select().single())
      if (guestError || !newGuest) {
        setSaveError(`Errore creazione cliente: ${guestError?.message || 'sconosciuto'}`)
        setSaving(false)
        return
      }
      guestId = newGuest.id
    } else {
      // Cliente esistente: se i suoi dati non si salvano, la prenotazione NON
      // viene inserita (mai una prenotazione con un cliente non aggiornato senza dirlo)
      setErroreCliente(null)
      const idCliente = guestId
      const errore = await scriviPoiAggiorna(
        () => supabase.from('guests').update({ full_name: guestForm.full_name || null, email: guestForm.email || null, ...payloadValutazione(guestForm.rating, guestForm.ricevuta, colonnaRicevutaPresente(guest as unknown as { vuole_ricevuta?: boolean })) }).eq('id', idCliente),
        () => {},
      )
      if (errore) {
        setErroreCliente(`${errore}: i dati del cliente non sono stati salvati`)
        setSaving(false)
        return
      }
    }
    const ebt = extraBedTotal()
    // Se è un cambio camera usa il group_id esistente, altrimenti ne crea uno nuovo
    const groupId = savedGroupId || preselectedGroupId || crypto.randomUUID()
    const { error: bookingError } = await supabase.from('bookings').insert({
      room_id: form.room_id, guest_id: guestId, check_in: form.check_in, check_out: form.check_out,
      check_in_time: form.check_in_time || null,
      num_guests: form.num_guests, extra_bed: form.extra_bed_dates.length > 0, extra_bed_dates: form.extra_bed_dates, price_per_night: Number(form.price_per_night),
      extra_bed_total: ebt, total_amount: calcTotal(), notes: form.notes || null, status: 'confermata', source: form.source,
      bonifico: form.bonifico, pagato: false, group_id: groupId,
      extra_phone_1_name: form.extra_phone_1_name || null,
      // chi_e incluso solo se valorizzato: così il salvataggio funziona anche se la colonna non è ancora stata creata su Supabase
      ...(form.chi_e ? { chi_e: form.chi_e } : {}),
      // navetta: stessa regola (vuoto = "da definire", non si salva nulla)
      ...(form.shuttle ? { shuttle: form.shuttle } : {}),
    })
    // Cliente esistente: la provenienza è la sua e vale per tutti i suoi soggiorni
    if (!bookingError && strutture.disponibile && guest?.id) {
      const errCliente = await salvaProvenienzaCliente(guest.id, campiProvenienza(provenienza.provenienza, provenienza.struttura))
      if (errCliente) setAvvisoProvenienza(`Prenotazione salvata, ma la provenienza del cliente non è stata aggiornata: ${errCliente}`)
    }
    // Nome di struttura nuovo → entra nell'elenco (non blocca il salvataggio)
    if (!bookingError && strutture.disponibile && provenienza.provenienza === 'altra_struttura') {
      const errStruttura = await ricordaStruttura(provenienza.struttura, strutture.lista)
      if (errStruttura) setAvvisoProvenienza(`Prenotazione salvata, ma il nome della struttura non è stato aggiunto all'elenco: ${errStruttura}`)
    }
    setSaving(false)
    if (bookingError) {
      setSaveError(`Errore salvataggio prenotazione: ${bookingError.message}`)
      return
    }
    setSavedGroupId(groupId)
    setSavedCheckOut(form.check_out)
  }

  // Schermata post-salvataggio: propone cambio camera o fine
  if (savedGroupId && savedCheckOut) {
    const room = rooms.find(r => r.id === form.room_id)
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="bg-sage border border-[#C9DDD0] rounded-2xl p-6 text-center mb-6">
          <p className="text-3xl mb-2">✓</p>
          <p className="font-bold text-green-dark text-lg">Prenotazione salvata</p>
          <p className="text-green-dark text-sm mt-1">{room?.name} · check-out {savedCheckOut}</p>
        </div>
        <p className="text-center text-gray-600 font-semibold mb-4">Vuoi aggiungere un cambio camera?</p>
        <button
          onClick={() => {
            setStep('dettagli')
            setForm(f => ({
              ...f,
              room_id: '',
              check_in: savedCheckOut,
              check_out: addOneDay(savedCheckOut),
              check_in_time: '',
              shuttle: '',
              extra_bed: false,
              extra_bed_dates: [],
              price_per_night: 0,
              notes: '',
            }))
            setSavedCheckOut(null)
          }}
          className="w-full bg-green-mid text-white font-bold py-4 rounded-2xl text-base mb-3"
        >
          ➕ Aggiungi cambio camera
        </button>
        <button
          onClick={() => router.push(returnTo)}
          className="w-full border border-gray-300 text-gray-700 font-semibold py-4 rounded-2xl text-base"
        >
          {returnTo === '/calendario' ? 'Fine — torna al calendario'
            : returnTo.startsWith('/prenotazioni/') ? 'Fine — torna alla prenotazione'
            : returnTo === '/prenotazioni' ? 'Fine — vai alle prenotazioni'
            : 'Fine — torna indietro'}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <BackBar onClick={() => step === 'telefono' ? smartBack(router, '/') : setStep(step === 'dettagli' ? 'cliente' : 'telefono')} />
      <h1 className="font-serif text-xl text-green-dark max-lg:hidden mb-4">Nuova prenotazione</h1>

      {/* Step 1: telefono o nome */}
      {step === 'telefono' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm">
            <p className="font-semibold mb-3">📞 Cerca per telefono</p>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPhone()}
              placeholder="+39 333 1234567"
              className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-lg mb-3 focus:outline-none focus:border-green-mid"
              autoFocus
            />
            <button onClick={searchPhone} disabled={!phone.trim() || searchLoading}
              className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
              {searchLoading ? 'Ricerca...' : 'Cerca →'}
            </button>
          </div>

          {searchError && (
            <div role="alert" className="scheda-in rounded-xl px-4 py-3 shadow-sm text-[13.5px]" style={{ background: '#F4E6DF', color: '#7A3B22' }}>
              {searchError}
            </div>
          )}

          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">oppure</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm">
            <p className="font-semibold mb-3">👤 Cerca per nome</p>
            <input
              type="text" value={searchName} onChange={e => { setSearchName(e.target.value); setNameResults([]) }}
              onKeyDown={e => e.key === 'Enter' && searchByName()}
              placeholder="Nome e cognome"
              className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-lg mb-3 focus:outline-none focus:border-green-mid"
            />
            <button onClick={searchByName} disabled={!searchName.trim() || searchLoading}
              className="w-full bg-gray-700 text-white rounded-xl py-3 font-semibold disabled:opacity-50">
              {searchLoading ? 'Ricerca...' : 'Cerca →'}
            </button>
            {nameResults.length > 1 && (
              <div className="mt-3 border-t border-card-border pt-3">
                <p className="text-sm text-gray-500 mb-2">Più clienti trovati — seleziona:</p>
                {nameResults.map(g => (
                  <button key={g.id} onClick={() => selectGuestFromList(g)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-[#C9BFA8] shadow-sm mb-1.5 hover:bg-sage active:bg-sage">
                    <p className="font-semibold text-sm">{g.full_name}</p>
                    <p className="text-xs text-gray-400">📞 {g.phone || '—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: dati cliente + storico */}
      {step === 'cliente' && (
        <div>
          {guest ? (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-green-dark">✅ Cliente trovato</p>
                <span className="flex flex-col items-end gap-1"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${COLORE_VALUTAZIONE[valutazioneDi(guest)]}`}>{ETICHETTA_VALUTAZIONE[valutazioneDi(guest)]}</span>{vuoleRicevuta(guest) && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-sage text-green-mid">{ETICHETTA_RICEVUTA}</span>}</span>
              </div>
              <p className="font-semibold">{guest.full_name || phone}</p>
              <p className="text-sm text-gray-500">📞 {guest.phone}</p>
              {guest.email && <p className="text-sm text-gray-500">✉️ {guest.email}</p>}
              {erroreStorico && guest && (
                <AvvisoAzione testo={erroreStorico} onRiprova={() => { void caricaStorico(guest.id) }} className="mt-3" />
              )}
              {guestHistory.length > 0 && (
                <div className="mt-3 border-t border-card-border pt-3">
                  <p className="text-[11px] uppercase mb-2 text-brass" style={{ letterSpacing: '2px' }}>Storico soggiorni ({guestHistory.length})</p>
                  <p className="text-sm font-semibold text-green-mid mb-2">Totale speso: €{guestHistory.filter(h => h.status !== 'annullata').reduce((s: number, h) => s + Number(h.total_amount), 0).toFixed(0)}</p>
                  {guestHistory.map(h => {
                    const open = openHistory.has(h.id)
                    const badge = statusBadge(h)
                    const notti = h.check_in && h.check_out ? Math.round((parseDate(h.check_out).getTime() - parseDate(h.check_in).getTime()) / 86400000) : 0
                    return (
                    <div key={h.id} className="border-b-[0.5px] border-border-soft last:border-0">
                      <button onClick={() => toggleHistory(h.id)} className="w-full flex items-center gap-2 py-2.5 text-left">
                        <span className="text-[#2D6A4F] text-xs shrink-0 transition-transform duration-150" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${h.status === 'annullata' ? 'line-through text-gray-400' : 'text-[#1F3D2F]'}`}>
                            {fmtRange(h.check_in, h.check_out)} · {h.rooms?.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {h.extra_phone_1_name || '—'}
                            {h.chi_e && <span className="ml-1.5 px-2 py-px rounded-full bg-[#EDE6D6] text-[#5a6b3f] text-[10px] font-medium">{h.chi_e}</span>}
                          </p>
                        </div>
                        <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-green-dark">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: badge.dot }} />{badge.label}
                        </span>
                      </button>
                      {open && (
                        <div className="bg-[#F6F2EA] rounded-lg p-3 mb-2 ml-5 text-xs space-y-1">
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#1F3D2F]">
                            <span>👥 {h.num_guests} {h.num_guests === 1 ? 'ospite' : 'ospiti'}</span>
                            <span className="font-semibold">€{Number(h.total_amount).toFixed(0)} <span className="font-normal text-gray-500">({(() => {
                              const dett = dettaglioNottiSalvato(rooms.find(r => r.name === h.rooms?.name), h)
                              return dett ? testoDettaglioNotti(dett, n => `€${n}`) : `${notti}n × €${Number(h.price_per_night).toFixed(0)}`
                            })()})</span></span>
                            {h.extra_bed && <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#C58A67' }} />Letto extra</span>}
                          </div>
                          {h.notes
                            ? <p className="text-[#1F3D2F] whitespace-pre-wrap">📝 {h.notes}</p>
                            : <p className="text-gray-400 italic">📝 Nessuna nota</p>}
                          {h.status === 'annullata' && h.cancelled_reason && (
                            <p className="text-[#8C3B2E] italic">↳ {h.cancelled_reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
              <p className="font-semibold text-green-mid mb-1">➕ Nuovo cliente</p>
              {/* Quello che hai scritto nella ricerca resta qui: dal telefono
                  il numero è già compilato; dal NOME il numero si aggiunge
                  ADESSO da questo campo (prima era testo fisso e chi cercava
                  per nome non poteva più inserirlo). */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-mid">📞</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Numero di telefono"
                  className="flex-1 border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm bg-white" />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
            <p className="font-semibold mb-3">{guest ? 'Aggiorna dati' : 'Dati cliente'}</p>
            <input value={guestForm.full_name} onChange={e => setGuestForm({...guestForm, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" />
            <input value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})}
              placeholder="Email (opzionale)" className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" type="email" />
            <CampoValutazione valutazione={guestForm.rating} ricevuta={guestForm.ricevuta} onChange={v => setGuestForm({ ...guestForm, rating: v.valutazione, ricevuta: v.ricevuta })} />
          </div>

          <button onClick={() => setStep('dettagli')} className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold">
            Continua →
          </button>
        </div>
      )}

      {/* Step 3: dettagli prenotazione */}
      {step === 'dettagli' && (
        <div>
          <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
            <p className="font-semibold mb-3">Dettagli prenotazione</p>

            <p className="text-sm text-gray-500 mb-1">Camera</p>
            <select value={form.room_id} onChange={e => {
              const room = rooms.find(r => r.id === e.target.value)
              const newRoomId = e.target.value
              // Cambiando camera si riapplica la regola con gli ospiti già inseriti
              const { prezzoNotte, lettiPool } = tariffaCamera(room, form.num_guests)
              const letto = lettiPool > 0
              setForm({...form, room_id: newRoomId, use_matrimoniale: false,
                price_per_night: room ? prezzoNotte : 0,
                extra_bed: letto,
                extra_bed_dates: letto ? getDaysBetween(form.check_in, form.check_out) : []})
              checkDisponibilita(newRoomId, form.check_in, form.check_out)
            }} className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 mb-3 text-sm">
              <option value="">Seleziona camera</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} — €{r.base_price}/notte{r.bathroom_type === 'privato_esterno' ? ' (bagno esterno)' : ''}</option>
              ))}
            </select>

            {/* I campi data nativi di iPhone hanno una larghezza minima propria:
                min-w-0 + appearance-none impediscono alle due caselle di sovrapporsi. */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 mb-1">Check-in</p>
                <input type="date" defaultValue={form.check_in}
                  onChange={e => {
                    const newCheckIn = e.target.value
                    if (!newCheckIn) return
                    const newCheckOut = addOneDay(newCheckIn)
                    if (checkOutRef.current) checkOutRef.current.value = newCheckOut
                    setForm(f => ({ ...f, check_in: newCheckIn, check_out: newCheckOut, price_per_night: tariffaDopo(f, { check_in: newCheckIn, check_out: newCheckOut }) }))
                    checkDisponibilita(form.room_id, newCheckIn, newCheckOut)
                  }}
                  className="w-full min-w-0 appearance-none bg-white border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 mb-1">Check-out</p>
                <input type="date" ref={checkOutRef} defaultValue={form.check_out} min={form.check_in ? addOneDay(form.check_in) : undefined} onChange={e => {
                  setForm({...form, check_out: e.target.value, price_per_night: tariffaDopo(form, { check_out: e.target.value })})
                  checkDisponibilita(form.room_id, form.check_in, e.target.value)
                }} className="w-full min-w-0 appearance-none bg-white border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">🕐 Orario arrivo (opzionale)</p>
              <input type="text" inputMode="numeric" placeholder="HH:MM"
                value={form.check_in_time}
                onChange={e => {
                  let v = e.target.value.replace(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':') && form.check_in_time.length === 1) v = v + ':'
                  setForm({...form, check_in_time: v})
                }}
                maxLength={5}
                className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
            </div>

            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">🚌 Navetta</p>
              <div className="flex gap-1.5">
                {([['', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setForm({ ...form, shuttle: v })}
                    className={`rounded-full text-sm font-semibold px-4 py-1.5 ${form.shuttle === v ? 'text-white' : 'border border-[#C9BFA8] bg-white text-stone'}`}
                    style={form.shuttle === v ? { background: '#2D6A4F' } : undefined}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">N° ospiti</p>
                <input type="number" min={1} max={4} value={form.num_guests} onChange={e => {
                  const n = parseInt(e.target.value)
                  const room = rooms.find(r => r.id === form.room_id)
                  // Regola unica (lib/tariffe): prezzo e letti impegnati dal pool
                  const { prezzoNotte, lettiPool } = tariffaCamera(room, n)
                  const autoLetto = lettiPool > 0
                  const autoDates = autoLetto ? getDaysBetween(form.check_in, form.check_out) : []
                  setForm({...form, num_guests: n, extra_bed: autoLetto, extra_bed_dates: autoDates, price_per_night: room ? prezzoNotte : form.price_per_night})
                }}
                  className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Tariffa/notte €</p>
                <input type="number" min={0} value={form.price_per_night} onChange={e => setForm({...form, price_per_night: parseFloat(e.target.value)})}
                  className="w-full border border-[#C9BFA8] shadow-sm rounded-lg p-2 text-sm" />
              </div>
            </div>

            {(() => {
              const room = rooms.find(r => r.id === form.room_id)
              return <>
                {room?.has_extra_bed && (
                  <>
                    <div className="flex items-center justify-between bg-[#F1E0CE] rounded-lg p-3 mb-1 border border-[#E7CDAE]">
                      <div>
                        <p className="text-sm font-semibold text-[#7A4B22]">🛏 Letto aggiuntivo</p>
                        <p className="text-xs text-[#7A4B22]">+€{room.extra_bed_price}/notte</p>
                      </div>
                      <button onClick={() => {
                        const newVal = !form.extra_bed
                        const dates = newVal ? getDaysBetween(form.check_in, form.check_out) : []
                        setForm({...form, extra_bed: newVal, extra_bed_dates: dates, price_per_night: tariffaDopo(form, { extra_bed: newVal, extra_bed_dates: dates })})
                      }}
                        className={`w-12 h-6 rounded-full transition-colors ${form.extra_bed ? 'bg-[#C58A67]' : 'bg-gray-200'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.extra_bed ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>
                    {form.extra_bed && form.check_in && form.check_out && (
                      <div className="mt-2 mb-1">
                        <p className="text-xs text-gray-500 mb-1.5">Seleziona i giorni con letto extra:</p>
                        <div className="flex flex-wrap gap-1">
                          {getDaysBetween(form.check_in, form.check_out).map(day => {
                            const [y, m, d] = day.split('-').map(Number)
                            const date = new Date(y, m - 1, d)
                            const isSelected = form.extra_bed_dates.includes(day)
                            const thisContrib = lettiPoolPrenotazione({ ...form, extra_bed: true })
                            const othersOnDay = extraBedsPerDay[day] || 0
                            const isBlocked = othersOnDay + thisContrib > 2
                            return (
                              <button key={day} disabled={isBlocked && !isSelected}
                                onClick={() => {
                                  const dates = isSelected
                                    ? form.extra_bed_dates.filter(x => x !== day)
                                    : [...form.extra_bed_dates, day]
                                  setForm({ ...form, extra_bed_dates: dates, price_per_night: tariffaDopo(form, { extra_bed_dates: dates }) })
                                }}
                                className="px-2 py-1 rounded text-xs font-semibold border transition-colors"
                                style={{ background: isBlocked ? '#1f2937' : isSelected ? '#ef4444' : 'white', color: isBlocked || isSelected ? 'white' : '#6b7280', borderColor: isBlocked ? '#1f2937' : isSelected ? '#ef4444' : '#e5e7eb', opacity: isBlocked && !isSelected ? 0.6 : 1 }}>
                                {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {lettiOccupati >= 2 && !form.extra_bed && (
                      <p className="text-xs text-[#8C3B2E] font-semibold mb-3 px-1">⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date</p>
                    )}
                    {lettiOccupati === 1 && !form.extra_bed && (
                      <p className="text-xs text-[#7A4B22] mb-3 px-1">⚠️ 1 letto aggiuntivo già occupato in queste date</p>
                    )}
                    {<div className="mb-3" />}
                  </>
                )}
                {room?.matrimoniale_price != null && (
                  <div className="flex items-center justify-between bg-[#EFEAF7] rounded-lg p-3 mb-3 border border-[#D9D0EA]">
                    <div>
                      <p className="text-sm font-semibold text-[#5B4E82]">💑 Uso matrimoniale</p>
                      <p className="text-xs text-[#5B4E82]">€{room.matrimoniale_price}/notte</p>
                    </div>
                    <button onClick={() => {
                      const useM = !form.use_matrimoniale
                      setForm({...form, use_matrimoniale: useM, price_per_night: useM ? Number(room.matrimoniale_price) : Number(room.base_price)})
                    }}
                      className={`w-12 h-6 rounded-full transition-colors ${form.use_matrimoniale ? 'bg-[#9B8EC4]' : 'bg-gray-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.use_matrimoniale ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                )}
              </>
            })()}

            <div onClick={() => setForm({...form, bonifico: !form.bonifico})}
              className="flex items-center justify-between bg-white rounded-lg p-3 mb-3 border border-[#C9BFA8] shadow-sm cursor-pointer active:opacity-70">
              <div>
                <p className="text-sm font-semibold text-green-dark">🏦 Pagamento tramite bonifico</p>
                <p className="text-xs text-green-mid">La conferma includerà l&apos;IBAN</p>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.bonifico ? 'bg-green-mid' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.bonifico ? 'translate-x-6' : ''}`} />
              </div>
            </div>

            {/* Provenienza del cliente: con "Sito" la prenotazione mostra il
                pallino 🌐 sul calendario anche se inserita a mano (cliente
                trovato dal sito che poi ha scritto su WhatsApp) */}
            <div className="mb-3">
              <p className="text-sm text-gray-500 mb-1">Il cliente è arrivato da</p>
              <div className="flex gap-2">
                {([['diretta', 'Diretta'], ['sito_web', '🌐 Sito'], ['whatsapp', 'WhatsApp']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm({ ...form, source: val })}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${form.source === val ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-[#C9BFA8]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <CampoProvenienza compatto valore={provenienza} onChange={setProvenienza} strutture={strutture.lista} disponibile={strutture.disponibile} nota={giaStato} nota2={guest && vuoleRicevuta(guest) ? ETICHETTA_RICEVUTA_BREVE : null} />
              {avvisoProvenienza && <p className="text-xs text-stone mt-1">{avvisoProvenienza}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Nome aggiuntivo</p>
                <input value={form.extra_phone_1_name} onChange={e => setForm({...form, extra_phone_1_name: e.target.value})}
                  placeholder="Nome" className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Chi è</p>
                <input value={form.chi_e} onChange={e => setForm({...form, chi_e: e.target.value})}
                  placeholder="mamma, collega..." className="w-full border border-card-border rounded-lg p-2 text-sm" />
              </div>
            </div>

            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note (opzionale)" className="w-full border border-card-border rounded-lg p-2 text-sm mb-3" />
          </div>

          {conflitto && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              {conflitto}
            </div>
          )}

          {lettiOccupati >= 2 && !form.extra_bed && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              ⚠️ Entrambi i letti aggiuntivi sono già occupati in queste date
            </div>
          )}

          {notti() > 0 && form.price_per_night > 0 && (
            <div className={`rounded-xl p-4 border mb-4 ${form.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-sage border-card-border'}`}>
              <p className="font-semibold text-gray-700 mb-1">Riepilogo</p>
              {(() => {
                // Tariffa diversa fra le notti (persone che cambiano): dettaglio per
                // notte tutto compreso, mai un «prezzo a notte» unico che sarebbe falso
                const c = contoNotti()
                return c.tariffaUniforme ? <>
                  <p className="text-sm text-gray-600">{notti()} notti × €{form.price_per_night}</p>
                  {form.extra_bed && <p className="text-sm text-[#7A4B22]">+ Letto agg.: €{extraBedTotal().toFixed(0)}</p>}
                </> : <p className="text-sm text-gray-600">{testoDettaglioNotti(c.notti, n => `€${n}`)}</p>
              })()}
              <p className="font-serif text-2xl text-green-dark mt-1">Totale: €{calcTotal().toFixed(0)}</p>
            </div>
          )}

          {saveError && (
            <div className="bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 mb-4 text-sm text-[#8C3B2E] font-semibold">
              ❌ {saveError}
            </div>
          )}
          {erroreCliente && <AvvisoAzione testo={erroreCliente} className="mb-4" />}

          <button onClick={save} disabled={saving || !form.room_id || !form.check_in || !form.check_out || notti() <= 0 || !!conflitto || (form.extra_bed && form.extra_bed_dates.some(day => { const contrib = lettiPoolPrenotazione({ ...form, extra_bed: true }); return (extraBedsPerDay[day] || 0) + contrib > 2 }))}
            className="w-full bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-50">
            {saving ? 'Salvataggio...' : '✅ Salva prenotazione'}
          </button>
        </div>
      )}
    </div>
  )
}
