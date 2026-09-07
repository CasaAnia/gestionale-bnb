// Iniziali maiuscole nei dati del cliente (richiesta di Ania, 06/09/2026):
// nome, cognome, nome sulla prenotazione, nomi dei contatti aggiuntivi
// partono sempre con la maiuscola al salvataggio, anche se scritti in
// minuscolo dal telefono. Regola semplice: la prima lettera di ogni parola
// (anche dopo trattino e apostrofo) diventa maiuscola; il resto resta come
// scritto («D'Iorio», «Rosa-Maria», «McDonald» non si toccano). Spazi in
// più tolti. Vuoto o null restano tali.
export function conIniziali(testo: string | null | undefined): string {
  const t = (testo ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.replace(/(^|[\s\-'’])(\p{L})/gu, (_, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it'))
}

// Come conIniziali, ma un valore vuoto torna null (colonne facoltative)
export function conInizialiONull(testo: string | null | undefined): string | null {
  return conIniziali(testo) || null
}

// ── Nel campo, mentre si scrive (07/09/2026) ────────────────────────────────
// Prima la maiuscola arrivava SOLO al salvataggio: nel campo dipendeva dalla
// tastiera dell'iPhone (autocapitalize="words"), che c'era nei moduli con nome
// e cognome separati e mancava nei campi «Nome e cognome». Qui la stessa
// regola di conIniziali ma senza togliere spazi: altrimenti, scrivendo, lo
// spazio prima della seconda parola sparirebbe. Al salvataggio passa comunque
// conIniziali, così campo e valore salvato coincidono.
export function conInizialiDigitando(testo: string): string {
  return testo.replace(/(^|[\s\-'’])(\p{L})/gu, (_, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it'))
}

// Da usare nell'onChange PRIMA di aggiornare lo stato React: corregge il
// valore direttamente nel campo tenendo il cursore dov'era (cambiano solo le
// maiuscole, non la lunghezza), poi torna il valore da mettere nello stato.
// Così React trova il campo già uguale allo stato e non sposta il cursore.
export type CampoTesto = {
  value: string
  selectionStart: number | null
  selectionEnd: number | null
  setSelectionRange?: (inizio: number, fine: number) => void
}
export function maiuscoleNelCampo(campo: CampoTesto): string {
  const nuovo = conInizialiDigitando(campo.value)
  if (nuovo !== campo.value) {
    const inizio = campo.selectionStart, fine = campo.selectionEnd
    campo.value = nuovo
    if (inizio !== null && fine !== null && campo.setSelectionRange) campo.setSelectionRange(inizio, fine)
  }
  return nuovo
}
