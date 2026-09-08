'use client'
// Letture paginate dei recuperi. Le scritture passano esclusivamente da
// pulizieServizio: nessun upsert separato che possa perdere la conferma.
import { supabase } from './supabase'
import { raccogliPagine, raccogliBlocchi, aBlocchi } from './statistiche/paginazione'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { normalizza, tabellaBiancheriaAssente, type Recupero } from './biancheria'

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
      .in('cleaning_id', blocco).order('id').range(offset, offset + limite - 1) as unknown as Risposta), x => x.cleaning_id)
  if (r.error) {
    if (tabellaBiancheriaAssente(r.error)) return { righe: [], tabella: false, errore: null }
    return { righe: [], tabella: true, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  }
  return { righe: r.data.map(pulita), tabella: true, errore: null }
}
