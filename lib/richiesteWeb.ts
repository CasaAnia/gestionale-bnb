// Richieste che arrivano dal modulo del sito (pezzo 5A): validazione pura,
// mappa della camera, riconoscimento dei doppioni e limite per IP. Nessun
// accesso a rete o database: la route app/api/richieste/web fa il resto.
import { normalizzaTelefono, telefonoLeggibile } from './whatsapp.ts'
import { ROOM_SLUG_BY_NAME } from './roomTypes.ts'

export type RichiestaWebValida = {
  nome: string
  cognome: string
  arrivo: string
  partenza: string
  persone: number
  camera_id: string | null
  telefono: string           // "+393331234567"
  telefonoCifre: string      // "393331234567"
  note: string | null
  origine: string | null
}
export type EsitoValidazione = { ok: true; dati: RichiestaWebValida } | { ok: false; errore: string }

export const PERSONE_MAX = 4
export const FINESTRA_DOPPIONI_MIN = 10
export const LIMITE_PER_IP = 10
export const FINESTRA_IP_MIN = 10

const DATA = /^\d{4}-\d{2}-\d{2}$/
const dataValida = (s: string) => DATA.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s
const testo = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

// Camera come la manda il sito: id, nome ("Amelia") o slug della pagina ("singola").
export function mappaCamera(v: unknown, camere: { id: string; name: string }[]): string | null {
  const s = testo(v, 80).toLowerCase()
  if (!s) return null
  for (const c of camere) {
    if (c.id.toLowerCase() === s || c.name.toLowerCase() === s) return c.id
    const slug = ROOM_SLUG_BY_NAME[c.name]
    if (slug && slug.toLowerCase() === s) return c.id
  }
  return null
}

export function validaRichiestaWeb(corpo: unknown, oggi: string, camere: { id: string; name: string }[]): EsitoValidazione {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return { ok: false, errore: 'Corpo della richiesta non valido' }
  const b = corpo as Record<string, unknown>
  const nome = testo(b.nome, 60), cognome = testo(b.cognome, 60)
  if (!nome) return { ok: false, errore: 'Manca il nome' }
  if (!cognome) return { ok: false, errore: 'Manca il cognome' }
  const arrivo = testo(b.arrivo, 10), partenza = testo(b.partenza, 10)
  if (!dataValida(arrivo)) return { ok: false, errore: 'Data di arrivo non valida (atteso AAAA-MM-GG)' }
  if (!dataValida(partenza)) return { ok: false, errore: 'Data di partenza non valida (atteso AAAA-MM-GG)' }
  if (partenza <= arrivo) return { ok: false, errore: 'La partenza deve essere dopo l’arrivo' }
  if (arrivo < oggi) return { ok: false, errore: 'La data di arrivo è nel passato' }
  const persone = Number(b.persone)
  if (!Number.isInteger(persone) || persone < 1 || persone > PERSONE_MAX) return { ok: false, errore: `Persone: da 1 a ${PERSONE_MAX}` }
  const tel = normalizzaTelefono(typeof b.telefono === 'string' ? b.telefono : '')
  if (!tel.numero || tel.numero.length < 8) return { ok: false, errore: 'Numero di telefono mancante o troppo corto' }
  const email = testo(b.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, errore: 'Email non valida' }
  const noteUtente = testo(b.note, 1000)
  const note = [noteUtente, email ? `Email: ${email}` : ''].filter(Boolean).join('\n') || null
  const origine = testo(b.origine, 40) || null
  return {
    ok: true,
    dati: { nome, cognome, arrivo, partenza, persone, camera_id: mappaCamera(b.camera, camere), telefono: telefonoLeggibile(tel), telefonoCifre: tel.numero, note, origine },
  }
}

// Doppione: stesse date e stesso telefono (solo cifre) oppure stesso nome+cognome
export function stessaRichiesta(
  nuova: Pick<RichiestaWebValida, 'nome' | 'cognome' | 'arrivo' | 'partenza' | 'telefonoCifre'>,
  esistente: { nome: string; cognome: string; arrivo: string; partenza: string; telefono: string | null },
): boolean {
  if (esistente.arrivo !== nuova.arrivo || esistente.partenza !== nuova.partenza) return false
  const cifre = (esistente.telefono || '').replace(/\D/g, '')
  if (cifre && cifre === nuova.telefonoCifre) return true
  const n = (s: string) => s.trim().toLowerCase()
  return n(esistente.nome) === n(nuova.nome) && n(esistente.cognome) === n(nuova.cognome)
}

// Limite per IP: al massimo LIMITE_PER_IP richieste in FINESTRA_IP_MIN minuti.
// La memoria vive nel processo (su Vercel per istanza): un freno semplice, non un muro.
export function consentiIp(registro: Map<string, number[]>, ip: string, adesso = Date.now()): boolean {
  const finestra = FINESTRA_IP_MIN * 60000
  const recenti = (registro.get(ip) || []).filter(t => adesso - t < finestra)
  if (recenti.length >= LIMITE_PER_IP) { registro.set(ip, recenti); return false }
  recenti.push(adesso)
  registro.set(ip, recenti)
  return true
}
