'use client'
// Pannello dei filtri (3.1 → 3.2A): foglio dal basso accessibile con azione
// finale FISSA in fondo (comodo anche con tutte le categorie reali). Le
// OPZIONI arrivano dai dati della vista; le sezioni dipendono dall'ambito:
// "Di chi" solo Casa Mia, "Camera" solo Casa Ania. Il periodo usa id stabili
// (Agosto 2026 ≠ Agosto 2025) e il Dal–al ha le due date. Accento: verde
// Casa Mia, terracotta Casa Ania.
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import { STATI_FILTRO, type Contesto, type FiltriSpese, type OpzioniFiltri } from '@/lib/spese/vista'

function Sezione({ nome, voci, valore, scegli, colore }: {
  nome: string; voci: [string, string][]; valore: string; scegli: (v: string) => void; colore: string
}) {
  if (voci.length <= 1) return null
  return (
    <div className="mb-4">
      <Etichetta>{nome}</Etichetta>
      <div className="flex gap-1.5 flex-wrap">
        {voci.map(([id, nomeVoce]) => (
          <Chip key={id} attivo={valore === id} colore={colore} onClick={() => scegli(id)}>{nomeVoce}</Chip>
        ))}
      </div>
    </div>
  )
}

const semplici = (voci: string[]): [string, string][] => voci.map(v => [v, v])

export function FiltriPanel({ contesto, opzioni, filtri, iniziali, setFiltri, risultati, chiudi }: {
  contesto: Contesto
  opzioni: OpzioniFiltri
  filtri: FiltriSpese
  iniziali: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  risultati: number
  chiudi: () => void
}) {
  const accento = contesto === 'ania' ? t.terracotta : t.verde
  const su = (k: keyof FiltriSpese) => (v: string) => setFiltri({ ...filtri, [k]: v })
  const periodoScelto = opzioni.periodi.find(p => p.id === filtri.periodo)

  return (
    <Foglio aria="Filtri" chiudi={chiudi} scorrevole
      piede={
        <button onClick={chiudi} className="w-full min-h-12 text-[15px] font-bold text-white"
          style={{ background: accento, borderRadius: t.rPill }}>
          {risultati === 0 ? 'Nessun movimento — chiudi' : risultati === 1 ? 'Mostra 1 movimento' : `Mostra ${risultati} movimenti`}
        </button>
      }>
      <div className="flex items-center justify-between mb-4">
        <p className={`${DISPLAY} text-[19px]`} style={{ color: t.inchiostro }}>
          Filtri <span className="font-semibold text-[13px]" style={{ color: t.sub }}>
            · {contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'}</span>
        </p>
        <button onClick={() => setFiltri(iniziali)}
          className="text-[13px] font-bold min-h-11 px-2" style={{ color: t.terracotta }}>Azzera</button>
      </div>

      <Sezione nome="Periodo" colore={accento} valore={filtri.periodo} scegli={su('periodo')}
        voci={opzioni.periodi.map(p => [p.id, p.etichetta])} />
      {periodoScelto?.tipo === 'intervallo' && (
        <div className="mb-4 flex gap-2 items-center">
          {([['dal', 'Dal'], ['al', 'Al']] as const).map(([campo, nome]) => (
            <label key={campo} className="flex-1 flex items-center gap-2 min-h-11 px-3 text-[13px]"
              style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.sub }}>
              {nome}
              <input type="date" value={filtri[campo]} onChange={e => setFiltri({ ...filtri, [campo]: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-[14px] outline-none" style={{ color: t.inchiostro }} />
            </label>
          ))}
        </div>
      )}
      {contesto === 'mia' && opzioni.persone && (
        <Sezione nome="Di chi" colore={accento} valore={filtri.persona} scegli={su('persona')}
          voci={semplici(['Tutti', ...opzioni.persone])} />
      )}
      {contesto === 'ania' && opzioni.camere && (
        <Sezione nome="Camera" colore={accento} valore={filtri.camera} scegli={su('camera')}
          voci={semplici(['Tutte', ...opzioni.camere])} />
      )}
      <Sezione nome="Categoria" colore={accento} valore={filtri.categoria} scegli={su('categoria')}
        voci={semplici(['Tutte', ...opzioni.categorie])} />
      <Sezione nome="Pagamento" colore={accento} valore={filtri.metodo} scegli={su('metodo')}
        voci={semplici(['Tutti', ...opzioni.metodi])} />
      <Sezione nome="Stato documento" colore={accento} valore={filtri.stato} scegli={su('stato')}
        voci={semplici(['Tutti', ...Object.keys(STATI_FILTRO)])} />

      <div className="mb-4">
        <Etichetta>Documenti misti</Etichetta>
        <Chip attivo={filtri.soloMisti} colore={accento}
          aria="Mostra solo i documenti divisi tra Casa Mia e Casa Ania"
          onClick={() => setFiltri({ ...filtri, soloMisti: !filtri.soloMisti })}>
          Solo documenti misti
        </Chip>
      </div>
    </Foglio>
  )
}
