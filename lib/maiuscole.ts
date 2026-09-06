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
