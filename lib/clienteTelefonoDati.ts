// Lettura della scheda cliente dal numero, in qualunque forma sia salvato
// (parte pura in lib/clienteTelefono). Errore di rete → { scheda: null, errore }:
// chi chiama decide se fermarsi o provare a creare la scheda.
// `schede` le porta tutte (21/10/2026): con più di una lo stesso numero è su
// schede diverse, `scheda` resta la più recente per chi ne vuole una sola.
import { supabase } from './supabase'
import { messaggioErroreDati } from './connessione'
import { schemaRicercaTelefono, schedeConNumero, filtriTelefonoRicerca, sembraTelefono, INVISIBILI_TELEFONO } from './clienteTelefono'

// `righe`: tutto ciò che la lettura ha portato (anche numeri diversi con le
// stesse ultime cifre), per chi deve controllare le cifre uguali (conferma).
export async function cercaSchedaPerTelefono<T extends { phone?: string | null }>(raw: string): Promise<{ scheda: T | null; schede: T[]; righe: T[]; errore: string | null }> {
  const schema = schemaRicercaTelefono(raw)
  if (!schema) return { scheda: null, schede: [], righe: [], errore: null }
  const { data, error } = await supabase.from('guests').select('*').ilike('phone', schema).order('created_at', { ascending: false }).limit(50)
  if (error) return { scheda: null, schede: [], righe: [], errore: messaggioErroreDati(error, 'cercare il cliente') }
  const righe = (data || []) as T[]
  const schede = schedeConNumero(righe, raw)
  return { scheda: schede[0] ?? null, schede, righe, errore: null }
}

// ── La ricerca dei clienti per nome o telefono (21/10/2026) ────────────────
// Unica per la Nuova prenotazione e per «Cambia cliente»: un numero si cerca
// solo fra i telefoni, con i filtri di filtriTelefonoRicerca (cifre anche
// separate in archivio, con o senza 39); un nome fra i nomi e, se ha almeno
// tre cifre, anche fra i telefoni, in una seconda lettura (niente testo
// libero dentro .or(), dove virgole e parentesi rompono il filtro). Chi
// chiama ripassa i risultati da filtraClienti.
export async function leggiClientiPerRicerca<T extends { id: string }>(testo: string, select: string, limite: number): Promise<{ righe: T[]; errore: unknown }> {
  const q = testo.replace(INVISIBILI_TELEFONO, '').trim()
  const telefono = filtriTelefonoRicerca(q)
  const letture: PromiseLike<{ data: unknown[] | null; error: unknown }>[] = []
  if (!sembraTelefono(q)) letture.push(supabase.from('guests').select(select).ilike('full_name', `%${q}%`).order('created_at', { ascending: false }).limit(limite))
  if (telefono.length) letture.push(supabase.from('guests').select(select).or(telefono.join(',')).order('created_at', { ascending: false }).limit(limite))
  const esiti = await Promise.all(letture)
  const errore = esiti.find(e => e.error)?.error
  if (errore) return { righe: [], errore }
  const visti = new Map<string, T>()
  for (const e of esiti) for (const r of (e.data ?? []) as T[]) visti.set(r.id, r)
  return { righe: [...visti.values()], errore: null }
}
