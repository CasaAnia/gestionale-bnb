'use client'
// ============================================================================
// CARICAMENTO FOTO/DOCUMENTI (3.2B.2) — vista SOTTILE sulla coda tenuta
// dalla PAGINA (lib/spese/codaCaricamento.ts): chiudere il foglio non perde
// lo stato di recupero, e il ciclo di invio continua a lavorare sullo stato
// vivo. Parità col vecchio flusso: selezione multipla, anteprime, nota,
// conferma esplicita. Sospese e doppioni restano FUORI dai ritentativi.
// ============================================================================
import { X, Plus, TriangleAlert, CircleCheck, CopyX, PauseCircle, FileText } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Etichetta, Foglio } from './mattoni'
import { daInviare, rimovibile, type VoceCoda } from '@/lib/spese/codaCaricamento'
import type { Ambito } from '@/lib/spese/types'

export type VoceUI = VoceCoda<File> & { url: string }

export function CaricaFotoSheet({ ambito, coda, salvando, nota, setNota, togli, aggiungiAltri, salvaTutte, chiudi }: {
  ambito: Ambito
  coda: VoceUI[]
  salvando: boolean
  nota: string
  setNota: (v: string) => void
  togli: (id: string) => void
  aggiungiAltri: () => void
  salvaTutte: () => void
  chiudi: () => void
}) {
  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const pronte = daInviare(coda).length
  const tutteSalvate = coda.length > 0 && coda.every(c => c.stato === 'salvata')
  const bollino = (sfondo: string, Icona: typeof CircleCheck) => (
    <span className="absolute top-1 left-1 grid place-items-center w-6 h-6"
      style={{ background: sfondo, color: '#fff', borderRadius: 99 }}><Icona size={14} /></span>
  )

  return (
    <Foglio aria="Carica foto e documenti" chiudi={chiudi} scorrevole
      piede={
        <button onClick={salvaTutte} disabled={salvando || pronte === 0}
          className="w-full min-h-12 text-[15px] font-bold text-white disabled:opacity-60"
          style={{ background: pronte === 0 ? t.verde : accento, borderRadius: t.rPill }}>
          {salvando ? 'Salvo…'
            : tutteSalvate ? '✓ Tutte salvate'
            : pronte === 0 ? 'Niente da salvare'
            : pronte === 1 ? 'Salva 1 foto' : `Salva ${pronte} foto`}
        </button>
      }>
      <p className={`${DISPLAY} text-[19px] mb-1`} style={{ color: t.inchiostro }}>
        Carica {ambito === 'azienda' ? 'per Casa Ania' : 'per Casa Mia'}
      </p>
      <p className="text-[12px] mb-3" style={{ color: t.sub }}>
        le foto vanno in archivio come documenti da leggere: NESSUNA spesa viene creata ora
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {coda.map(c => (
          <div key={c.id} className="relative">
            {c.tipo === 'application/pdf' ? (
              <div className="w-full aspect-square grid place-items-center"
                style={{ background: t.velo, borderRadius: t.r, border: t.bordoCarta }}>
                <FileText size={26} style={{ color: t.sub }} />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- anteprima locale
              <img src={c.url} alt={c.nome} className="w-full aspect-square object-cover"
                style={{ borderRadius: t.r, border: t.bordoCarta, opacity: c.stato === 'salvata' ? 0.55 : 1 }} />
            )}
            {c.stato === 'salvata' && bollino(t.verde, CircleCheck)}
            {c.stato === 'errore' && bollino(t.rosso, TriangleAlert)}
            {c.stato === 'duplicato' && bollino(t.sub, CopyX)}
            {c.stato === 'sospesa' && bollino(t.sub, PauseCircle)}
            {c.stato === 'in_invio' && (
              <span className="absolute inset-x-0 bottom-0 text-center text-[10.5px] font-bold text-white py-0.5"
                style={{ background: 'rgba(20,25,20,.65)', borderRadius: `0 0 ${t.r} ${t.r}` }}>salvo…</span>
            )}
            {rimovibile(c) && (
              <button onClick={() => togli(c.id)} aria-label={`Togli ${c.nome}`}
                className="absolute top-1 right-1 grid place-items-center w-6 h-6"
                style={{ background: 'rgba(20,25,20,.65)', color: '#fff', borderRadius: 99 }}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        <button onClick={aggiungiAltri} aria-label="Aggiungi altre foto"
          className="w-full aspect-square grid place-items-center"
          style={{ background: t.velo, borderRadius: t.r, border: `1.5px dashed ${t.bordo}`, color: t.sub }}>
          <Plus size={22} />
        </button>
      </div>

      {coda.filter(c => c.errore).map(c => (
        <p key={c.id} className="text-[12.5px] mb-1.5 font-semibold" role="alert"
          style={{ color: c.stato === 'errore' ? t.rosso : t.sub }}>
          {c.nome}: {c.errore}
          {c.stato === 'errore' && c.riprovabile && ' — verrà ritentata col bottone Salva'}
        </p>
      ))}

      <div className="mb-4">
        <Etichetta>Nota per la lettura (facoltativa)</Etichetta>
        <input value={nota} onChange={e => setNota(e.target.value)}
          placeholder="es. metà è di Casa Ania, guarda il retro…"
          className="w-full min-h-11 px-3 text-[14px] outline-none"
          style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
        <p className="text-[11px] mt-1" style={{ color: t.sub }}>
          la nota di una foto resta quella del suo PRIMO tentativo di salvataggio
        </p>
      </div>
    </Foglio>
  )
}
