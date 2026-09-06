'use client'
// Recupero biancheria (06/09/2026): letture e scrittura sulla tabella
// biancheria_recuperata (migrazione 0039). Tabella assente = niente righe e
// nessun errore in lettura; in scrittura torna «Non salvato, riprova»
// (lib/scritturaSicura) e la pulizia resta comunque segnata. Le regole sono
// in lib/biancheria: qui nessuna formula.
import { supabase } from './supabase'
import { raccogliPagine, raccogliBlocchi, aBlocchi } from './statistiche/paginazione'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { scriviPoiAggiorna } from './scritturaSicura'
import { normalizza, tabellaBiancheriaAssente, CHIAVI, type Recupero } from './biancheria'

export const TABELLA_BIANCHERIA = 'biancheria_recuperata'
type Risposta = PromiseLike<{ data: Recupero[] | null; error: unknown }>

export type LetturaRecuperi = { righe: Recupero[]; tabella: boolean; errore: string | null }

function pulita(r: Recupero): Recupero {
  return { ...r, ...normalizza(r) }
}

// Recuperi con data in [da, a) — Statistiche, stesso periodo delle altre letture
export async function leggiRecuperi(da: string, a: string, cosa = 'caricare la biancheria recuperata'): Promise<LetturaRecuperi> {
  const r = await raccogliPagine<Recupero>((offset, limite) => supabase.from(TABELLA_BIANCHERIA).select('*')
    .gte('data', da).lt('data', a).order('data', { ascending: true }).range(offset, offset + limite - 1) as unknown as Risposta)
  if (r.error) {
    if (tabellaBiancheriaAssente(r.error)) return { righe: [], tabella: false, errore: null }
    return { righe: [], tabella: true, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  }
  return { righe: r.data.map(pulita), tabella: true, errore: null }
}

// Recuperi delle pulizie indicate (registro «Ultime pulizie»), a blocchi di ID
export async function leggiRecuperiDellePulizie(cleaningIds: string[], cosa = 'caricare la biancheria recuperata'): Promise<LetturaRecuperi> {
  const ids = [...new Set(cleaningIds.filter(Boolean))]
  if (ids.length === 0) return { righe: [], tabella: true, errore: null }
  const r = await raccogliBlocchi<Recupero, string>(aBlocchi(ids), blocco =>
    raccogliPagine<Recupero>((offset, limite) => supabase.from(TABELLA_BIANCHERIA).select('*')
      .in('cleaning_id', blocco).range(offset, offset + limite - 1) as unknown as Risposta), x => x.cleaning_id)
  if (r.error) {
    if (tabellaBiancheriaAssente(r.error)) return { righe: [], tabella: false, errore: null }
    return { righe: [], tabella: true, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  }
  return { righe: r.data.map(pulita), tabella: true, errore: null }
}

// UNA scrittura: upsert sulla pulizia (cleaning_id unico), così riaprendo la
// scheda si corregge la stessa riga. Torna null se salvato, altrimenti il
// messaggio da mostrare; `salvato` è la riga tornata dal server.
export async function salvaRecupero(r: Recupero): Promise<{ errore: string | null; salvato: Recupero | null }> {
  const valori = normalizza(r)
  const riga = { cleaning_id: r.cleaning_id, room_id: r.room_id, booking_id: r.booking_id ?? null, data: r.data, updated_at: new Date().toISOString(), ...Object.fromEntries(CHIAVI.map(c => [c, valori[c]])) }
  let salvato: Recupero | null = null
  const errore = await scriviPoiAggiorna(
    async () => {
      const res = await supabase.from(TABELLA_BIANCHERIA).upsert(riga, { onConflict: 'cleaning_id' }).select().single()
      if (!res.error && res.data) salvato = pulita(res.data as Recupero)
      return res
    },
    () => {},
  )
  return { errore, salvato: errore ? null : salvato }
}
