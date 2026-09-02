// Apertura di WhatsApp con numero e testo già scritti: UNICO meccanismo per la
// scheda prenotazione e per la proposta alle richieste (prima viveva solo
// dentro app/prenotazioni/[id]/page.tsx).
//
// Prova ad aprire l'app (desktop o mobile) tramite lo schema whatsapp://, e
// ricade su wa.me (WhatsApp Web) se l'app non risponde entro 1 secondo.

// "333 123 4567" / "+39 333…" → "393331234567"; vuoto se non ci sono cifre.
export function normalizzaTelefono(raw: string | null | undefined): string {
  const cifre = (raw || '').replace(/\D/g, '')
  if (!cifre) return ''
  return cifre.startsWith('39') ? cifre : `39${cifre}`
}

export function openWhatsApp(phone: string, text: string, preferBusiness: boolean = false) {
  const encoded = encodeURIComponent(text)
  // whatsapp:// e whatsapp-consumer:// non sono schemi documentati ufficialmente da Meta:
  // quando sul telefono sono installate sia WhatsApp che WhatsApp Business, è iOS a decidere
  // da solo quale app apre ciascuno scheme, e la scelta può cambiare da sola con gli aggiornamenti.
  // Proviamo prima lo scheme "preferito", poi l'altro, poi il link web come ultima spiaggia.
  // Sul telefono di Ania questi due schemi risultano assegnati al contrario
  // di quanto documentato altrove: whatsapp:// apre la sua app personale,
  // whatsapp-consumer:// apre WhatsApp Business.
  const schemeA = preferBusiness
    ? `whatsapp-consumer://send?phone=${phone}&text=${encoded}`
    : `whatsapp://send?phone=${phone}&text=${encoded}`
  const schemeB = preferBusiness
    ? `whatsapp://send?phone=${phone}&text=${encoded}`
    : `whatsapp-consumer://send?phone=${phone}&text=${encoded}`
  const webUrl = `https://wa.me/${phone}?text=${encoded}`

  let handedOff = false
  const markHandedOff = () => { handedOff = true }
  document.addEventListener('visibilitychange', markHandedOff)
  window.addEventListener('blur', markHandedOff)

  window.location.href = schemeA

  setTimeout(() => {
    if (handedOff) {
      document.removeEventListener('visibilitychange', markHandedOff)
      window.removeEventListener('blur', markHandedOff)
      return
    }
    window.location.href = schemeB
    setTimeout(() => {
      document.removeEventListener('visibilitychange', markHandedOff)
      window.removeEventListener('blur', markHandedOff)
      if (!handedOff) {
        window.open(webUrl, '_blank', 'noopener,noreferrer')
      }
    }, 800)
  }, 800)
}
