'use client'
// ============================================================================
// CLIENTI «MAISON» (ritocchi del 29/09/2026, D2; riferimento approvato da
// Ania: docs/design/clienti-riferimento.html, schermata 1).
//
// Dal telefono: la barra in alto «CLIENTI» (MobileTopBar), il campo «Cerca
// nome o telefono…» a filo, la riga maiuscoletta ottone «CLIENTI · N» con a
// destra «+ NUOVO CLIENTE» sottolineato (con ?ricerca=… come prima), poi le
// righe separate da un filo: icone e nome in Cormorant 19, il numero per
// esteso in Cormorant 16 coi cerchi da 26, «da Nida · 4 soggiorni · 640 €»
// (lib/clientiElenco). Il tocco apre la scheda del cliente. Ordine (dal più
// recente), ricerca e stati come prima.
// Dal Mac: la scrittina «CLIENTI» a 64 px con la ricerca e «+ Nuovo cliente»
// a destra, l'elenco largo 620 px.
// ============================================================================
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TestaMac from '@/components/TestaMac'
import CampoRicerca from '@/components/CampoRicerca'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import { telefonoPerEsteso } from '@/lib/whatsapp'
import { raccogliPagine } from '@/lib/statistiche/paginazione'
import { oggiARoma } from '@/lib/spese/adattatore'
import { filtraElenco, iconeCliente, rigaElenco, conclusiPerCliente, SENZA_NOME, type ClienteElenco } from '@/lib/clientiElenco'
import type { SoggiornoStorico } from '@/lib/clienteCheTorna'

export default function Clienti() {
  const router = useRouter()
  const [guests, setGuests] = useState<ClienteElenco[]>([])
  const [prenotazioni, setPrenotazioni] = useState<SoggiornoStorico[] | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('guests').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setGuests((data || []) as ClienteElenco[]); setLoading(false) })
    // i soggiorni conclusi e lo speso di ogni cliente: una lettura sola (se non riesce, «prima volta» resta vuoto)
    void raccogliPagine<SoggiornoStorico>((offset, limite) => supabase.from('bookings')
      .select('id, guest_id, check_in, check_out, status, prenotazione_id, group_id, total_amount')
      .neq('status', 'annullata').order('check_in').range(offset, offset + limite - 1))
      .then(r => { if (!r.error) setPrenotazioni(r.data) })
  }, [])

  const filtered = filtraElenco(guests, search)
  const conclusi = useMemo(() => conclusiPerCliente(prenotazioni ?? [], oggiARoma()), [prenotazioni])

  const hrefNuovo = search.trim() ? `/clienti/nuovo?ricerca=${encodeURIComponent(search.trim())}` : '/clienti/nuovo'
  const nuovo = (testo: string) => <Link href={hrefNuovo} className="mz-lnk" data-nuovo-cliente>{testo}</Link>

  return (
    <div className="maison cal cli-pagina" data-clienti-maison>
      {/* Dal Mac la testa condivisa: la scrittina, la ricerca e «+ Nuovo cliente» a destra */}
      <TestaMac titolo="Clienti" contenitore={16}
        comandi={<><CampoRicerca maison value={search} onChange={setSearch} className="w-[300px]" />{nuovo('+ Nuovo cliente')}</>} />
      <div className="cli-elenco">
        <div className="lg:hidden" style={{ margin: '16px 16px 0' }}>
          <CampoRicerca maison value={search} onChange={setSearch} />
        </div>
        <div className="cli-rk2">
          <span data-conteggio-clienti>Clienti · {filtered.length}</span>
          <span className="lg:hidden">{nuovo('+ Nuovo cliente')}</span>
        </div>

        {loading ? (
          <p className="mz-caricamento">Caricamento…</p>
        ) : filtered.length === 0 ? (
          <p className="cli-vuoto">Nessun cliente trovato</p>
        ) : (
          <div data-righe-clienti>
            {filtered.map(g => {
              const ic = iconeCliente(g)
              const nome = (g.full_name ?? '').trim() || SENZA_NOME
              const numero = telefonoPerEsteso(g.phone)
              const fermo = (e: MouseEvent) => e.stopPropagation()
              return (
                <div key={g.id} role="link" tabIndex={0} className="cli-riga" data-riga-cliente={g.id}
                  onClick={() => router.push(`/clienti/${g.id}`)}
                  onKeyDown={e => { if (e.key === 'Enter') router.push(`/clienti/${g.id}`) }}>
                  <div className="cn2">
                    {ic.ricevuta && <span data-ricevuta aria-label="vuole la ricevuta">🧾 </span>}
                    {ic.stella && <span data-stella className="st" aria-label="cliente ottima">★ </span>}
                    {ic.problema && <span data-problematico className="pb" aria-label="cliente problematica">! </span>}
                    {nome}
                  </div>
                  {numero && (
                    <div className="tel2" onClick={fermo}>
                      <span className="num">{numero}</span>
                      <IconeContatto telefono={g.phone ?? null} nome={nome} dati="elenco-clienti" />
                    </div>
                  )}
                  <div className="cd" data-riga-sotto>
                    {/* finché i soggiorni non sono letti niente numeri (mai un «prima volta» sbagliato) */}
                    {prenotazioni ? rigaElenco(g, conclusi.get(g.id) ?? { n: 0, ricaviCent: 0 }).map((p, i) => p.mat ? <b key={i} className="mat">{p.testo}</b> : <span key={i}>{p.testo}</span>) : '…'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
