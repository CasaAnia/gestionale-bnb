'use client'
// Il grafico della giornata in cima alla linguetta «Oggi» (riferimento
// approvato da Ania il 01/10/2026, pulizie-riferimento.html, telefono 1).
// Cosa disegnare lo decide lib/giornataPulizie; qui solo la veste.
import { useEffect, useState } from 'react'
import { ORE_RIGHELLO, FILI, INIZIO, FINE, posizione, oraTesto, type RigaGiornata, type Segmento, type Segno } from '@/lib/giornataPulizie'

const sx = (min: number) => `${posizione(min)}%`
// Un'etichetta vicino al bordo destro si appoggia a sinistra del suo punto,
// così non esce dal righello.
const ancora = (min: number) => (posizione(min) > 62 ? { right: `${100 - posizione(min)}%` } : { left: sx(min) })

function Blocco({ s }: { s: Segmento }) {
  if (s.tipo === 'resta') return <div className="seg stay" style={{ left: 0, width: '100%' }} data-segmento="resta">{s.testo}</div>
  if (s.tipo === 'fatta') return <div className="seg done" style={s.ora === null ? { left: 0 } : ancora(s.ora)} data-segmento="fatta">{s.testo}</div>
  // il blocco di chi parte resta leggibile anche quando la partenza è prima delle 8
  const larga = Math.max(posizione(s.a) - posizione(s.da), s.tipo === 'parte' ? 9 : 0)
  if (s.tipo === 'parte') return <div className={`seg occ${s.indicativo ? ' ind' : ''}`} style={{ left: sx(s.da), width: `${larga}%` }} data-segmento="parte" data-indicativo={s.indicativo ? 1 : 0}>{s.testo}</div>
  return <div className={`seg win${s.libera ? ' w2' : ''}`} style={{ left: sx(s.da), width: `${larga}%`, textAlign: s.libera ? undefined : 'right' }} data-segmento={s.libera ? 'libera' : 'finestra'}>{s.testo}</div>
}

function Segnale({ s }: { s: Segno }) {
  if (s.tipo === 'bagagli') return <div className="bag" style={{ left: sx(s.ora) }} data-segno="bagagli"><i aria-hidden /><span style={posizione(s.ora) > 62 ? { left: 'auto', right: 11 } : undefined}>{s.testo}</span></div>
  return <div className={`arr${s.indicativo ? ' ind' : ''}${posizione(s.ora) > 72 ? ' sx' : ''}`} style={{ left: sx(s.ora) }} data-t={s.testo} data-segno="arrivo" data-indicativo={s.indicativo ? 1 : 0} />
}

function Adesso() {
  const [min, setMin] = useState<number | null>(null)
  useEffect(() => {
    const leggi = () => { const d = new Date(); setMin(Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(d)) * 60 + Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', minute: '2-digit' }).format(d))) }
    const primo = window.setTimeout(leggi, 0)
    const giro = window.setInterval(leggi, 60000)
    return () => { window.clearTimeout(primo); window.clearInterval(giro) }
  }, [])
  if (min === null || min < INIZIO || min > FINE) return null
  // verso sera la scritta si appoggia a sinistra della linea, così non esce dallo schermo
  return <div className="now" style={{ left: sx(min) }} data-adesso={oraTesto(min)}><span style={posizione(min) > 85 ? { left: 'auto', right: 2 } : undefined}>ORA {oraTesto(min)}</span></div>
}

export default function GraficoGiornata({ righe, spazi }: { righe: RigaGiornata[]; spazi: { ora: number | null; testo: string; attivita: string }[] }) {
  const fili = <>{FILI.map(h => <span key={h} className="g" style={{ left: sx(h * 60) }} />)}</>
  return <div className="tl" data-grafico-giornata>
    <div className="ru"><span /><div className="h">{ORE_RIGHELLO.map(h => <span key={h} style={{ left: sx(h * 60) }}>{h}</span>)}</div></div>
    {righe.map(r => <div key={r.roomId} className="rw" data-riga-grafico={r.nome}>
      <div className="rn">{r.nome}</div>
      <div className="ln">{fili}
        {r.segmenti.map((s, k) => <Blocco key={k} s={s} />)}
        {r.segni.map((s, k) => <Segnale key={`s${k}`} s={s} />)}
        {r.nota && <span className="nota-rg" data-nota-grafico>{r.nota}</span>}
        {r.vuota && <span className="vuota">niente oggi</span>}
      </div>
    </div>)}
    <div className="rw ultima" data-riga-grafico="Spazi comuni">
      <div className="rn sc">Spazi<br />comuni</div>
      <div className="ln">{fili}
        {spazi.map((s, k) => <div key={k} className="seg done mini" style={s.ora === null ? { left: `${k * 7}%` } : ancora(s.ora)} data-segmento="spazio" data-attivita={s.attivita}>{s.testo}</div>)}
      </div>
    </div>
    {/* la linea di adesso attraversa tutte le righe, con «ORA 9:15» in fondo */}
    <div className="tl-ora" aria-hidden><Adesso /></div>
  </div>
}
