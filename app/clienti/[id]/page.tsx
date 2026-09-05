'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import BackBar from '@/components/BackBar'
import DocumentiCliente from '@/components/DocumentiCliente'
import AvvisoAzione from '@/components/AvvisoAzione'
import { scriviPoiAggiorna } from '@/lib/scritturaSicura'
import CampoProvenienza from '@/components/CampoProvenienza'
import { campiProvenienza, normalizzaProvenienza, rigaCliente, clienteConProvenienza, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura } from '@/lib/provenienzaDati'
import { soggiorniConclusi } from '@/lib/clienteCheTorna'
import { leggiConEsito } from '@/lib/prenotazioneScritture'
import { storicoCliente, prenotazioneValida } from '@/lib/statistiche'

import CampoValutazione from '@/components/CampoValutazione'
import { valutazioneDi, vuoleRicevuta, payloadValutazione, colonnaRicevutaPresente, ETICHETTA_VALUTAZIONE, COLORE_VALUTAZIONE, ETICHETTA_RICEVUTA } from '@/lib/valutazione'

export default function ClienteDetail() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [guest, setGuest] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  // Errori di salvataggio visibili, parte 2 (05/09/2026): ogni chiamata
  // controlla error; con un errore lo stato locale non cambia e compare
  // l'avviso vicino all'azione (niente «Cliente non trovato» per un errore di rete).
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  const [erroreSalva, setErroreSalva] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [erroreElimina, setErroreElimina] = useState<string | null>(null)
  // Provenienza del cliente (0037): i chip anche qui; strutture note per i suggerimenti
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[]; avviso: string | null }>({ disponibile: false, lista: [], avviso: null })
  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture, avviso: r.avviso ?? r.errore }) })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    let vivo = true
    leggiConEsito<{ cliente: Record<string, unknown> | null; prenotazioni: Record<string, unknown>[] }>(async () => {
      const [rg, rb] = await Promise.all([
        supabase.from('guests').select('*').eq('id', id).maybeSingle(),
        supabase.from('bookings').select('*, rooms(name)').eq('guest_id', id).order('check_in', { ascending: false }),
      ])
      if (rg.error) return { data: null, error: rg.error }
      if (rb.error) return { data: null, error: rb.error }
      return { data: { cliente: rg.data, prenotazioni: rb.data || [] }, error: null }
    }, 'caricare il cliente').then(({ data, errore }) => {
      if (!vivo) return
      if (errore) { setErroreCaricamento(errore); setLoading(false); return }
      setGuest(data?.cliente ?? null); setForm(data?.cliente ? { ...data.cliente, rating: valutazioneDi(data.cliente), ricevuta: vuoleRicevuta(data.cliente) } : {}); setBookings(data?.prenotazioni || []); setLoading(false)
    })
    return () => { vivo = false }
  }, [id, tentativo])

  function riprovaCaricamento() {
    setErroreCaricamento(null)
    setLoading(true)
    setTentativo(t => t + 1)
  }

  async function deleteGuest() {
    if (eliminando) return
    setEliminando(true)
    setErroreElimina(null)
    try {
      const errore = await scriviPoiAggiorna(
        () => supabase.from('guests').delete().eq('id', id),
        () => router.push('/clienti'),
      )
      setErroreElimina(errore)
    } finally {
      setEliminando(false)
    }
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setErroreSalva(null)
    try {
      const errore = await scriviPoiAggiorna(
        // Valutazione a tre voci + ricevuta a sé (0038); prima della 0038 la forma vecchia (payloadValutazione)
        () => supabase.from('guests').update({ full_name: form.full_name, phone: form.phone, email: form.email, notes: form.notes, ...payloadValutazione(valutazioneDi(form), !!form.ricevuta, colonnaRicevutaPresente(guest)), ...(clienteConProvenienza(guest) && strutture.disponibile ? campiProvenienza(form.provenienza, form.struttura_nome) : {}) }).eq('id', id),
        () => { setGuest({ ...guest, ...form, ...payloadValutazione(valutazioneDi(form), !!form.ricevuta, colonnaRicevutaPresente(guest)) }); setEditing(false) },
      )
      setErroreSalva(errore)
      // Nome di struttura nuovo → entra nell'elenco (non blocca il salvataggio)
      if (!errore && clienteConProvenienza(guest) && strutture.disponibile && form.provenienza === 'altra_struttura') {
        const errStruttura = await ricordaStruttura(form.struttura_nome, strutture.lista)
        if (errStruttura) setErroreSalva(`Salvato, ma il nome della struttura non è stato aggiunto all'elenco: ${errStruttura}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 text-center py-10 text-gray-400">Caricamento...</div>
  if (erroreCaricamento) return (
    <div className="p-4">
      <BackBar href="/clienti" />
      <AvvisoAzione testo={erroreCaricamento} onRiprova={riprovaCaricamento} />
    </div>
  )
  if (!guest) return <div className="p-4 text-center py-10 text-gray-400">Cliente non trovato</div>

  // Statistiche, numeri corretti (05/09/2026): «Soggiorni» conta i soggiorni
  // (group_id, un cambio camera = 1) delle sole prenotazioni confermate;
  // in_attesa esclusa; annullate contate a parte (lib/statistiche/cliente)
  const confermateCompletate = bookings.filter(prenotazioneValida)
  const storico = storicoCliente(bookings)

  // Storico arrivi (24/08/2026): solo dati realmente registrati, mai ricostruiti.
  // Un segmento preceduto da un altro con check-out uguale al suo check-in
  // (prolungamento o cambio camera) non è un vero arrivo del cliente.
  const d = new Date()
  const oggiStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const arrivoVero = (b: any) => !confermateCompletate.some(x => x.id !== b.id && x.check_out === b.check_in)
  const ultimiArrivi = confermateCompletate
    .filter(b => arrivoVero(b) && b.check_in_time && b.check_in <= oggiStr)
    .sort((a, b) => b.check_in.localeCompare(a.check_in))
    .slice(0, 4)

  return (
    <div className="p-4">
      <BackBar href="/clienti" />
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-serif text-xl text-green-dark flex-1">Cliente</h1>
        <button onClick={() => setEditing(!editing)} className="text-green-mid text-sm font-semibold">{editing ? 'Annulla' : 'Modifica'}</button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
        {editing ? (
          <>
            <input value={form.full_name || ''} onChange={e => setForm({...form, full_name: e.target.value})}
              placeholder="Nome e cognome" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" />
            <input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="Telefono" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" type="tel" />
            <input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="Email" className="w-full border border-card-border rounded-lg p-2 mb-2 text-sm" type="email" />
            <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Note..." className="w-full border border-card-border rounded-lg p-2 mb-3 text-sm" rows={2} />
            <div className="mb-3">
              <CampoValutazione titolo="Valutazione" valutazione={valutazioneDi(form)} ricevuta={!!form.ricevuta} onChange={v => setForm({ ...form, rating: v.valutazione, ricevuta: v.ricevuta })} />
            </div>
            <div className="mb-3">
              <CampoProvenienza compatto valore={{ provenienza: normalizzaProvenienza(form.provenienza), struttura: form.struttura_nome || '' }}
                onChange={x => setForm({ ...form, provenienza: x.provenienza, struttura_nome: x.struttura })}
                strutture={strutture.lista} disponibile={clienteConProvenienza(guest) && strutture.disponibile} avvisoNonDisponibile={strutture.avviso} />
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
            {erroreSalva && <AvvisoAzione testo={erroreSalva} className="mt-2" />}
          </>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-lg">{guest.full_name || 'Senza nome'}</p>
                {/* Fonte del cliente, soggiorni conclusi e ricavi totali (08/09/2026) */}
                {clienteConProvenienza(guest) && (() => { const c = soggiorniConclusi(bookings, oggiStr); return <p className="text-sm text-green-mid font-semibold" data-riga-cliente>{rigaCliente(guest, c.n, c.ricaviCent)}</p> })()}
                <p className="text-gray-500 text-sm">📞 {guest.phone}</p>
                {guest.email && <p className="text-gray-500 text-sm">✉️ {guest.email}</p>}
              </div>
              <span className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${COLORE_VALUTAZIONE[valutazioneDi(guest)]}`}>{ETICHETTA_VALUTAZIONE[valutazioneDi(guest)]}</span>
                {vuoleRicevuta(guest) && <span data-ricevuta className="text-xs px-2 py-1 rounded-full font-semibold bg-sage text-green-mid">{ETICHETTA_RICEVUTA}</span>}
              </span>
            </div>
            {guest.notes && <p className="text-sm text-gray-600 italic mt-2">📝 {guest.notes}</p>}
          </>
        )}
      </div>

      {/* Statistiche cliente */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm text-center">
          <p className="font-serif text-xl text-green-dark">{storico.soggiorni}</p>
          <p className="text-xs text-gray-500">Soggiorni</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm text-center">
          <p className="font-serif text-xl text-green-dark">€{Math.round(storico.totaleSpesoCent / 100)}</p>
          <p className="text-xs text-gray-500">Totale speso</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm text-center">
          <p className="font-serif text-xl text-[#8C3B2E]">{storico.annullate}</p>
          <p className="text-xs text-gray-500">Annullate</p>
        </div>
      </div>

      {/* Ultimi arrivi: solo orari realmente registrati, dal più recente */}
      {ultimiArrivi.length > 0 && (
        <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm mb-4">
          <p className="text-xs text-gray-500">Ultimi arrivi</p>
          <p className="text-sm font-bold text-green-dark mt-0.5">
            {ultimiArrivi.map(b => `${b.check_in_time}${b.shuttle === 'si' ? ' 🚌' : ''}`).join(' · ')}
          </p>
        </div>
      )}

      {/* Documenti d'identità (05/09/2026): stanno sul cliente; la prenotazione mostra solo «Documenti · N» */}
      <DocumentiCliente guestId={String(id)} />

      {/* Storico prenotazioni */}
      <p className="font-semibold mb-3">Storico prenotazioni</p>
      {bookings.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Nessuna prenotazione</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map(b => (
            <div key={b.id} className={`rounded-xl p-3 border ${b.status === 'annullata' ? 'bg-gray-50 border-card-border opacity-60' : b.extra_bed ? 'bg-[#F1E0CE] border-[#E7CDAE]' : 'bg-white border-card-border'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{b.rooms?.name}</p>
                  <p className="text-xs text-gray-500">{b.check_in} → {b.check_out}</p>
                  {/* Arrivo registrato: mai inventare — se manca l'orario lo si dice,
                      la navetta compare solo se davvero salvata (mai "no" per il vuoto) */}
                  {b.status !== 'annullata' && arrivoVero(b) && (
                    <p className="text-xs mt-0.5">
                      {b.check_in_time
                        ? <span className="text-green-dark">arrivo <span className="font-bold">{b.check_in_time}</span></span>
                        : <span className="text-gray-400">orario non registrato</span>}
                      {b.shuttle === 'si' && ' · 🚌'}
                      {b.shuttle === 'no' && <span className="text-gray-500"> · no navetta</span>}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">€{Number(b.total_amount).toFixed(0)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.status === 'annullata' ? 'bg-[#F6E4DE] text-[#8C3B2E]' : b.status === 'completata' ? 'bg-gray-100 text-gray-600' : 'bg-sage text-green-dark'}`}>{b.status}</span>
                </div>
              </div>
              {b.extra_bed && <p className="text-xs text-[#7A4B22] mt-1">🛏 Letto aggiuntivo</p>}
              {b.status === 'annullata' && b.cancelled_reason && <p className="text-xs text-gray-400 mt-1">Motivo: {b.cancelled_reason}</p>}
            </div>
          ))}
        </div>
      )}
      {/* Elimina cliente */}
      {!editing && (
        <button onClick={() => setShowDelete(true)} className="w-full mt-2 text-[#8C3B2E] text-sm py-2">
          🗑 Elimina cliente
        </button>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold mb-2">Elimina cliente</h2>
            <p className="text-sm text-gray-500 mb-4">Sei sicuro? Questa azione non si può annullare. Le prenotazioni associate rimarranno nel sistema.</p>
            <button onClick={deleteGuest} disabled={eliminando} className="w-full bg-[#B5502F] text-white rounded-xl py-3 font-semibold mb-2 disabled:opacity-60">{eliminando ? 'Elimino...' : 'Sì, elimina'}</button>
            {erroreElimina && <AvvisoAzione testo={erroreElimina} className="mb-2" />}
            <button onClick={() => setShowDelete(false)} className="w-full text-gray-500 py-2 text-sm">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
