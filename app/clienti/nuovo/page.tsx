'use client'
// ============================================================================
// NUOVO CLIENTE «MAISON» (ritocchi del 29/09/2026, D4): la stessa pagina del
// modulo della «Nuova richiesta» — la barra «‹ Clienti», il titolo in
// Cormorant, i campi a filo Nome e Cognome (il componente condiviso, regola
// fissa n. 1), Telefono (segnaposto «+39 333 1234567», prefisso 39 come
// prima), «Email · può restare vuota», le chip della ricevuta e della
// valutazione, il tasto pieno «Salva cliente». Stesso salvataggio e stesso
// errore di prima; dopo il salvataggio si apre la scheda del cliente.
// ============================================================================
import { nomeDaSalvareONull } from '@/lib/guestName'
import CampiNomeCognome from '@/components/CampiNomeCognome'
import { Suspense, useState } from 'react'
import { moduloDaRicerca, telefonoDaSalvare } from '@/lib/datiCliente'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { smartBack } from '@/lib/navHistory'
import { payloadValutazione, type Valutazione } from '@/lib/valutazione'
import { chiaveTelefono } from '@/lib/clienteTelefono'
import { cercaSchedaPerTelefono } from '@/lib/clienteTelefonoDati'
import SchedeStessoNumero, { type SchedaStessoNumero } from '@/components/SchedeStessoNumero'

const SEGNI: { chiave: Valutazione; segno: string; mattone?: boolean }[] = [
  { chiave: 'ottimo', segno: '★' },
  { chiave: 'normale', segno: 'Normale' },
  { chiave: 'problematico', segno: '!', mattone: true },
]

export default function NuovoCliente() {
  return <Suspense fallback={<p className="mz-caricamento">Caricamento…</p>}><ModuloNuovoCliente /></Suspense>
}

function ModuloNuovoCliente() {
  const router = useRouter()
  const ricerca = useSearchParams().get('ricerca') ?? ''
  const [form, setForm] = useState(() => {
    const dati = moduloDaRicerca(ricerca)
    return { nome: dati.nome, cognome: dati.cognome, phone: dati.telefono, email: '', rating: 'normale' as Valutazione, ricevuta: false }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schedeDoppie, setSchedeDoppie] = useState<SchedaStessoNumero[]>([])

  async function save() {
    const full_name = nomeDaSalvareONull({ nome: form.nome, cognome: form.cognome })
    if (!full_name && !form.phone.trim()) {
      setError('Inserisci almeno nome o numero di telefono.')
      return
    }
    // Il numero si salva con «+» e il prefisso del paese (+393331234567,
    // +4532123456): mai più «39» incollato davanti a un +44 o a uno 0039, e
    // alla rilettura il paese resta quello scritto (21/10/2026, R1)
    const formattedPhone = form.phone.trim() && chiaveTelefono(form.phone) ? telefonoDaSalvare(form.phone) : null
    if (form.phone.trim() && !formattedPhone) { setError('Controlla il numero: con il prefisso (+39, +44…) o un numero italiano completo.'); return }
    setSaving(true)
    setError(null)
    setSchedeDoppie([])
    // Lo stesso numero già in archivio, anche scritto in un'altra forma: niente doppione
    if (formattedPhone) {
      const gia = await cercaSchedaPerTelefono<SchedaStessoNumero>(formattedPhone)
      if (gia.errore) { setSaving(false); setError(`Non sono riuscito a controllare se il numero è già in archivio: ${gia.errore}`); return }
      if (gia.schede.length) { setSaving(false); setSchedeDoppie(gia.schede); return }
    }
    const base = { full_name, phone: formattedPhone, email: form.email.trim() || null }
    // Colonna nuova (0038) se c'è; altrimenti la forma vecchia, così nulla si blocca
    let { data, error: err } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(form.rating, form.ricevuta, true) }).select().single()
    if (err && /vuole_ricevuta/i.test(err.message || '')) ({ data, error: err } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(form.rating, form.ricevuta, false) }).select().single())
    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/clienti/${data.id}`)
  }

  return (
    <div className="maison cal ric-pag cli-nuovo -mt-12 lg:mt-0" data-nuovo-cliente-maison>
      <div className="sch-top ric-top" data-riga-navigazione>
        <button type="button" className="np-back" onClick={() => smartBack(router, '/clienti')}>‹ Clienti</button>
        <p className="sch-scritta">Nuovo cliente</p>
      </div>
      <header className="ric-testa"><div className="hd3"><h1 className="ti">Nuovo cliente</h1></div></header>

      <div className="ric-modulo" data-modulo-cliente>
        <section className="sec">
          {/* Nome e cognome: SOLO il componente condiviso (regola fissa n. 1, maiuscola mentre si scrive) */}
          <CampiNomeCognome nome={form.nome} cognome={form.cognome} onNome={nome => setForm(f => ({ ...f, nome }))} onCognome={cognome => setForm(f => ({ ...f, cognome }))}
            classeFila="ric-campi-nome" classeCampo="ric-fld"
            avvolgi={(etichetta, campo) => <label key={etichetta} className="ric-campo"><span className="fl2">{etichetta}</span>{campo}</label>} />
          <label className="ric-campo">
            <span className="fl2">Telefono</span>
            <input type="tel" inputMode="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+39 333 1234567" className="ric-fld" data-campo="telefono" />
          </label>
          <label className="ric-campo">
            <span className="fl2">Email · può restare vuota</span>
            <input type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="ric-fld" data-campo="email" />
          </label>
          <div className="cli-due">
            <div><p className="cli-fl2x">Ricevuta</p>
              <span className="cli-chips">
                <button type="button" data-pastiglia="ricevuta-no" aria-pressed={!form.ricevuta} className={!form.ricevuta ? 'on' : ''} onClick={() => setForm(f => ({ ...f, ricevuta: false }))}>No</button>
                <button type="button" data-pastiglia="ricevuta-si" aria-pressed={form.ricevuta} className={form.ricevuta ? 'on' : ''} onClick={() => setForm(f => ({ ...f, ricevuta: true }))}>Sì 🧾</button>
              </span>
            </div>
            <div><p className="cli-fl2x">Valutazione</p>
              <span className="cli-chips">
                {SEGNI.map(v => (
                  <button key={v.chiave} type="button" data-pastiglia={`valutazione-${v.chiave}`} aria-pressed={form.rating === v.chiave}
                    className={`${form.rating === v.chiave ? 'on' : ''} ${v.mattone ? 'mat' : ''}`} onClick={() => setForm(f => ({ ...f, rating: v.chiave }))}>{v.segno}</button>
                ))}
              </span>
            </div>
          </div>
        </section>

        <div className="sec">
          {error && <p role="alert" className="mz-hint" style={{ color: '#8C3B2E' }} data-errore-cliente>{error}</p>}
          <SchedeStessoNumero schede={schedeDoppie} azione="apri la scheda" className="mb-3" onScegli={c => router.push(`/clienti/${c.id}`)} />
          <button type="button" onClick={save} disabled={saving} className="ric-cta" data-salva-cliente>{saving ? 'Salvataggio...' : 'Salva cliente'}</button>
        </div>
      </div>
    </div>
  )
}
