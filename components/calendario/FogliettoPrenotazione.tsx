'use client'
// ============================================================================
// IL FOGLIETTO DI DETTAGLIO DEL CALENDARIO (riferimento approvato da Ania il
// 29/09/2026, telefono «Foglietto al tocco»).
//
// Si apre toccando una scheda: sale dal basso ad ALTEZZA FISSA (la stessa
// per ogni prenotazione: le righe che mancano restano vuote), col velo sopra
// il calendario. Dentro: la riga maiuscoletta con camera, date, notti e
// stato; il nome con 🧾 ⭐ davanti e i due cerchi (cornetta e WhatsApp);
// «dorme …» solo se in camera dorme un'altra persona; poi le righe
// CAMERE · OSPITI · PREZZO · PAGAMENTO · ARRIVO · NOTE · CLIENTE; in fondo
// «Apri la scheda» e «Chiudi». Niente documenti.
//
// Ritocchi del 29/09/2026 (A4): sotto il nome il numero per esteso in
// Cormorant 16 coi cerchi a destra sulla stessa riga; in fondo, 28 px sotto
// l'ultima riga, «Apri la scheda» pieno e «Chiudi» a filo, affiancati a metà
// larghezza (components/calendario/PezziFoglietto).
//
// I dati: quelli che il calendario ha già (prenotazioni, clienti, pagamenti)
// più UNA lettura al tocco, la stessa della scheda prenotazione
// (leggiPrenotazioneUnica: tutte le camere della prenotazione, anche quelle
// annullate, che contano nel conto). Finché non arriva, i valori sono «…».
// I testi li compone lib/calendarioFoglietto con le funzioni della scheda.
// ============================================================================
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { supabase } from '@/lib/supabase'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { TelefonoFoglietto, TastiFoglietto } from './PezziFoglietto'
import { leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, chiavePrenotazione, type RigaPrenotazione } from '@/lib/prenotazioneUnica'
import { segmentiAttivi, type SegmentoScheda } from '@/lib/schedaPrenotazione'
import { statoPrenotazione, rigaPerMessaggi } from '@/lib/messaggiFase'
import { mancatoArrivo } from '@/lib/mancatoArrivo'
import { arriviDeiPeriodi } from '@/lib/arriviPeriodi'
import { leggiArrivo } from '@/lib/arrivo'
import { elencoSoggiorniPersona, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { provenienzaInParole } from '@/lib/provenienza'
import { vuoleRicevuta } from '@/lib/valutazione'
import { nomeConAltri } from '@/lib/guestName'
import { oggiARoma } from '@/lib/spese/adattatore'
import { spesoPrimaCent } from '@/lib/spesoCliente'
import {
  ALTEZZA_FOGLIETTO, LARGHEZZA_FOGLIETTO_MAC, APRI_LA_SCHEDA, CHIUDI,
  testaFoglietto, statoFoglietto, iconeFoglietto, dormeFoglietto, righeFoglietto, righeInArrivo, arrivoDaMostrare, cameraCorta,
  type RigaFoglietto,
} from '@/lib/calendarioFoglietto'

type Riga = SegmentoScheda & RigaPrenotazione & {
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null; notes?: string | null; provenienza?: string | null; struttura_nome?: string | null } | null
  [colonna: string]: unknown
}

export default function FogliettoPrenotazione({ prenotazione, tutte, camere, pagamenti, onApri, onChiudi, onVelo }: {
  /** la scheda toccata (la riga del calendario) */
  prenotazione: Riga
  /** tutte le prenotazioni che il calendario ha letto: servono per i soggiorni precedenti del cliente */
  tutte: Riga[]
  camere: { id: string; name: string }[]
  pagamenti: { booking_id: string; amount: number | string }[]
  onApri: () => void
  onChiudi: () => void
  /** il tocco sul velo: la pagina guarda se sotto c'è la stessa scheda (secondo tocco = scheda) */
  onVelo: (e: MouseEvent<HTMLDivElement>) => void
}) {
  const oggi = oggiARoma()
  const [righe, setRighe] = useState<Riga[] | null>(null)
  const [errore, setErrore] = useState(false)

  // UNA lettura al tocco: tutte le camere della prenotazione, come la scheda
  useEffect(() => {
    let vivo = true
    leggiPrenotazioneUnica(prenotazione, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
      .then(r => {
        if (!vivo) return
        // le righe arrivano con la camera ma senza il cliente: è lo stesso per tutte.
        // Se la lettura non riesce restano quelle del calendario, e il conto non si fa
        // (come la scheda: niente conto su una prenotazione letta a metà)
        const chiave = chiavePrenotazione(prenotazione)
        const base = r.errore
          ? tutte.filter(b => chiavePrenotazione(b) === chiave).map(b => ({ ...b, rooms: camere.find(c => c.id === b.room_id) ?? null }) as Riga)
          : (r.righe as Riga[])
        setErrore(!!r.errore)
        setRighe(base.map(x => ({ ...x, guests: x.guests ?? prenotazione.guests, guest_name: x.guest_name ?? prenotazione.guest_name })))
      })
    return () => { vivo = false }
  }, [prenotazione]) // eslint-disable-line react-hooks/exhaustive-deps

  const guest = prenotazione.guests ?? null
  const cameraToccata = cameraCorta(camere.find(c => c.id === prenotazione.room_id)?.name)
  // Finché la lettura non arriva: le righe del calendario della stessa prenotazione (per la testa)
  const perTesta = useMemo(() => {
    if (righe) return righe
    const chiave = chiavePrenotazione(prenotazione)
    return tutte.filter(b => chiavePrenotazione(b) === chiave)
  }, [righe, tutte, prenotazione])
  const attive = segmentiAttivi(perTesta) as Riga[]
  const primoArrivo = attive[0]?.check_in ?? prenotazione.check_in
  const ultimaPartenza = attive.reduce((m, s) => (s.check_out > m ? s.check_out : m), prenotazione.check_out)

  const contenuto = useMemo((): { stato: string; righe: RigaFoglietto[] } => {
    if (!righe) return { stato: '', righe: righeInArrivo() }
    let conto: { totaleCent: number; ricevutiCent: number } | null = null
    if (!errore) { try { conto = contoPrenotazione(righe, pagamenti) } catch { conto = null } }
    const vive = segmentiAttivi(righe) as Riga[]
    const arrivo = arrivoDaMostrare(arriviDeiPeriodi(vive), oggi)
    // i soggiorni conclusi della stessa persona, fuori da questa prenotazione (come la scheda)
    const chiave = chiavePrenotazione(prenotazione)
    const altre = prenotazione.guest_id
      ? tutte.filter(b => b.guest_id === prenotazione.guest_id && chiavePrenotazione(b) !== chiave).map(b => ({ ...b, rooms: camere.find(c => c.id === b.room_id) ?? null }))
      : []
    const persona = { guest_id: prenotazione.guest_id ?? null, telefono: guest?.phone ?? null, full_name: prenotazione.guest_name || guest?.full_name || null }
    const soggiorni = elencoSoggiorniPersona(persona, altre as unknown as SoggiornoStorico[], oggi, chiave)
    // lo speso prima: la stessa funzione della cifra sulle schede del Calendario (lib/spesoCliente)
    return {
      stato: statoFoglietto(statoPrenotazione(righe, prenotazione), ultimaPartenza, oggi, righe.some(mancatoArrivo)),
      righe: righeFoglietto({
        segmenti: righe,
        oggi,
        conto,
        pagato: righe.some(r => r.pagato),
        accordo: accordoPrenotazione(righe),
        arrivo: arrivo ? { dati: leggiArrivo(arrivo as unknown as Record<string, unknown>), checkIn: arrivo.check_in } : null,
        notaCliente: guest?.notes,
        notaPrenotazione: prenotazione.notes,
        volte: soggiorni.length,
        provenienza: provenienzaInParole(guest ?? (prenotazione as { provenienza?: string | null; struttura_nome?: string | null })),
        ricevuta: vuoleRicevuta(guest),
        spesoPrimaCent: spesoPrimaCent(prenotazione, tutte, camere, oggi),
      }),
    }
  }, [righe, errore, pagamenti, tutte, camere, prenotazione, guest, oggi, ultimaPartenza])

  const nome = nomeConAltri(prenotazione)
  const icone = iconeFoglietto(vuoleRicevuta(guest), guest?.rating === 'ottimo')
  const dorme = dormeFoglietto((rigaPerMessaggi(perTesta, prenotazione) ?? prenotazione) as unknown as Record<string, unknown>)

  const testa = (
    <div className="cal-fog-testa">
      <div className="k" data-foglietto-testa>
        {testaFoglietto(cameraToccata, primoArrivo, ultimaPartenza)}
        {contenuto.stato && <span className="st"> · {contenuto.stato}</span>}
      </div>
      <div className="hd2">
        <div className="ti" data-foglietto-nome>{icone && <span className="ic">{icone} </span>}{nome}</div>
      </div>
      <TelefonoFoglietto telefono={guest?.phone} nome={nome} dati="foglietto" />
      {dorme && <div className="dorme" data-riga-dorme>{dorme}</div>}
    </div>
  )

  return (
    <FoglioMaison titolo={nome} testa={testa} altezza={ALTEZZA_FOGLIETTO} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC}
      piede={<TastiFoglietto azione={APRI_LA_SCHEDA} onAzione={onApri} datiAzione={{ 'data-apri-scheda': '' }} onChiudi={onChiudi} testoChiudi={CHIUDI} />}
      veloChiaro onVelo={onVelo} onChiudi={onChiudi} dati="foglietto-calendario">
      <div className="cal-fog" data-foglietto={prenotazione.id} data-caricato={righe ? '1' : undefined}>
        {contenuto.righe.map(r => (
          <div key={r.etichetta} className="dr" data-riga-foglietto={r.etichetta}>
            <span className="dk">{r.etichetta}</span>
            <span className="dv">
              {r.valore.map((p, i) => p.tipo === 'barrato' ? <s key={i}>{p.testo}</s>
                : <span key={i} className={p.tipo === 'mat' ? 'mat' : p.tipo === 'verde' ? 'verde' : undefined}>{p.testo}</span>)}
            </span>
          </div>
        ))}
      </div>
    </FoglioMaison>
  )
}
