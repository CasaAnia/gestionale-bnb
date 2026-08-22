// Ricerca prenotazioni per nome o telefono, tollerante alla scrittura:
// "Giuseppina", "Schiavone", "7004354", "+39 342 700 4354" trovano tutte
// la stessa prenotazione. Il numero si confronta solo sulle cifre; il
// prefisso 39/0039 può esserci o mancare sia nel digitato sia in archivio.

function soloCifre(s: string) {
  return s.replace(/\D/g, '')
}

export function matchTelefono(telefono: string | null | undefined, query: string): boolean {
  const p = soloCifre(telefono || '')
  const q = soloCifre(query)
  if (!p || q.length < 3) return false
  // Varianti del digitato senza prefisso internazionale. Il taglio di "39"
  // solo oltre le 10 cifre evita di storpiare i cellulari che iniziano
  // davvero per 39 (es. 393...): un numero italiano ha 10 cifre.
  const varianti = new Set([q])
  if (q.startsWith('0039')) varianti.add(q.slice(4))
  if (q.startsWith('39') && q.length > 10) varianti.add(q.slice(2))
  const conPrefisso = `39${p}`
  return [...varianti].some(v => p.includes(v) || conPrefisso.includes(v))
}

export function matchNome(nomi: (string | null | undefined)[], query: string): boolean {
  const testo = nomi.filter(Boolean).join(' ').toLowerCase()
  const parole = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (parole.length === 0) return false
  // Tutte le parole digitate devono comparire ("giuseppina schiavone",
  // ma anche solo "schiavone" o "giu")
  return parole.every(p => testo.includes(p))
}

// Vale sia il nome della singola prenotazione (guest_name) sia quello in
// scheda cliente (guests.full_name): la ricerca trova entrambi.
export function matchPrenotazione(
  b: { guest_name?: string | null; guests?: { full_name?: string | null; phone?: string | null } | null },
  query: string
): boolean {
  const q = query.trim()
  if (!q) return true
  return matchNome([b.guest_name, b.guests?.full_name], q) || matchTelefono(b.guests?.phone, q)
}
