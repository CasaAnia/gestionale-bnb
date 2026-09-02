// Apertura di WhatsApp con numero e testo già scritti: UNICO meccanismo per la
// scheda prenotazione e per la proposta alle richieste (prima viveva solo
// dentro app/prenotazioni/[id]/page.tsx).
//
// Prova ad aprire l'app (desktop o mobile) tramite lo schema whatsapp://, e
// ricade su wa.me (WhatsApp Web) se l'app non risponde entro 1 secondo.

export type TelefonoNormalizzato = { numero: string; avviso: string | null }

// Normalizzazione dei numeri (richieste e proposta):
//  · via spazi, punti, trattini e parentesi;
//  · "+44…" o "0044…" → si tiene il prefisso internazionale indicato (44…);
//  · "3…" di 9 o 10 cifre senza prefisso → cellulare italiano, si aggiunge 39;
//  · tutto il resto resta com'è, con l'avviso «Controlla il prefisso».
// `numero` è nel formato che vuole WhatsApp (solo cifre, prefisso compreso).
export function normalizzaTelefono(raw: string | null | undefined): TelefonoNormalizzato {
  const pulito = (raw || '').replace(/[\s.\-()]/g, '')
  if (!pulito) return { numero: '', avviso: null }
  if (pulito.startsWith('+')) {
    const cifre = pulito.slice(1).replace(/\D/g, '')
    return { numero: cifre, avviso: cifre.length >= 8 ? null : 'Controlla il prefisso' }
  }
  if (pulito.startsWith('00')) {
    const cifre = pulito.slice(2).replace(/\D/g, '')
    return { numero: cifre, avviso: cifre.length >= 8 ? null : 'Controlla il prefisso' }
  }
  const cifre = pulito.replace(/\D/g, '')
  if (cifre.startsWith('3') && (cifre.length === 9 || cifre.length === 10)) return { numero: `39${cifre}`, avviso: null }
  return { numero: cifre, avviso: 'Controlla il prefisso' }
}

// "+393331234567": come si salva e si mostra
export function telefonoLeggibile(t: TelefonoNormalizzato): string {
  return t.numero ? `+${t.numero}` : ''
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
