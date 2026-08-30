'use client'
// ============================================================================
// CARICAMENTO FOTO/DOCUMENTI (3.2B.1) — parità col vecchio flusso:
// selezione MULTIPLA, anteprime, nota condivisa, conferma ESPLICITA col
// bottone Salva. Gli errori tengono le foto non salvate in lista e un nuovo
// tentativo RIUSA file e documento già creati (mai duplicati). Il tipo del
// documento deriva dal FILE (pdf → "altro"), non dai formati consentiti.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { X, Plus, TriangleAlert, CircleCheck, FileText } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Etichetta, Foglio } from './mattoni'
import {
  creaGuardiaInvio, sha256DiFile,
  type ClienteScrittura, type EsitoCaricamento, type RipresaCaricamento,
} from '@/lib/spese/scrittura'
import { caricaDocumentoConFoto } from '@/lib/spese/scrittura'
import type { Ambito } from '@/lib/spese/types'

type InCoda = {
  file: File
  url: string
  stato: 'in_attesa' | 'salvata' | 'errore'
  errore?: string
  riprovabile?: boolean
  ripresa: RipresaCaricamento     // file/documento già creati: si riusano
}

export function CaricaFotoSheet({ ambito, cliente, inizialiFile, apriAltri, alSalvataggio, chiudi }: {
  ambito: Ambito
  cliente: ClienteScrittura
  inizialiFile: File[]
  apriAltri: () => Promise<File[]>     // riapre il selettore (fotocamera/libreria/file)
  alSalvataggio: () => void            // ricarica i dati della pagina
  chiudi: () => void
}) {
  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const [coda, setCoda] = useState<InCoda[]>(() => inizialiFile.map(f => ({
    file: f, url: URL.createObjectURL(f), stato: 'in_attesa', ripresa: {},
  })))
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const guardia = useRef(creaGuardiaInvio())

  useEffect(() => () => { coda.forEach(c => URL.revokeObjectURL(c.url)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const togli = (i: number) => setCoda(prev => {
    URL.revokeObjectURL(prev[i].url)
    return prev.filter((_, idx) => idx !== i)
  })

  const salvaTutte = () => guardia.current(async () => {
    setSalvando(true)
    let salvateOra = 0
    const notaPulita = nota.trim() || null
    const aggiornata = [...coda]
    for (let i = 0; i < aggiornata.length; i++) {
      const c = aggiornata[i]
      if (c.stato === 'salvata') continue
      const esito: EsitoCaricamento = await caricaDocumentoConFoto(cliente, {
        nomeFile: c.file.name, tipo: c.file.type, contenuto: c.file,
        sha256: await sha256DiFile(c.file),
      }, ambito, notaPulita, c.ripresa)
      if (esito.ok) { aggiornata[i] = { ...c, stato: 'salvata', errore: undefined }; salvateOra++ }
      else aggiornata[i] = { ...c, stato: 'errore', errore: esito.errore, riprovabile: esito.riprovabile, ripresa: esito.ripresa }
      setCoda([...aggiornata])
    }
    setSalvando(false)
    if (salvateOra > 0) alSalvataggio()
    if (aggiornata.every(c => c.stato === 'salvata')) setTimeout(chiudi, 900)
  })

  const rimaste = coda.filter(c => c.stato !== 'salvata').length

  return (
    <Foglio aria="Carica foto e documenti" chiudi={chiudi} scorrevole
      piede={
        <button onClick={salvaTutte} disabled={salvando || rimaste === 0}
          className="w-full min-h-12 text-[15px] font-bold text-white disabled:opacity-60"
          style={{ background: rimaste === 0 ? t.verde : accento, borderRadius: t.rPill }}>
          {salvando ? 'Salvo…' : rimaste === 0 ? '✓ Tutte salvate' : rimaste === 1 ? 'Salva 1 foto' : `Salva ${rimaste} foto`}
        </button>
      }>
      <p className={`${DISPLAY} text-[19px] mb-1`} style={{ color: t.inchiostro }}>
        Carica {ambito === 'azienda' ? 'per Casa Ania' : 'per Casa Mia'}
      </p>
      <p className="text-[12px] mb-3" style={{ color: t.sub }}>
        le foto vanno in archivio come documenti da leggere: NESSUNA spesa viene creata ora
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {coda.map((c, i) => (
          <div key={c.url} className="relative">
            {c.file.type === 'application/pdf' ? (
              <div className="w-full aspect-square grid place-items-center"
                style={{ background: t.velo, borderRadius: t.r, border: t.bordoCarta }}>
                <FileText size={26} style={{ color: t.sub }} />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- anteprima locale
              <img src={c.url} alt={c.file.name} className="w-full aspect-square object-cover"
                style={{ borderRadius: t.r, border: t.bordoCarta, opacity: c.stato === 'salvata' ? 0.55 : 1 }} />
            )}
            {c.stato === 'salvata' && (
              <span className="absolute top-1 left-1 grid place-items-center w-6 h-6"
                style={{ background: t.verde, color: '#fff', borderRadius: 99 }}><CircleCheck size={14} /></span>
            )}
            {c.stato === 'errore' && (
              <span className="absolute top-1 left-1 grid place-items-center w-6 h-6"
                style={{ background: t.rosso, color: '#fff', borderRadius: 99 }}><TriangleAlert size={14} /></span>
            )}
            {c.stato !== 'salvata' && (
              <button onClick={() => togli(i)} aria-label={`Togli ${c.file.name}`}
                className="absolute top-1 right-1 grid place-items-center w-6 h-6"
                style={{ background: 'rgba(20,25,20,.65)', color: '#fff', borderRadius: 99 }}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <button onClick={async () => {
          const altri = await apriAltri()
          setCoda(prev => [...prev, ...altri.map(f => ({
            file: f, url: URL.createObjectURL(f), stato: 'in_attesa' as const, ripresa: {},
          }))])
        }} aria-label="Aggiungi altre foto"
          className="w-full aspect-square grid place-items-center"
          style={{ background: t.velo, borderRadius: t.r, border: `1.5px dashed ${t.bordo}`, color: t.sub }}>
          <Plus size={22} />
        </button>
      </div>

      {coda.filter(c => c.stato === 'errore').map((c, i) => (
        <p key={i} className="text-[12.5px] mb-1.5 font-semibold" role="alert" style={{ color: t.rosso }}>
          {c.file.name}: {c.errore}
        </p>
      ))}

      <div className="mb-4">
        <Etichetta>Nota per la lettura (facoltativa)</Etichetta>
        <input value={nota} onChange={e => setNota(e.target.value)}
          placeholder="es. metà è di Casa Ania, guarda il retro…"
          className="w-full min-h-11 px-3 text-[14px] outline-none"
          style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
      </div>
    </Foglio>
  )
}
