'use client'
// ============================================================================
// LA SCHEDA CLIENTE «MAISON» (ritocchi del 29/09/2026, D3; riferimento
// approvato da Ania: docs/design/clienti-riferimento.html, schermata 2
// «pagina unica»).
//
// In cima «‹ Clienti»; la testata centrata: il nome in Cormorant 28 con le
// icone davanti, il numero per esteso coi cerchi da 32, l'email in
// maiuscoletto grigio, la riga «da Nida · 4 soggiorni · 640 € · ricevuta ·
// ottimo · paga in contanti» (solo i pezzi presenti), la nota del cliente in
// mattone sotto un filo tratteggiato e il motivo interno. Poi «Modifica dati»
// (il foglio «Dati della cliente», al posto della modifica in pagina, anche
// con ?edit=1) e «Nuova prenotazione» (col cliente già scelto); i tre numeri
// SOGGIORNI · TOTALE SPESO · ANNULLATE e gli ultimi arrivi; i documenti; i
// soggiorni (il tocco apre la scheda con ?da=cliente); in fondo «Elimina
// cliente» col pop-up di sempre nel foglio Maison. Letture, conti, errori e
// «Cliente non trovato» come prima. Dal Mac pagina a 620 px, scrittina
// «CLIENTE» a 64 px.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DocumentiCliente from '@/components/DocumentiCliente'
import AvvisoAzione from '@/components/AvvisoAzione'
import FoglioMaison from '@/components/maison/FoglioMaison'
import FoglioCliente from '@/components/scheda/FoglioCliente'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import { scriviPoiAggiorna } from '@/lib/scritturaSicura'
import { soggiorniConclusi } from '@/lib/clienteCheTorna'
import { righeStorico, testoCamere } from '@/lib/storicoCliente'
import { leggiConEsito } from '@/lib/prenotazioneScritture'
import { storicoCliente, prenotazioneValida } from '@/lib/statistiche'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { telefonoPerEsteso } from '@/lib/whatsapp'
import { smartBack } from '@/lib/navHistory'
import { hrefScheda } from '@/lib/provenienzaScheda'
import { rigaTestaCliente, rigaSoggiornoCliente, importoSoggiorno } from '@/lib/schedaCliente'
import type { ClienteSalvato } from '@/lib/datiCliente'

// il foglio «Elimina cliente»: la domanda, due righe e i comandi (riga fissa, B1)
const ALTEZZA_ELIMINA_CLIENTE = 230

export default function ClienteDetail() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [guest, setGuest] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // «Modifica dati» apre il foglio «Dati della cliente»; ?edit=1 lo apre da sé, come prima la modifica in pagina
  const [foglioDati, setFoglioDati] = useState(searchParams.get('edit') === '1')
  const [showDelete, setShowDelete] = useState(false)
  // Errori di salvataggio visibili, parte 2 (05/09/2026): ogni chiamata
  // controlla error; con un errore lo stato locale non cambia e compare
  // l'avviso vicino all'azione (niente «Cliente non trovato» per un errore di rete).
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [erroreElimina, setErroreElimina] = useState<string | null>(null)

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
      setGuest(data?.cliente ?? null); setBookings(data?.prenotazioni || []); setLoading(false)
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

  const indietro = () => smartBack(router, '/clienti')
  const barra = (
    <div className="sch-top" data-riga-navigazione>
      {/* dal Mac la scrittina «CLIENTE» a 64 px, come la scheda */}
      <span className="sch-scritta" data-scritta-mac>Cliente</span>
      <button type="button" className="np-back" onClick={indietro} data-indietro>‹ Clienti</button>
    </div>
  )
  const guscio = (dentro: ReactNode) => <div className="maison sch cli-pagina cli-scheda -mt-12 lg:mt-0 md:max-w-[620px] md:mx-auto" data-senza-sottolinea data-scheda-cliente>{barra}{dentro}</div>

  if (loading) return guscio(<p className="mz-caricamento">Caricamento…</p>)
  if (erroreCaricamento) return guscio(<section className="np-sec"><AvvisoAzione testo={erroreCaricamento} onRiprova={riprovaCaricamento} /></section>)
  if (!guest) return guscio(<section className="np-sec"><p className="mz-hint" data-cliente-non-trovato>Cliente non trovato</p></section>)

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrivoVero = (b: any) => !confermateCompletate.some(x => x.id !== b.id && x.check_out === b.check_in)
  const ultimiArrivi = confermateCompletate
    .filter(b => arrivoVero(b) && b.check_in_time && b.check_in <= oggiStr)
    .sort((a, b) => b.check_in.localeCompare(a.check_in))
    .slice(0, 4)

  const nome = (guest.full_name ?? '').trim() || 'Senza nome'
  const numero = telefonoPerEsteso(guest.phone)
  const stella = valutazioneDi(guest) === 'ottimo'
  const ricevuta = vuoleRicevuta(guest)
  const problema = valutazioneDi(guest) === 'problematico'
  const riga = rigaTestaCliente(guest, soggiorniConclusi(bookings, oggiStr))
  const soggiorni = righeStorico(bookings)
  const nota = (guest.notes ?? '').trim()
  const motivo = (guest.motivo_problematico ?? '').trim()

  return guscio(
    <>
      {/* ── LA TESTATA ── */}
      <header className="sch-head" data-testa-cliente>
        <div className="sch-nome">
          <h1 data-nome-cliente>
            {(ricevuta || stella) && <b>{ricevuta && <span data-ricevuta aria-label="vuole la ricevuta">🧾</span>}{ricevuta && stella && ' '}{stella && <span data-stella aria-label="cliente ottima">★</span>}</b>}
            {problema && <b className="pb" data-problematico aria-label="cliente problematica">!</b>}
            {(ricevuta || stella || problema) && ' '}{nome}
          </h1>
        </div>
        {numero && (
          <div className="sch-tel" data-telefono-cliente>
            <span className="num">{numero}</span>
            <IconeContatto telefono={guest.phone ?? null} nome={nome} dati="scheda-cliente" />
          </div>
        )}
        {guest.email && <p className="sch-k cli-email" data-email-cliente>{guest.email}</p>}
        {riga.length > 0 && (
          <p className="sch-k cli-riga-testa" data-riga-cliente>
            {riga.map((p, i) => (p.mat ? <span key={i} className="mat">{p.testo}</span> : <span key={i}>{p.testo}</span>))}
          </p>
        )}
        {(nota || motivo) && (
          <div className="sch-note" data-note-cliente>
            {nota && <div data-nota-cliente>{nota}</div>}
            {motivo && <div data-motivo-interno><strong>Motivo interno:</strong> {motivo}</div>}
          </div>
        )}
      </header>
      {avviso && <section className="np-sec"><AvvisoAzione testo={avviso} /></section>}

      {/* ── LE AZIONI ── */}
      <section className="np-sec cli-azioni" style={{ paddingTop: 18 }}>
        <button type="button" className="mz-lnk" data-modifica-dati onClick={() => setFoglioDati(true)}>Modifica dati</button>
        <Link href={`/nuova-prenotazione?guest_id=${guest.id}`} className="mz-lnk" data-nuova-prenotazione>Nuova prenotazione</Link>
      </section>

      {/* ── I NUMERI E GLI ULTIMI ARRIVI ── */}
      <section className="np-sec cli-numeri" style={{ paddingTop: 16 }} data-numeri-cliente>
        <div className="g3">
          <div><p className="sch-k">Soggiorni</p><p className="sch-big">{storico.soggiorni}</p></div>
          <div><p className="sch-k">Totale speso</p><p className="sch-big">{Math.round(storico.totaleSpesoCent / 100).toLocaleString('it-IT')} €</p></div>
          <div><p className="sch-k">Annullate</p><p className="sch-big mat">{storico.annullate}</p></div>
        </div>
        {/* Ultimi arrivi: solo orari realmente registrati, dal più recente */}
        {ultimiArrivi.length > 0 && (
          <>
            <p className="sch-k" style={{ marginTop: 12 }}>Ultimi arrivi</p>
            <p className="cli-arrivi" data-ultimi-arrivi>{ultimiArrivi.map(b => `${b.check_in_time}${b.shuttle === 'si' ? ' 🚌' : ''}`).join(' · ')}</p>
          </>
        )}
      </section>

      {/* Documenti d'identità (05/09/2026): stanno sul cliente */}
      <DocumentiCliente guestId={String(id)} />

      {/* ── I SOGGIORNI: una riga per soggiorno, anche i futuri; il tocco apre la scheda ── */}
      <section className="np-sec" style={{ paddingTop: 22 }} data-soggiorni-cliente>
        <p className="mz-eyebrow">Soggiorni · {soggiorni.length}</p>
        {soggiorni.length === 0 ? (
          <p className="mz-hint">Nessuna prenotazione</p>
        ) : soggiorni.map(r => (
          <Link key={r.chiave} href={hrefScheda(r.prenotazioneId, 'cliente', { cliente: String(id) })} data-riga-storico={r.chiave}
            className={`cli-sogg ${r.status === 'annullata' ? 'annullata' : ''}`}>
            <span className="min-w-0">
              <span className="sch-big nm">{testoCamere(r)}</span>
              <span className="de">{rigaSoggiornoCliente(r, r.segmenti[0], arrivoVero(r.segmenti[0]))}</span>
              {r.status === 'annullata' && r.cancelled_reason && <span className="de">Motivo: {r.cancelled_reason}</span>}
            </span>
            <span className="dx">
              <span className="sch-big eur">{importoSoggiorno(r)}</span>
              <span className={`sch-k ${r.status === 'annullata' ? 'mat' : ''}`}>{r.status}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* ── IN FONDO: ELIMINA CLIENTE ── */}
      <p className="cli-elimina">
        <button type="button" className="mz-lnk mat" data-elimina-cliente onClick={() => setShowDelete(true)}>Elimina cliente</button>
      </p>

      {showDelete && (
        <FoglioMaison titolo="Elimina cliente" altezza={ALTEZZA_ELIMINA_CLIENTE} larghezzaDesktop={440} dati="elimina-cliente" onChiudi={() => { if (!eliminando) setShowDelete(false) }}
          piede={
            <div className="mz-foot" data-piede-foglio>
              <span />
              <span className="acts">
                <button type="button" className="mz-lnk q" data-annulla-foglio onClick={() => setShowDelete(false)} disabled={eliminando}>Annulla</button>
                <button type="button" className="mz-cta mat" data-azione-foglio="elimina-cliente" onClick={deleteGuest} disabled={eliminando}>{eliminando ? 'Elimino...' : 'Sì, elimina'}</button>
              </span>
            </div>
          }>
          <p className="mz-hint">Sei sicuro? Questa azione non si può annullare. Le prenotazioni associate rimarranno nel sistema.</p>
          {erroreElimina && <AvvisoAzione testo={erroreElimina} className="mt-2" />}
        </FoglioMaison>
      )}

      {foglioDati && (
        <FoglioCliente cliente={{ ...(guest as ClienteSalvato), id: String(guest.id) }}
          onChiudi={() => setFoglioDati(false)}
          onSalvato={(campi, msg) => { setGuest({ ...guest, ...campi }); setFoglioDati(false); setAvviso(msg) }} />
      )}
    </>
  )
}
