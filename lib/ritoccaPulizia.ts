'use client'
import { supabase } from './supabase'
import { eseguiRitocco, type RichiestaRitocco } from './ritoccaPuliziaCore'

export function ritoccaPulizia(r: RichiestaRitocco) {
  return eseguiRitocco({
    rpc: (f, a) => supabase.rpc(f, a),
    rileggi: id => supabase.from('cleanings').select('id, ora_effettiva').eq('id', id).maybeSingle(),
  }, r)
}
