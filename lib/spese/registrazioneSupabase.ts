// Il ClienteIdempotente vero del BROWSER — DA COLLEGARE alle pagine SOLO
// DOPO l'applicazione della migrazione 0022 in produzione. Nessun service
// role: chiave anon + sessione, la RPC verifica da sé l'appartenenza ad
// app_members. Gli adattatori vivono in registrazioneClient.ts (fabbrica
// iniettabile: il collaudo usa gli STESSI, puntati al progetto di prova).
import { supabase } from '@/lib/supabase'
import { creaClienteIdempotente } from './registrazioneClient'
import type { ClienteIdempotente } from './registrazioneIdempotente'

export const clienteIdempotenteSupabase: ClienteIdempotente =
  creaClienteIdempotente(supabase as never)
