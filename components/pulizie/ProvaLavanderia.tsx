'use client'
// «PROVA LAVANDERIA · AL MESE» (riferimento approvato da Ania il 01/10/2026):
// per ogni pezzo i pezzi al mese veri (Mandati a lavare), il prezzo scritto da
// Ania e il costo; sotto «Al mese, circa» e «Sul periodo scelto». I prezzi
// restano nella tabella della proposta 0064 (lib/prezziLavanderiaCore); un
// campo vuoto è «da inserire», mai zero, e il totale lo dice («totale
// parziale», con i pezzi che mancano). Nessun prezzo d'esempio.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { leggiPrezzi, salvaPrezzo, prezzoScritto, PREZZI_NON_SALVATI, type ClientPrezzi } from '@/lib/prezziLavanderiaCore'
import { provaLavanderia, euro, PEZZI_LAVANDERIA, type PezzoLavanderia } from '@/lib/statistichePulizieNuove'

const PEZZI_NOMI = PEZZI_LAVANDERIA.map(([k, n]) => [k, n] as const)

const client: ClientPrezzi = {
  leggi: () => supabase.from('prezzi_lavanderia').select('pezzo, prezzo'),
  scrivi: (pezzo, prezzo) => supabase.from('prezzi_lavanderia').upsert({ pezzo, prezzo, aggiornato_at: new Date().toISOString() }, { onConflict: 'pezzo' }).select('pezzo, prezzo'),
  togli: pezzo => supabase.from('prezzi_lavanderia').delete().eq('pezzo', pezzo),
}
const scritto = (n: number | undefined) => (n === undefined ? '' : euro(n))

export default function ProvaLavanderia({ mandati, giorni }: { mandati: { pezzo: PezzoLavanderia; nome: string; aLavare: number; alMese: number }[]; giorni: number }) {
  const [stato, setStato] = useState<'caricamento' | 'si' | 'no' | 'errore'>('caricamento')
  const [prezzi, setPrezzi] = useState<Partial<Record<PezzoLavanderia, number>>>({})
  const [campi, setCampi] = useState<Partial<Record<PezzoLavanderia, string>>>({})
  const [errore, setErrore] = useState('')
  // Esito per pezzo (rilievo di Codex, 01/10/2026): un prezzo scritto ma non
  // confermato dalla rilettura NON si mostra come salvato.
  const [esiti, setEsiti] = useState<Partial<Record<PezzoLavanderia, { stato: 'salvo' | 'incerto' | 'non_salvato'; messaggio: string | null }>>>({})
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let viva = true
    void leggiPrezzi(client).then(l => {
      if (!viva) return
      setStato(l.stato)
      if (l.stato === 'si') { setPrezzi(l.prezzi); setCampi(Object.fromEntries(Object.entries(l.prezzi).map(([k, v]) => [k, scritto(v)]))) }
    })
    return () => { viva = false }
  }, [giro])
  async function cambia(pezzo: PezzoLavanderia) {
    const v = prezzoScritto(campi[pezzo] ?? '')
    if (Number.isNaN(v)) { setErrore('Scrivi il prezzo in euro, per esempio 1,90.'); return }
    setErrore('')
    const nuovi = { ...prezzi }
    if (v === null) delete nuovi[pezzo]; else nuovi[pezzo] = v
    setPrezzi(nuovi)
    setCampi(c => ({ ...c, [pezzo]: v === null ? '' : euro(v) }))
    if (stato !== 'si') return
    setEsiti(x => ({ ...x, [pezzo]: { stato: 'salvo', messaggio: null } }))
    const e = await salvaPrezzo(client, pezzo, v)
    setEsiti(x => { const y = { ...x }; if (e.stato === 'salvato') delete y[pezzo]; else y[pezzo] = { stato: e.stato, messaggio: e.messaggio }; return y })
  }
  const nonConfermati = PEZZI_NOMI.filter(([k]) => esiti[k] && esiti[k]!.stato !== 'salvo').map(([, n]) => n)
  const p = provaLavanderia(mandati, prezzi)
  return <div data-prova-lavanderia>
    <p className="pul-sez">Prova lavanderia · al mese</p>
    <div className="pul-pz h"><span>Pezzo</span><span>Al mese</span><span>Prezzo</span><span>Costo</span></div>
    {p.righe.map(r => <div key={r.pezzo} className="pul-pz" data-lavanderia={r.pezzo}>
      <span>{r.nome}</span><span>{Math.round(r.alMese)}</span>
      <span><input type="text" inputMode="decimal" placeholder="da inserire" className={esiti[r.pezzo] ? `da-confermare ${esiti[r.pezzo]!.stato}` : ''} aria-label={`Prezzo ${r.nome}, euro a pezzo`} value={campi[r.pezzo] ?? ''}
        onChange={e => setCampi(c => ({ ...c, [r.pezzo]: e.target.value }))} onBlur={() => void cambia(r.pezzo)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} /></span>
      <span>{r.costoMese === null ? '—' : <b>{euro(r.costoMese)}</b>}</span>
      {esiti[r.pezzo] && <span className={`nota-riga ${esiti[r.pezzo]!.stato}`} data-esito-prezzo={esiti[r.pezzo]!.stato}>{esiti[r.pezzo]!.stato === 'salvo' ? 'Salvo…' : esiti[r.pezzo]!.messaggio}</span>}
    </div>)}
    <div className="pul-tot"><span>{p.parziale ? 'Al mese, circa · totale parziale' : 'Al mese, circa'}</span><b data-totale-lavanderia>{euro(p.alMese, 0)} €</b></div>
    <p className="pul-chi">Sul periodo scelto ({giorni} {giorni === 1 ? 'giorno' : 'giorni'}): {euro(p.periodo, 0)} €.{p.parziale ? ` Mancano i prezzi di: ${p.mancanti.join(', ')}.` : ''} Prezzi a pezzo, scritti da te.</p>
    {nonConfermati.length > 0 && <p className="pul-nota" data-prezzi-da-confermare>Nel conto ci sono anche prezzi scritti ma non confermati: {nonConfermati.join(', ')}.</p>}
    {stato === 'no' && <p className="pul-nota" data-prezzi-non-salvati>{PREZZI_NON_SALVATI}.</p>}
    {stato === 'errore' && <p role="status" className="pul-errore">Non riesco a leggere i prezzi salvati. <button type="button" className="pul-az tn" onClick={() => setGiro(x => x + 1)}>Riprova</button></p>}
    {errore && <p role="alert" className="pul-errore">{errore}</p>}
  </div>
}
