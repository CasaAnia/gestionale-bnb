// ============================================================================
// CLIENTE RICONOSCIUTO DAL NUMERO (Ania, 07/09/2026): «Errore creazione
// cliente: duplicate key value violates unique constraint guests_phone_key»
// nella Nuova prenotazione. Il numero di telefono identifica la scheda
// (guests.phone è UNIQUE): quando la ricerca per nome non trova la scheda
// (nome scritto diverso da come è salvato) e Ania scrive il numero di un
// cliente già in archivio, oppure quando la scheda è appena stata creata
// dalla prima camera e si aggiunge un cambio camera, il gestionale NON deve
// creare una seconda scheda: riconosce quella esistente e la usa.
// Funzioni pure; la lettura sta in lib/clienteTelefonoDati.
// ============================================================================
import { normalizzaTelefono, INVISIBILI_TELEFONO } from './whatsapp.ts'
import { normalizzaNome } from './guestName.ts'
import { conIniziali } from './maiuscole.ts'

// Solo cifre, col prefisso 39 aggiunto ai numeri italiani senza prefisso
export function cifreTelefono(raw: string | null | undefined): string {
  return normalizzaTelefono(raw).numero
}

// ── L'IDENTITÀ DEL NUMERO (21/10/2026) ──────────────────────────────────────
// «Cliente già presente non riconosciuto col +39» (Ania, 21/10/2026). Un numero
// copiato da WhatsApp arriva con spazi non separabili e segni invisibili di
// direzione del testo (U+202A…U+202C, U+2066…U+2069, U+200E/F); scritto a mano
// con +39, 0039, spazi, trattini o parentesi; salvato in archivio in qualunque
// di queste forme. `chiaveTelefono` riduce tutte le forme dello STESSO numero
// a una chiave sola, col prefisso del paese (393331234567):
//  · +… e 00… → il prefisso internazionale scritto si tiene, mai tolto;
//  · senza prefisso, 3 + 8/9 cifre (cellulare) o 0 + 5/10 cifre (fisso) →
//    numero italiano, si mette davanti il 39;
//  · senza prefisso, 11–15 cifre che non possono essere italiane nazionali →
//    è già col prefisso del paese (393331234567, 48600000000);
//  · tutto il resto (troppo corto, lettere, un 39 seguito da un numero
//    italiano impossibile) → null: NON si riconosce nessuno in automatico.
// Due numeri sono lo stesso solo se le chiavi sono uguali per intero: mai il
// confronto delle sole ultime cifre (+44 7700 900123 non è 7700900123).
export { INVISIBILI_TELEFONO }

export function chiaveTelefono(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(INVISIBILI_TELEFONO, '').replace(/[\s.\-()/]/g, '')
  if (!s || /[^\d+]/.test(s) || s.lastIndexOf('+') > 0) return null
  let cifre: string
  if (s.startsWith('+')) cifre = s.slice(1)
  else if (s.startsWith('00')) cifre = s.slice(2)
  else if (/^3\d{8,9}$/.test(s) || /^0[1-9]\d{4,9}$/.test(s)) cifre = `39${s}`
  else if (/^[1-9]\d{10,14}$/.test(s)) cifre = s
  else return null
  if (!/^[1-9]\d{7,14}$/.test(cifre)) return null
  if (cifre.startsWith('39') && !/^39(3\d{8,9}|0\d{5,10})$/.test(cifre)) return null
  return cifre
}

// Stesso numero anche se salvato in forme diverse («+39 333 000 0001»,
// «393330000001», «3330000001», «0039 333-000-0001»): chiavi uguali per intero.
// Un numero incompleto o non riconoscibile non è «lo stesso» di nessuno.
export function stessoNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = chiaveTelefono(a)
  return !!ka && ka === chiaveTelefono(b)
}

// Schema ilike per PostgREST che trova il numero in qualunque forma salvata:
// le ultime 9 cifre separate da «%» («%3%3%3%0%0%0%0%0%0%1%»). Chi legge
// riverifica poi con stessoNumero, così un'interposizione di cifre non
// inganna. Null con meno di 6 cifre (troppo poco per cercare).
export function schemaRicercaTelefono(raw: string | null | undefined): string | null {
  const cifre = cifreTelefono(raw)
  if (cifre.length < 6) return null
  return '%' + cifre.slice(-9).split('').join('%') + '%'
}

// Fra le righe lette, la scheda con davvero lo stesso numero (la più recente prima)
export function schedaConNumero<T extends { phone?: string | null }>(righe: T[], raw: string | null | undefined): T | null {
  return righe.find(g => stessoNumero(g.phone, raw)) ?? null
}

// Tutte le schede col numero davvero uguale: più di una vuol dire che lo
// stesso numero è salvato su schede diverse, e chi sceglie è Ania.
export function schedeConNumero<T extends { phone?: string | null }>(righe: T[], raw: string | null | undefined): T[] {
  return righe.filter(g => stessoNumero(g.phone, raw))
}

// ── La ricerca per telefono della Nuova prenotazione (21/10/2026) ──────────
// La ricerca è «sembra un numero» quando contiene solo cifre, +, spazi,
// separatori e segni invisibili: allora non si cerca fra i nomi (le parentesi
// di «(02) 1234567» romperebbero il filtro di PostgREST) e i filtri sul
// telefono trovano le cifre anche se in archivio sono separate da spazi o
// trattini, con o senza +39/0039. Le varianti sono le cifre digitate, e
// quelle senza 0039/+39 quando il numero è italiano completo. I risultati
// passano poi da filtraClienti (lib/cambiaCliente), che li ricontrolla.
export function sembraTelefono(testo: string): boolean {
  const t = testo.replace(INVISIBILI_TELEFONO, '').trim()
  return /\d/.test(t) && /^[+\d\s.\-()/]+$/.test(t)
}

export function varianteCifre(testo: string): string[] {
  const cifre = testo.replace(/\D/g, '')
  if (cifre.length < 3) return []
  const varianti = new Set([cifre])
  const chiave = chiaveTelefono(testo)
  // il numero intero col prefisso del paese senza + o 00 (447700900123), e per
  // l'Italia anche senza 39, come spesso è in archivio
  if (chiave) varianti.add(chiave)
  if (chiave?.startsWith('39')) varianti.add(chiave.slice(2))
  // a metà numero («+39 333 99…»): il prefisso italiano SCRITTO si toglie
  // anche prima che il numero sia completo, per trovare «333 99…» in archivio
  const pulito = testo.replace(INVISIBILI_TELEFONO, '').trim()
  if (/^(\+|00)39/.test(pulito)) {
    const nazionale = cifre.replace(/^(00)?39/, '')
    if (nazionale.length >= 3) varianti.add(nazionale)
  }
  return [...varianti]
}

export function filtriTelefonoRicerca(testo: string): string[] {
  const filtri = new Set<string>()
  for (const v of varianteCifre(testo)) {
    filtri.add(`phone.ilike.%${v}%`)
    // con 6 cifre o più anche separate da spazi, punti o trattini in archivio
    if (v.length >= 6) filtri.add(`phone.ilike.%${v.split('').join('%')}%`)
  }
  return [...filtri]
}

// Nell'elenco dei trovati prima le schede col numero identico a quello cercato
export function ordinaPerNumeroUguale<T extends { phone?: string | null }>(righe: T[], testo: string): T[] {
  if (!chiaveTelefono(testo)) return righe
  return [...righe].sort((a, b) => Number(stessoNumero(b.phone, testo)) - Number(stessoNumero(a.phone, testo)))
}

// Riga sotto il cliente nuovo quando il numero scritto c'è già in archivio
export function testoNumeroGiaInArchivio(schede: { full_name?: string | null }[]): string | null {
  if (schede.length === 0) return null
  if (schede.length === 1) return `Questo numero è già in archivio: è di ${(schede[0].full_name || '').trim() || 'una scheda senza nome'}. Tocca la scheda per usarla, così non nasce un doppione.`
  return `Questo numero è già su ${schede.length} schede: scegli quella giusta. Non ne creo un'altra.`
}

// Il nome scritto nel modulo resta su QUESTA prenotazione (bookings.guest_name)
// se è diverso da quello della scheda riconosciuta: la scheda non si rinomina
// (figlio che prenota per il genitore, coniugi con lo stesso numero).
export function nomeSuPrenotazione(scritto: string | null | undefined, scheda: string | null | undefined): string | null {
  const s = conIniziali(scritto)
  if (!s) return null
  return normalizzaNome(s) === normalizzaNome(scheda) ? null : s
}

// Riga sotto «Cliente trovato» che spiega cos'è successo
export function testoClienteRiconosciuto(scheda: { full_name?: string | null; phone?: string | null }, nomeSu: string | null): string {
  const chi = (scheda.full_name || '').trim() || 'una scheda senza nome'
  const base = `Numero già in archivio: uso la scheda di ${chi}.`
  return nomeSu ? `${base} «${nomeSu}» resta come nome di questa prenotazione, la scheda non cambia.` : base
}

// «Dati della cliente»: il numero nuovo è già di un'altra scheda
export function testoNumeroAltraScheda(altre: { full_name?: string | null }[]): string {
  const chi = altre.map(s => (s.full_name || '').trim() || 'una scheda senza nome').join(', ')
  return `Non salvato: questo numero è già nella scheda di ${chi}. Controlla il numero; le due schede non si uniscono da qui.`
}

// ── Conferma di una richiesta senza doppioni (21/10/2026, R2 e T1) ─────────
// La RPC conferma_richiesta sceglie la scheda con le stesse CIFRE del telefono
// della richiesta (la più vecchia, se sono più d'una) e, se non la trova, ne
// crea una a sole cifre: «+45 32 12 34 56» diventava «4532123456», che poi
// non si riconosce più (T1 di Codex). Prima di chiamarla si decide qui, su
// `schede` (stesso numero) e `righe` (tutto ciò che la lettura ha portato,
// per vedere chi ha le stesse cifre pur essendo un altro numero):
//  · nessuna scheda di quel numero, numero riconoscibile → «nuova»: l'app crea
//    PRIMA la scheda col «+» (telefonoDaSalvare), la RPC poi la trova per cifre;
//  · numero non riconoscibile → «libera»: vale la regola di sempre della RPC;
//  · una scheda (o quella scelta) con le stesse cifre della richiesta → «libera»;
//  · una scheda scritta in un'altra forma → «allinea»: il telefono della
//    richiesta prende la forma della scheda (stesso numero);
//  · più schede e nessuna scelta → «scegli»;
//  · le cifre che userebbe la RPC sono anche di un'altra scheda → «bloccata».
export type DecisioneConferma<T> =
  | { tipo: 'libera'; scheda: T | null }
  | { tipo: 'nuova'; telefono: string }
  | { tipo: 'allinea'; scheda: T; telefono: string }
  | { tipo: 'scegli'; schede: T[] }
  | { tipo: 'bloccata'; motivo: string }

const soloCifre = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '')
const nomeScheda = (g: { full_name?: string | null }) => (g.full_name || '').trim() || 'senza nome'

export function decisioneConferma<T extends { id: string; phone?: string | null; full_name?: string | null }>(
  telefonoRichiesta: string | null | undefined, schede: T[], sceltaId: string | null, righe: T[] = schede,
): DecisioneConferma<T> {
  const cifre = soloCifre(telefonoRichiesta)
  if (!cifre) return { tipo: 'libera', scheda: null }
  const tutte = [...new Map([...righe, ...schede].map(g => [g.id, g])).values()]
  const stesse = tutte.filter(g => stessoNumero(g.phone, telefonoRichiesta))
  const conCifre = (c: string, tranne: string | null) => tutte.filter(g => g.id !== tranne && soloCifre(g.phone) === c)
  if (stesse.length === 0) {
    const chiave = chiaveTelefono(telefonoRichiesta)
    const omonime = conCifre(cifre, null)
    if (omonime.length) {
      return { tipo: 'bloccata', motivo: `Non creo la prenotazione: le stesse cifre del numero sono già sulla scheda di ${omonime.map(nomeScheda).join(', ')}, ma come numero diverso. Controlla il numero della richiesta o della scheda, poi conferma.` }
    }
    return chiave ? { tipo: 'nuova', telefono: `+${chiave}` } : { tipo: 'libera', scheda: null }
  }
  const scelta = stesse.length === 1 ? stesse[0] : (stesse.find(g => g.id === sceltaId) ?? null)
  if (!scelta) return { tipo: 'scegli', schede: stesse }
  const cifreScelta = soloCifre(scelta.phone)
  const gemelle = conCifre(cifreScelta, scelta.id)
  if (gemelle.length) {
    return { tipo: 'bloccata', motivo: `Non creo la prenotazione: lo stesso numero è scritto uguale su più schede (${[scelta, ...gemelle].map(nomeScheda).join(', ')}) e la conferma non saprebbe quale usare. Correggi il numero di una delle schede, poi conferma.` }
  }
  if (cifreScelta === cifre) return { tipo: 'libera', scheda: scelta }
  return { tipo: 'allinea', scheda: scelta, telefono: scelta.phone ?? '' }
}

// ── Il numero per chiamare e per WhatsApp (21/10/2026, T2 di Codex) ────────
// Cifre col prefisso del paese, senza «+»: tel:+… e wa.me/…. Prima si
// incollava «39» davanti a tutto ciò che non cominciava per 39, anche a
// «+4532123456» (→ 394532123456). Ora: numero riconoscibile → la sua chiave
// (+45… resta 45…, 333… diventa 39333…); scritto col + o 00 ma non
// riconoscibile → le cifre dopo il prefisso, senza aggiungere niente; solo
// le cifre nude e non riconoscibili seguono la regola di prima (39 davanti),
// come i numeri italiani vecchi in archivio. Null senza cifre.
export function numeroPerContatto(phone: string | null | undefined): string | null {
  const chiave = chiaveTelefono(phone)
  if (chiave) return chiave
  const s = (phone ?? '').replace(INVISIBILI_TELEFONO, '').replace(/[\s.\-()/]/g, '')
  const cifre = s.replace(/\D/g, '')
  if (!cifre) return null
  if (s.startsWith('+')) return cifre
  if (s.startsWith('00')) return cifre.slice(2) || null
  return cifre.startsWith('39') ? cifre : `39${cifre}`
}
