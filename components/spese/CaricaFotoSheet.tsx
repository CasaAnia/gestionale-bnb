'use client'
// ============================================================================
// CARICAMENTO FOTO/DOCUMENTI (Fase 4 · blocco 2) — vista sottile sulla coda
// di pagina (lib/spese/codaPagina) che usa il flusso IDEMPOTENTE collaudato
// (ripresaDurevole + registrazioneSupabase): nessun secondo percorso.
// Parità: selezione multipla, anteprime, nota, conferma esplicita. Le
// operazioni PENDENTI (anche di ricaricamenti precedenti) sono voci a tutti
// gli effetti, con ambito/token/manifesto ORIGINALI, e stati distinti:
// da ritentare · da verificare · file da riselezionare · pulizia pendente.
// ============================================================================
import { X, Plus, TriangleAlert, CircleCheck, CopyX, RefreshCw, FileQuestion, Eraser, FileText } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Etichetta, Foglio } from './mattoni'
import { inviabilePagina, rimovibilePagina, type VocePagina } from '@/lib/spese/codaPagina'
import type { Ambito } from '@/lib/spese/types'

export type VoceUI = VocePagina & { url?: string }

const BOLLINI: Partial<Record<VocePagina['stato'], { sfondo: string; Icona: typeof CircleCheck; titolo: string }>> = {
  salvata: { sfondo: t.verde, Icona: CircleCheck, titolo: 'salvata' },
  da_ritentare: { sfondo: t.rosso, Icona: TriangleAlert, titolo: 'da ritentare' },
  da_verificare: { sfondo: t.rosso, Icona: FileQuestion, titolo: 'da verificare' },
  da_riselezionare: { sfondo: t.sub, Icona: FileQuestion, titolo: 'serve il file' },
  pulizia_pendente: { sfondo: t.sub, Icona: Eraser, titolo: 'pulizia in sospeso' },
  duplicato: { sfondo: t.sub, Icona: CopyX, titolo: 'già in archivio' },
}
// spiegazioni FEDELI alle azioni davvero disponibili per QUELLA voce:
// mai promettere «Salva riprova» a una voce che Salva non toccherà
function spiega(v: VocePagina): string {
  if (!inviabilePagina(v)) {
    if (v.stato === 'da_riselezionare') return ' — riseleziona il file originale col bottoncino ↺'
    if (v.stato === 'da_verificare' || v.stato === 'da_ritentare')
      return ' — NON ritentabile da qui: segnalala'
    return ''
  }
  if (v.stato === 'da_ritentare') return ' — verrà RITENTATA col bottone Salva'
  if (v.stato === 'da_verificare') return ' — esito da VERIFICARE: Salva controlla e recupera senza doppioni'
  if (v.stato === 'da_riselezionare') return ' — file pronto: Salva lo ricontrolla e completa'
  if (v.stato === 'pulizia_pendente') return ' — doppione accertato, copia da togliere: Salva completa la pulizia'
  return ''
}

export function CaricaFotoSheet({ ambito, coda, salvando, nota, setNota, depositoErrore, togli, riseleziona, aggiungiAltri, salvaTutte, chiudi }: {
  ambito: Ambito
  coda: VoceUI[]
  salvando: boolean
  nota: string
  setNota: (v: string) => void
  depositoErrore?: string | null
  togli: (id: string) => void
  riseleziona: (id: string) => void
  aggiungiAltri: () => void
  salvaTutte: () => void
  chiudi: () => void
}) {
  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const pronte = coda.filter(inviabilePagina).length
  const tutteSalvate = coda.length > 0 && coda.every(c => c.stato === 'salvata')

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
      {depositoErrore && (
        <p className="text-[12.5px] mb-2 px-3 py-2 font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>
          promemoria dei caricamenti illeggibile ({depositoErrore}): i nuovi caricamenti sono bloccati finché non si risolve
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {coda.map(c => {
          const bollino = BOLLINI[c.stato]
          return (
            <div key={c.id} className="relative">
              {c.url && c.tipo !== 'application/pdf' ? (
                // eslint-disable-next-line @next/next/no-img-element -- anteprima locale
                <img src={c.url} alt={c.nome} className="w-full aspect-square object-cover"
                  style={{ borderRadius: t.r, border: t.bordoCarta, opacity: c.stato === 'salvata' ? 0.55 : 1 }} />
              ) : (
                // pendente di un giro precedente (niente anteprima) o PDF
                <div className="w-full aspect-square grid place-items-center px-1"
                  style={{ background: t.velo, borderRadius: t.r, border: t.bordoCarta }}>
                  <FileText size={22} style={{ color: t.sub }} />
                  <span className="text-[9.5px] text-center leading-tight break-all" style={{ color: t.sub }}>{c.nome}</span>
                </div>
              )}
              {bollino && (
                <span title={bollino.titolo} className="absolute top-1 left-1 grid place-items-center w-6 h-6"
                  style={{ background: bollino.sfondo, color: '#fff', borderRadius: 99 }}><bollino.Icona size={14} /></span>
              )}
              {c.ambito !== ambito && (
                <span className="absolute bottom-1 left-1 px-1.5 text-[9.5px] font-bold text-white"
                  style={{ background: c.ambito === 'azienda' ? t.terracotta : t.verde, borderRadius: 99 }}>
                  {c.ambito === 'azienda' ? 'Casa Ania' : 'Casa Mia'}
                </span>
              )}
              {c.stato === 'in_invio' && (
                <span className="absolute inset-x-0 bottom-0 text-center text-[10.5px] font-bold text-white py-0.5"
                  style={{ background: 'rgba(20,25,20,.65)', borderRadius: `0 0 ${t.r} ${t.r}` }}>salvo…</span>
              )}
              {c.stato === 'da_riselezionare' && (
                <button onClick={() => riseleziona(c.id)} aria-label={`Riseleziona il file ${c.nome}`}
                  className="absolute top-0 right-0 grid place-items-center w-11 h-11"
                  style={{ color: '#fff', borderRadius: t.r }}>
                  <span className="grid place-items-center w-8 h-8" style={{ background: accento, borderRadius: 99 }}>
                    <RefreshCw size={15} />
                  </span>
                </button>
              )}
              {rimovibilePagina(c) && (
                <button onClick={() => togli(c.id)} aria-label={`Togli ${c.nome}`}
                  className="absolute top-0 right-0 grid place-items-center w-11 h-11"
                  style={{ color: '#fff', borderRadius: t.r }}>
                  <span className="grid place-items-center w-8 h-8" style={{ background: 'rgba(20,25,20,.65)', borderRadius: 99 }}>
                    <X size={15} />
                  </span>
                </button>
              )}
            </div>
          )
        })}
        <button onClick={aggiungiAltri} aria-label="Aggiungi altre foto"
          className="w-full aspect-square grid place-items-center"
          style={{ background: t.velo, borderRadius: t.r, border: `1.5px dashed ${t.bordo}`, color: t.sub }}>
          <Plus size={22} />
        </button>
      </div>

      {coda.filter(c => c.errore || c.avviso).map(c => (
        <p key={c.id} className="text-[12.5px] mb-1.5 font-semibold" role="alert"
          style={{ color: c.stato === 'da_ritentare' || c.stato === 'da_verificare' ? t.rosso : t.sub }}>
          {c.nome}: {c.errore}{spiega(c)}
          {c.avviso ? ` · ${c.avviso}` : ''}
        </p>
      ))}

      <div className="mb-4">
        <Etichetta>Nota per la lettura (facoltativa)</Etichetta>
        <input value={nota} onChange={e => setNota(e.target.value)}
          placeholder="es. metà è di Casa Ania, guarda il retro…"
          className="w-full min-h-11 px-3 text-[14px] outline-none"
          style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
        <p className="text-[11px] mt-1" style={{ color: t.sub }}>
          vale per le foto nuove; le operazioni riprese conservano la loro nota originale
        </p>
      </div>
    </Foglio>
  )
}
