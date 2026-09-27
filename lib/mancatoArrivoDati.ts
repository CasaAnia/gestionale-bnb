'use client'
import { supabase } from './supabase'
import { chiavePrenotazione, type IdentitaPrenotazione } from './prenotazioneUnica'
import type { RigaMancatoArrivo } from './mancatoArrivo'
export type TentativoMancato = { id: string; richiesta: Record<string, unknown> }
type Risposta = { righe: RigaMancatoArrivo[]; dovuto: number; ricevuto: number; movimento_id: string | null }
const chiave = (b: IdentitaPrenotazione) => `mancato-arrivo:${chiavePrenotazione(b)}`
export function leggiTentativoMancato(b: IdentitaPrenotazione): TentativoMancato | null {
  const s = window.localStorage.getItem(chiave(b)); return s ? JSON.parse(s) : null
}
export async function eseguiMancato(b: IdentitaPrenotazione, richiesta: Record<string, unknown> | null): Promise<{ errore: string | null; incerto: boolean }> {
  let t: TentativoMancato | null
  try {
    t=leggiTentativoMancato(b)
    if (!t && richiesta) {
      t={id:crypto.randomUUID(),richiesta}
      window.localStorage.setItem(chiave(b),JSON.stringify(t))
      if (window.localStorage.getItem(chiave(b))!==JSON.stringify(t)) throw new Error('custodia')
    }
  } catch { return {errore:'Non riesco a conservare il salvataggio su questo dispositivo. Nessun invio eseguito.',incerto:true} }
  if (!t) return {errore:'Nessun salvataggio da verificare.',incerto:false}
  let risposta: Risposta | null=null
  try {
    if (richiesta) {
      const r=await supabase.rpc('gestisci_mancato_arrivo',{p_operazione:t.id,p_richiesta:t.richiesta})
      if(r.error) {
        if (/^(P\d{4}|22\w{3}|23\w{3}|42501|PGRST202)$/.test(r.error.code||'')) {
          window.localStorage.removeItem(chiave(b))
          return {errore:r.error.code==='PGRST202'?'Funzione non ancora attivata. Nessuna modifica eseguita.':r.error.message,incerto:false}
        }
        return {errore:'Esito da verificare. Premi Verifica salvataggio senza reinviare il pagamento.',incerto:true}
      }
      risposta=r.data as Risposta
    } else {
      const r=await supabase.from('mancato_arrivo_operazioni').select('risposta').eq('id',t.id).maybeSingle()
      if(r.error || !r.data) return {errore:'Salvataggio non ancora confermato. Non ripetere: ricontrolla quando la connessione è stabile.',incerto:true}
      risposta=r.data.risposta as Risposta
    }
    if(!risposta || !Array.isArray(risposta.righe) || !risposta.righe.length || !Number.isSafeInteger(risposta.dovuto) || !Number.isSafeInteger(risposta.ricevuto)) throw new Error('risposta')
    const ids=risposta.righe.map(r=>r.id)
    if(!ids.includes(b.id)||new Set(ids).size!==ids.length||risposta.righe.some(r=>r.status!=='annullata')) throw new Error('identità risposta')
    const [letta,pag]=await Promise.all([
      supabase.from('bookings').select('*').in('id',ids),
      supabase.from('payments').select('id,booking_id,amount').in('booking_id',ids),
    ])
    const campi=['status','mancato_arrivo_centesimi','total_amount','check_in','check_out','room_id','guest_id','cancelled_reason','pagato']
    if(letta.error || pag.error || letta.data?.length!==ids.length || !pag.data || risposta.righe.some(r=>{
      const x=letta.data!.find(x=>x.id===r.id); return !x || campi.some(k=>JSON.stringify(x[k])!==JSON.stringify((r as unknown as Record<string,unknown>)[k]))
    }) || pag.data.reduce((n,p)=>n+Math.round(Number(p.amount)*100),0)!==risposta.ricevuto || (risposta.movimento_id && !pag.data.some(p=>p.id===risposta!.movimento_id))) {
      return {errore:'La rilettura non coincide o non è completa. Non ripetere il salvataggio: verifica la prenotazione.',incerto:true}
    }
    window.localStorage.removeItem(chiave(b))
    window.dispatchEvent(new Event('pulizie-salvataggi'))
    return {errore:null,incerto:false}
  } catch { return {errore:'Risposta non verificata. Premi Verifica salvataggio, senza registrare di nuovo.',incerto:true} }
}
