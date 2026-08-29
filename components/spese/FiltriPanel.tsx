'use client'
// Pannello dei filtri (3.1, corretto in 3.1.1): foglio dal basso accessibile
// (Escape, focus, scorrimento bloccato). Le OPZIONI arrivano dai dati della
// vista, mai liste rigide; le sezioni dipendono dall'ambito: "Di chi" solo
// Casa Mia, "Camera" solo Casa Ania. L'ambito NON si sceglie qui (c'è il
// selettore in alto): resta solo l'interruttore "Solo documenti misti".
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import { STATI_FILTRO, type Contesto, type FiltriSpese, type OpzioniFiltri } from '@/lib/spese/vista'

function Sezione({ nome, voci, valore, scegli }: {
  nome: string; voci: string[]; valore: string; scegli: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <Etichetta>{nome}</Etichetta>
      <div className="flex gap-1.5 flex-wrap">
        {voci.map(v => <Chip key={v} attivo={valore === v} onClick={() => scegli(v)}>{v}</Chip>)}
      </div>
    </div>
  )
}

export function FiltriPanel({ contesto, opzioni, filtri, iniziali, setFiltri, risultati, chiudi }: {
  contesto: Contesto
  opzioni: OpzioniFiltri
  filtri: FiltriSpese
  iniziali: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  risultati: number
  chiudi: () => void
}) {
  const su = (k: keyof FiltriSpese) => (v: string) => setFiltri({ ...filtri, [k]: v })
  return (
    <Foglio aria="Filtri" chiudi={chiudi} scorrevole>
      <div className="flex items-center justify-between mb-4">
        <p className={`${DISPLAY} text-[19px]`} style={{ color: t.inchiostro }}>
          Filtri <span className="font-semibold text-[13px]" style={{ color: t.sub }}>
            · {contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'}</span>
        </p>
        <button onClick={() => setFiltri(iniziali)}
          className="text-[13px] font-bold min-h-11 px-2" style={{ color: t.terracotta }}>Azzera</button>
      </div>

      <Sezione nome="Periodo" voci={opzioni.periodi} valore={filtri.periodo} scegli={su('periodo')} />
      {contesto === 'mia' && opzioni.persone && (
        <Sezione nome="Di chi" voci={['Tutti', ...opzioni.persone]} valore={filtri.persona} scegli={su('persona')} />
      )}
      {contesto === 'ania' && opzioni.camere && (
        <Sezione nome="Camera" voci={['Tutte', ...opzioni.camere]} valore={filtri.camera} scegli={su('camera')} />
      )}
      <Sezione nome="Categoria" voci={['Tutte', ...opzioni.categorie]} valore={filtri.categoria} scegli={su('categoria')} />
      <Sezione nome="Pagamento" voci={['Tutti', ...opzioni.metodi]} valore={filtri.metodo} scegli={su('metodo')} />
      <Sezione nome="Stato documento" voci={['Tutti', ...Object.keys(STATI_FILTRO)]} valore={filtri.stato} scegli={su('stato')} />

      <div className="mb-4">
        <Etichetta>Documenti misti</Etichetta>
        <Chip attivo={filtri.soloMisti} aria="Mostra solo i documenti divisi tra Casa Mia e Casa Ania"
          onClick={() => setFiltri({ ...filtri, soloMisti: !filtri.soloMisti })}>
          Solo documenti misti
        </Chip>
      </div>

      <button onClick={chiudi} className="w-full min-h-12 text-[15px] font-bold text-white mt-1"
        style={{ background: t.verde, borderRadius: t.rPill }}>
        {risultati === 0 ? 'Nessun movimento — chiudi' : risultati === 1 ? 'Mostra 1 movimento' : `Mostra ${risultati} movimenti`}
      </button>
    </Foglio>
  )
}
