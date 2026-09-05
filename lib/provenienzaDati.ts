'use client'
// Provenienza dell'ospite (08/09/2026): letture e scritture su Supabase.
// Le regole stanno in lib/provenienza (pure). Senza la proposta 0036 la
// tabella `strutture` non esiste: si torna «non disponibile» con l'avviso e
// nessun salvataggio si blocca (i campi restano fuori dai payload).
import { supabase } from './supabase'
import { raccogliPagine } from './statistiche/paginazione'
import { scriviPoiAggiorna } from './scritturaSicura'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { manca0036, strutturePerOspiti, strutturaNota, campiDaCopiareAllaPrenotazione, AVVISO_0036, type StrutturaNota, type CampiProvenienza } from './provenienza'

export type LetturaStrutture =
  | { disponibile: true; strutture: StrutturaNota[]; errore: null }
  | { disponibile: false; strutture: StrutturaNota[]; errore: string | null }   // errore null = migrazione non applicata

// I nomi noti (tabella strutture) con gli ospiti già portati (prenotazioni
// confermate con struttura_nome). Tabella assente = 0036 non applicata.
export async function leggiStrutture(): Promise<LetturaStrutture> {
  const t = await raccogliPagine<{ nome: string }>((offset, limite) => supabase.from('strutture').select('nome').order('nome').range(offset, offset + limite - 1))
  if (t.error) {
    if (manca0036(t.error as { code?: string; message?: string })) return { disponibile: false, strutture: [], errore: null }
    return { disponibile: false, strutture: [], errore: messaggioLetturaNonRiuscita(t.error, 'caricare le strutture') }
  }
  const b = await raccogliPagine<{ id: string; group_id: string | null; provenienza: string | null; struttura_nome: string | null; status: string }>((offset, limite) =>
    supabase.from('bookings').select('id, group_id, provenienza, struttura_nome, status').eq('provenienza', 'altra_struttura').range(offset, offset + limite - 1))
  if (b.error) return { disponibile: false, strutture: [], errore: messaggioLetturaNonRiuscita(b.error, 'contare gli ospiti delle strutture') }
  return { disponibile: true, strutture: strutturePerOspiti(t.data.map(x => x.nome), b.data), errore: null }
}

// Un nome nuovo scritto da Ania entra nell'elenco (upsert, idempotente).
// Torna il messaggio d'errore o null; non blocca il salvataggio principale.
export async function ricordaStruttura(nome: string | null, note: { nome: string }[]): Promise<string | null> {
  const n = (nome ?? '').trim()
  if (!n || strutturaNota(n, note)) return null
  return scriviPoiAggiorna(() => supabase.from('strutture').upsert({ nome: n }, { onConflict: 'nome', ignoreDuplicates: true }), () => {})
}

// Alla conferma di una richiesta: la provenienza passa alla prenotazione
// (tutti i segmenti del soggiorno). Colonne assenti → avviso, non errore.
export async function copiaProvenienzaSuPrenotazione(richiesta: { provenienza?: string | null; struttura_nome?: string | null }, prenotazioneId: string): Promise<string | null> {
  const campi: CampiProvenienza = campiDaCopiareAllaPrenotazione(richiesta)
  const letta = await supabase.from('bookings').select('id, group_id').eq('id', prenotazioneId).maybeSingle()
  if (letta.error) return `Prenotazione creata, ma la provenienza non è stata copiata: ${letta.error.message}`
  const groupId = letta.data?.group_id as string | null | undefined
  const scrivi = () => (groupId ? supabase.from('bookings').update(campi).eq('group_id', groupId) : supabase.from('bookings').update(campi).eq('id', prenotazioneId))
  const r = await scrivi()
  if (!r.error) return null
  if (manca0036(r.error)) return AVVISO_0036
  return `Prenotazione creata, ma la provenienza non è stata copiata: ${r.error.message}`
}
