'use client'
import { useEffect,useRef,useState } from 'react'
import Foglio from './Foglio'
import { stileCampo } from '@/components/nuova/PezziNuova'
import { contoMancatoArrivo,fotoMancatoArrivo,mancatoArrivo,type RigaMancatoArrivo } from '@/lib/mancatoArrivo'
import { eseguiMancato,leggiTentativoMancato } from '@/lib/mancatoArrivoDati'
import { type IdentitaPrenotazione } from '@/lib/prenotazioneUnica'
import { importoInCent,importoProposto } from '@/lib/pagamentoFoglio'
import { euroScheda } from '@/lib/schedaPrenotazione'
export default function FoglioMancatoArrivo({booking,righe,pagamenti,oggi,onChiudi,onSalvato}:{
  booking:IdentitaPrenotazione;righe:RigaMancatoArrivo[];pagamenti:{booking_id:string;amount:number|string}[];oggi:string;onChiudi:()=>void;onSalvato:()=>void
}) {
  const [conto]=useState(()=>contoMancatoArrivo(righe,pagamenti))
  const [foto]=useState(()=>fotoMancatoArrivo(righe))
  const [gia]=useState(()=>righe.some(mancatoArrivo))
  const [importo,setImporto]=useState(importoProposto(conto.residuo))
  const [data,setData]=useState(oggi)
  const [metodo,setMetodo]=useState('contanti')
  const [occupato,setOccupato]=useState(false), [errore,setErrore]=useState(''), [pendente,setPendente]=useState(false),[pronto,setPronto]=useState(false)
  const blocco=useRef(false)
  useEffect(()=>{const id=setTimeout(()=>{try{setPendente(!!leggiTentativoMancato(booking));setPronto(true)}catch{setErrore('Impossibile leggere il salvataggio conservato.');setPendente(true)}},0);return()=>clearTimeout(id)},[booking])
  async function salva() {
    if(blocco.current||!pronto)return
    const cent=importoInCent(importo)
    if(gia&&!pendente&&(!cent||cent>conto.residuo||!data||data>oggi)){setErrore('Controlla importo e data: registra solo quanto ricevuto, entro il residuo.');return}
    blocco.current=true;setOccupato(true);setErrore('')
    try {
      const r=await eseguiMancato(booking,pendente?null:{azione:gia?'incassa':'segna',booking_id:booking.id,ricevuto:conto.ricevuto,...(gia?{dovuto:conto.dovuto,importo:cent,data,metodo}:{righe:foto})})
      setPendente(r.incerto)
      if(r.errore)setErrore(r.errore);else{onSalvato();onChiudi()}
    }finally{blocco.current=false;setOccupato(false)}
  }
  return <Foglio titolo={gia?'Pagamento · mancato arrivo':'Mancato arrivo'} onChiudi={occupato?()=>{}:onChiudi}>
    <p className="mt-4 text-sm text-stone">Prezzo originale: {euroScheda(conto.originale)}</p>
    <p className="mt-2 font-serif text-2xl">Dovuto per mancato arrivo: {euroScheda(conto.dovuto)} <span className="text-sm">(50%)</span></p>
    <p className="mt-2 text-sm">Già ricevuto: {euroScheda(conto.ricevuto)} · Da incassare: {euroScheda(Math.max(0,conto.residuo))}</p>
    {conto.residuo<0&&<p className="mt-2 text-sm text-red-800">Ricevuti {euroScheda(-conto.residuo)} oltre il dovuto. Verifica come gestire la differenza.</p>}
    {!gia?<><p className="mt-5 text-sm">La prenotazione resta nello storico. Le camere e tutte le notti prenotate tornano disponibili per un nuovo ospite.</p><p className="mt-3 text-sm">Nessuna pulizia aggiunta per questo soggiorno. Restano le pulizie precedenti ancora da fare.</p><p className="mt-3 text-sm font-semibold">Il pagamento non viene registrato ora: lo segnerai quando lo ricevi.</p></>:conto.residuo>0?<div className="mt-5 grid gap-4">
      <label>Importo ricevuto · €<input className="block mt-2 w-full" style={stileCampo} inputMode="decimal" value={importo} onChange={e=>setImporto(e.target.value)} disabled={occupato||pendente}/></label>
      <label>Data del pagamento<input type="date" className="block mt-2 w-full" style={stileCampo} value={data} max={oggi} onChange={e=>setData(e.target.value)} disabled={occupato||pendente}/></label>
      <label>Metodo<select className="block mt-2 w-full" style={stileCampo} value={metodo} onChange={e=>setMetodo(e.target.value)} disabled={occupato||pendente}><option value="contanti">Contanti</option><option value="bonifico">Bonifico</option></select></label>
    </div>:<p className="mt-4">Il conto è saldato.</p>}
    {errore&&<p role="alert" className="text-sm text-red-800 mt-4">{errore}</p>}
    <div className="flex flex-wrap gap-3 justify-end mt-6"><button type="button" className="ed-pillola-contorno" disabled={occupato} onClick={onChiudi}>Chiudi</button>{(pendente || !gia || conto.residuo>0) && <button type="button" className="ed-pillola" disabled={occupato||!pronto} onClick={()=>void salva()}>{occupato?'Verifico…':pendente?'Verifica salvataggio':gia?'Registra pagamento ricevuto':'Conferma mancato arrivo'}</button>}</div>
  </Foglio>
}
