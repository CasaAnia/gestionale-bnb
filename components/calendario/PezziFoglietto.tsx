'use client'
// ============================================================================
// I PEZZI COMUNI DEI FOGLIETTI (ritocchi «Maison» del 29/09/2026, punto A4),
// quello della prenotazione (Calendario) e quello della richiesta (Richieste):
//   · TelefonoFoglietto — sotto il nome, il numero per esteso in Cormorant
//     16 px («+39 342 700 4354») e a destra, sulla stessa riga, i cerchi
//     cornetta e WhatsApp (non più accanto al nome)
//   · TastiFoglietto    — in fondo, 28 px sotto l'ultima riga, due tasti
//     affiancati metà larghezza ciascuno (12 px fra i due), alti 44 px e
//     centrati: l'azione piena d'inchiostro col testo avorio e «Chiudi» a
//     filo (contorno sottile, fondo trasparente: Ania, 29/09/2026)
// ============================================================================
import type { ReactNode } from 'react'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import { telefonoPerEsteso } from '@/lib/whatsapp'

export function TelefonoFoglietto({ telefono, nome, dati }: { telefono: string | null | undefined; nome: string; dati?: string }) {
  const numero = telefonoPerEsteso(telefono)
  if (!numero) return null
  return (
    <div className="tel" data-telefono-foglietto={dati}>
      <span className="num">{numero}</span>
      <IconeContatto telefono={telefono ?? null} nome={nome} dati={dati} />
    </div>
  )
}

export function TastiFoglietto({ azione, onAzione, datiAzione, onChiudi, testoChiudi = 'Chiudi', sopra }: {
  /** l'azione piena («Apri la scheda», «Invia proposta», «Conferma»); senza, solo «Chiudi» */
  azione?: string
  onAzione?: () => void
  /** l'attributo data- dell'azione (le prove la cercano per nome) */
  datiAzione?: Record<string, string>
  /** senza: niente «Chiudi» (i blocchi delle richieste sovrapposte) */
  onChiudi?: () => void
  testoChiudi?: string
  /** i comandi sottolineati sopra i tasti («Modifica · Rifiuta») */
  sopra?: ReactNode
}) {
  return (
    <div className="fog-tasti-blocco">
      {sopra && <div className="fog-sopra">{sopra}</div>}
      <div className="fog-tasti" data-senza-sottolinea data-tasti-foglietto>
        {/* regola dei fogli (01/10/2026): «Chiudi» a contorno a sinistra, l'azione piena a destra */}
        {onChiudi && <button type="button" className="filo" data-chiudi-foglietto onClick={onChiudi}>{testoChiudi}</button>}
        {azione && onAzione && <button type="button" className="pieno" onClick={onAzione} {...datiAzione}>{azione}</button>}
      </div>
    </div>
  )
}
