'use client'
// Provenienza del CLIENTE (0037, 08/09/2026): letture e scritture su Supabase.
// Le regole stanno in lib/provenienza (pure). Il campo è «disponibile» solo se
// esistono la tabella strutture (0036) e le colonne di guests (0037); senza,
// avviso e nessun salvataggio bloccato (i campi restano fuori dai payload).
import { supabase } from './supabase'
import { raccogliPagine } from './statistiche/paginazione'
import { scriviPoiAggiorna } from './scritturaSicura'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { normalizzaTelefono } from './whatsapp'
import { manca0036, strutturePerOspiti, strutturaNota, daApplicareAlCliente, AVVISO_0036, AVVISO_0037, type StrutturaNota, type CampiProvenienza } from './provenienza'

export type LetturaStrutture =
  | { disponibile: true; strutture: StrutturaNota[]; errore: null; avviso: null }
  | { disponibile: false; strutture: StrutturaNota[]; errore: string | null; avviso: string | null }   // avviso = migrazione mancante

type ClienteRiga = { id: string; provenienza: string | null; struttura_nome: string | null }

// I nomi noti (tabella strutture) con i CLIENTI già portati (guests con
// struttura_nome). Tabella assente = 0036 non applicata; colonne di guests
// assenti = 0037 non applicata.
export async function leggiStrutture(): Promise<LetturaStrutture> {
  const t = await raccogliPagine<{ nome: string }>((offset, limite) => supabase.from('strutture').select('nome').order('nome').range(offset, offset + limite - 1))
  if (t.error) {
    if (manca0036(t.error as { code?: string; message?: string })) return { disponibile: false, strutture: [], errore: null, avviso: AVVISO_0036 }
    return { disponibile: false, strutture: [], errore: messaggioLetturaNonRiuscita(t.error, 'caricare le strutture'), avviso: null }
  }
  const g = await raccogliPagine<ClienteRiga>((offset, limite) => supabase.from('guests').select('id, provenienza, struttura_nome').eq('provenienza', 'altra_struttura').range(offset, offset + limite - 1))
  if (g.error) {
    if (manca0036(g.error as { code?: string; message?: string })) return { disponibile: false, strutture: [], errore: null, avviso: AVVISO_0037 }
    return { disponibile: false, strutture: [], errore: messaggioLetturaNonRiuscita(g.error, 'contare i clienti delle strutture'), avviso: null }
  }
  return { disponibile: true, strutture: strutturePerOspiti(t.data.map(x => x.nome), g.data.map(c => ({ id: c.id, provenienza: c.provenienza, struttura_nome: c.struttura_nome }))), errore: null, avviso: null }
}

// Un nome nuovo scritto da Ania entra nell'elenco (upsert, idempotente).
export async function ricordaStruttura(nome: string | null, note: { nome: string }[]): Promise<string | null> {
  const n = (nome ?? '').trim()
  if (!n || strutturaNota(n, note)) return null
  return scriviPoiAggiorna(() => supabase.from('strutture').upsert({ nome: n }, { onConflict: 'nome', ignoreDuplicates: true }), () => {})
}

// La provenienza del cliente: vale per tutte le sue prenotazioni. Colonne
// assenti → avviso 0037 (mai un errore muto).
export async function salvaProvenienzaCliente(guestId: string, campi: CampiProvenienza, aggiorna: () => void = () => {}): Promise<string | null> {
  const r = await supabase.from('guests').update(campi).eq('id', guestId).select('id')
  if (r.error) return manca0036(r.error) ? AVVISO_0037 : `Provenienza non salvata: ${r.error.message}`
  if (!r.data || r.data.length === 0) return 'Provenienza non salvata: cliente non trovato'
  aggiorna()
  return null
}

// Cliente esistente per telefono (cifre), con provenienza e soggiorni
// conclusi: per precompilare i chip nella nuova richiesta
export type ClienteTrovato = { id: string; full_name: string | null; provenienza: string | null; struttura_nome: string | null; soggiorniConclusi: number; conColonne: boolean }
export async function cercaClientePerTelefono(telefono: string, oggi: string): Promise<ClienteTrovato | null> {
  const cifre = normalizzaTelefono(telefono).numero
  if (!cifre || cifre.length < 8) return null
  const { data, error } = await supabase.from('guests').select('*').ilike('phone', `%${cifre.slice(-9)}%`).limit(5)
  if (error || !data) return null
  const g = data.find(x => normalizzaTelefono(x.phone).numero === cifre) as Record<string, unknown> | undefined
  if (!g) return null
  const b = await supabase.from('bookings').select('id, group_id, check_out, status').eq('guest_id', g.id as string).in('status', ['confermata', 'completata']).lte('check_out', oggi)
  const gruppi = new Set((b.data || []).map(x => x.group_id || x.id))
  return { id: g.id as string, full_name: (g.full_name as string) ?? null, provenienza: (g.provenienza as string) ?? null, struttura_nome: (g.struttura_nome as string) ?? null, soggiorniConclusi: gruppi.size, conColonne: 'provenienza' in g }
}

// Alla conferma di una richiesta: la provenienza provvisoria della richiesta
// va sul CLIENTE della prenotazione creata, solo se lui non ne ha già una.
export async function applicaProvenienzaAlCliente(richiesta: { provenienza?: string | null; struttura_nome?: string | null }, prenotazioneId: string): Promise<string | null> {
  const letta = await supabase.from('bookings').select('guest_id, guests(*)').eq('id', prenotazioneId).maybeSingle()
  if (letta.error) return `Prenotazione creata, ma la provenienza non è stata copiata sul cliente: ${letta.error.message}`
  const guestId = letta.data?.guest_id as string | null | undefined
  if (!guestId) return null
  const cliente = (letta.data?.guests ?? null) as { provenienza?: string | null; struttura_nome?: string | null } | null
  if (cliente && !('provenienza' in cliente)) return AVVISO_0037
  const campi = daApplicareAlCliente(richiesta, cliente)
  if (!campi) return null
  return salvaProvenienzaCliente(guestId, campi)
}
