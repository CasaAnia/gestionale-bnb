'use client'
import { useEffect, useRef, useState } from 'react'
import {
  ZOOM_MIN, limitaScala, limitaSpostamento, distanzaDita, scalaDopoDoppioTocco, scalaDopoPasso,
} from '@/lib/zoomImmagine'

// Documento a schermo intero, ingrandibile (21/09/2026, richiesta di Ania:
// leggere bene la provenienza sulla carta d'identità). Il telefono ha lo zoom
// bloccato dal viewport e nella PWA le due dita non fanno nulla, quindi
// l'ingrandimento lo fa il visore: due dita, doppio tocco, tasti + e −, e la
// rotella col Mac. Quando è ingrandita l'immagine si trascina con un dito.
export default function VisoreDocumento({ url, etichetta, onChiudi }: {
  url: string
  etichetta: string
  onChiudi: () => void
}) {
  const pdf = url.includes('.pdf')
  const [scala, setScala] = useState(ZOOM_MIN)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const areaRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const scalaRef = useRef(ZOOM_MIN)
  const posRef = useRef({ x: 0, y: 0 })
  const chiudiRef = useRef(onChiudi)
  useEffect(() => { chiudiRef.current = onChiudi })

  function misure() {
    const el = imgRef.current
    return { larghezza: el?.offsetWidth || 0, altezza: el?.offsetHeight || 0 }
  }

  function applica(nuovaScala: number, nuovaPos: { x: number; y: number }) {
    const { larghezza, altezza } = misure()
    const s = limitaScala(nuovaScala)
    const p = s <= ZOOM_MIN + 0.001 ? { x: 0, y: 0 } : limitaSpostamento(nuovaPos.x, nuovaPos.y, s, larghezza, altezza)
    scalaRef.current = s
    posRef.current = p
    setScala(s)
    setPos(p)
  }

  function passo(verso: 1 | -1) {
    applica(scalaDopoPasso(scalaRef.current, verso), posRef.current)
  }

  // Gesti con i puntatori (dita sul telefono e mouse sul Mac), registrati a
  // mano e non passivi: React li registrerebbe passivi e la pagina
  // scorrerebbe sotto le dita invece di ingrandire.
  useEffect(() => {
    const area = areaRef.current
    if (!area || pdf) return
    const dita = new Map<number, { x: number; y: number }>()
    const gesto = {
      tipo: null as null | 'pinch' | 'pan',
      distIniziale: 0,
      scalaIniziale: ZOOM_MIN,
      partenza: { x: 0, y: 0 },
      posIniziale: { x: 0, y: 0 },
      mosso: false,
      ultimoTocco: 0,
    }

    function iniziaGesto() {
      const punti = [...dita.values()]
      gesto.scalaIniziale = scalaRef.current
      gesto.posIniziale = { ...posRef.current }
      if (punti.length >= 2) {
        gesto.tipo = 'pinch'
        gesto.distIniziale = distanzaDita(punti[0], punti[1])
      } else if (punti.length === 1) {
        gesto.tipo = scalaRef.current > ZOOM_MIN + 0.01 ? 'pan' : null
        gesto.partenza = punti[0]
      } else {
        gesto.tipo = null
      }
    }

    function sullImmagine(e: PointerEvent): boolean {
      const r = imgRef.current?.getBoundingClientRect()
      return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    }

    function onDown(e: PointerEvent) {
      dita.set(e.pointerId, { x: e.clientX, y: e.clientY })
      gesto.mosso = false
      iniziaGesto()
      if (dita.size === 1 && gesto.tipo === 'pan') area!.setPointerCapture(e.pointerId)
    }

    function onMove(e: PointerEvent) {
      if (!dita.has(e.pointerId)) return
      e.preventDefault()
      dita.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const punti = [...dita.values()]
      if (gesto.tipo === 'pinch' && punti.length >= 2) {
        gesto.mosso = true
        const dist = distanzaDita(punti[0], punti[1])
        if (gesto.distIniziale > 0) applica(gesto.scalaIniziale * (dist / gesto.distIniziale), gesto.posIniziale)
      } else if (gesto.tipo === 'pan' && punti.length === 1) {
        const dx = punti[0].x - gesto.partenza.x
        const dy = punti[0].y - gesto.partenza.y
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) gesto.mosso = true
        applica(scalaRef.current, { x: gesto.posIniziale.x + dx, y: gesto.posIniziale.y + dy })
      }
    }

    function onUp(e: PointerEvent) {
      if (!dita.delete(e.pointerId)) return
      if (dita.size === 0) {
        const adesso = Date.now()
        if (!gesto.mosso) {
          if (!sullImmagine(e)) {
            chiudiRef.current()          // un tocco sullo sfondo chiude, come prima
          } else if (adesso - gesto.ultimoTocco < 320) {
            // doppio tocco (o doppio clic) sull'immagine: ingrandisce, e poi torna intera
            applica(scalaDopoDoppioTocco(scalaRef.current), { x: 0, y: 0 })
            gesto.ultimoTocco = 0
          } else {
            gesto.ultimoTocco = adesso
          }
        }
        gesto.tipo = null
      } else {
        iniziaGesto()
      }
    }

    // Rotella del Mac (e pinch del trackpad, che arriva come wheel con ctrlKey)
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      applica(scalaRef.current * (e.deltaY < 0 ? 1.12 : 1 / 1.12), posRef.current)
    }

    area.addEventListener('pointerdown', onDown)
    area.addEventListener('pointermove', onMove, { passive: false })
    area.addEventListener('pointerup', onUp)
    area.addEventListener('pointercancel', onUp)
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      area.removeEventListener('pointerdown', onDown)
      area.removeEventListener('pointermove', onMove)
      area.removeEventListener('pointerup', onUp)
      area.removeEventListener('pointercancel', onUp)
      area.removeEventListener('wheel', onWheel)
    }
  }, [pdf, url])

  // Con la tastiera del Mac: Esc chiude, + e − ingrandiscono e rimpiccioliscono
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onChiudi()
      else if (e.key === '+' || e.key === '=') passo(1)
      else if (e.key === '-' || e.key === '_') passo(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const ingrandita = scala > ZOOM_MIN + 0.01

  return (
    <div className="fixed inset-0 z-[70] bg-green-dark/90 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      {/* il velo chiude: il tocco sull'immagine ora serve a ingrandire */}
      <div className="absolute inset-0" onClick={onChiudi} aria-hidden="true" />

      {pdf ? (
        <iframe src={url} title="Documento" className="relative w-full h-full bg-white rounded-lg" />
      ) : (
        <div ref={areaRef} className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ touchAction: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt={etichetta}
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scala})`,
              transition: 'transform 90ms linear',
              cursor: ingrandita ? 'grab' : 'zoom-in',
            }}
          />
        </div>
      )}

      <button type="button" onClick={onChiudi} aria-label="Chiudi" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-green-dark font-bold">✕</button>

      {!pdf && (
        <div className="absolute left-0 right-0 bottom-4 flex flex-col items-center gap-1.5 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button type="button" onClick={() => passo(-1)} aria-label="Rimpicciolisci"
              className="w-11 h-11 rounded-full bg-white text-green-dark text-xl font-bold shadow-md disabled:opacity-40" disabled={!ingrandita}>−</button>
            {ingrandita && (
              <button type="button" onClick={() => applica(ZOOM_MIN, { x: 0, y: 0 })}
                className="h-11 px-4 rounded-full bg-white text-green-dark text-sm font-semibold shadow-md">Intera</button>
            )}
            <button type="button" onClick={() => passo(1)} aria-label="Ingrandisci"
              className="w-11 h-11 rounded-full bg-white text-green-dark text-xl font-bold shadow-md">+</button>
          </div>
          <p className="text-[11px] text-cream-text/80">
            {ingrandita ? 'Trascina con un dito per spostarti' : 'Due dita o doppio tocco per ingrandire'}
          </p>
        </div>
      )}
    </div>
  )
}
