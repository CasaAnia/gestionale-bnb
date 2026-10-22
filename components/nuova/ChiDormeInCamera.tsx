'use client'
// ============================================================================
// «CHI DORME IN CAMERA» (era «Con lei»; Ania, 28/09/2026, punto 12c) — nella
// veste «Maison» della Nuova prenotazione.
//
// Di norma dorme chi ha prenotato: in cima la riga dell'intestataria (nome in
// Cormorant, «Intestataria · dati della prenotazione», telefono a destra),
// che non si cancella. Sotto la spunta «Non è lei a dormire qui»: accesa, la
// riga dell'intestataria sparisce e si apre il foglietto vuoto per scrivere
// chi dorme davvero (il figlio che prenota per la mamma). «+ Aggiungi una
// persona» apre lo stesso foglietto. Le persone sono al massimo gli ospiti
// prenotati; oltre le due colonne del database vince il limite tecnico e
// l'avviso lo dice (lib/nuovaPrenotazione: statoPersone).
//
// La spunta compare solo se il database ha la colonna (proposta 0061).
// Dal 22/10/2026 ogni persona in elenco ha «Modifica» (useFogliettoPersona).
// ============================================================================
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo } from './PezziNuova'
import { RigaPersona, AGGIUNGI_PERSONA, ALTRO, SALVA_PERSONA, useFogliettoPersona } from './ConLei'
import CampiNomeCognome from '@/components/CampiNomeCognome'
import { CHI_E_VOCI, TITOLO_CHI_DORME, INTESTATARIA, NON_E_LEI, statoPersone, type PersonaConLei } from '@/lib/nuovaPrenotazione'

export default function ChiDormeInCamera({ intestataria, persone, onPersone, nonELei, onNonELei, spuntaDisponibile, ospiti, className = '' }: {
  /** chi ha prenotato: nome e telefono della prenotazione */
  intestataria: { nome: string; telefono: string }
  persone: PersonaConLei[]
  onPersone: (persone: PersonaConLei[]) => void
  nonELei: boolean
  onNonELei: (v: boolean) => void
  /** la colonna della spunta c'è (proposta 0061): senza, la spunta non si mostra */
  spuntaDisponibile: boolean
  /** gli ospiti prenotati: il massimo delle persone in elenco */
  ospiti: number
  className?: string
}) {
  const f = useFogliettoPersona(persone, onPersone)
  const stato = statoPersone(ospiti, nonELei, persone.length)
  // con la spunta e nessuno in elenco il foglietto è già aperto, vuoto;
  // una persona da modificare c'è già, quindi il limite non la ferma
  const foglioAperto = f.inModifica ? f.aperto : (f.aperto || (nonELei && persone.length === 0)) && stato.aggiungi

  return (
    <section data-chi-dorme className={`np-sec ${className}`}>
      <p className="mz-eyebrow">{TITOLO_CHI_DORME}</p>

      {!nonELei && (
        <div data-intestataria className="np-persona primo">
          <span className="min-w-0"><span className="nm">{intestataria.nome}</span><span className="ch">{INTESTATARIA}</span></span>
          <span className="tel">{intestataria.telefono}</span>
        </div>
      )}
      {spuntaDisponibile && (
        <div className="np-chips" style={{ marginTop: 10 }}>
          <button type="button" data-non-e-lei aria-pressed={nonELei} className={`np-chip ${nonELei ? 'on' : ''}`}
            onClick={() => { onNonELei(!nonELei); if (nonELei) f.chiudi() }}>{nonELei ? '☑' : '☐'} {NON_E_LEI}</button>
        </div>
      )}

      {persone.map(p => <RigaPersona key={p.id} persona={p} onModifica={() => f.apri(p)} onTogli={() => { if (f.inModifica) f.chiudi(); onPersone(persone.filter(x => x.id !== p.id)) }} />)}
      {stato.avviso && <p data-avviso-persone className="np-hint m">{stato.avviso}</p>}
      {stato.aggiungi && !foglioAperto && (
        <p style={{ marginTop: 10 }}><button type="button" data-tastino="aggiungi-persona" className="mz-lnk q np-lnk" onClick={() => f.apri()}>{AGGIUNGI_PERSONA}</button></p>
      )}

      {foglioAperto && (
        <div className="np-foglio" data-foglietto-persona>
          <p className="ti">{TITOLO_CHI_DORME}</p>
          <Etichetta testo="Chi" />
          {/* Nome e cognome: SOLO il componente condiviso (regola fissa n. 1) */}
          <CampiNomeCognome nome={f.nome} cognome={f.cognome} onNome={f.setNome} onCognome={f.setCognome} prefissoDati="persona-"
            classeFila="np-g2" classeCampo="np-fld" placeholderNome="Nome" placeholderCognome="Cognome"
            avvolgi={(_, campo) => <div className="min-w-0">{campo}</div>} />
          <RigaCampo etichetta="Telefono · può restare vuoto">
            <input type="tel" inputMode="tel" data-campo="persona-telefono" value={f.telefono} onChange={e => f.setTelefono(e.target.value)} style={stileCampo} />
          </RigaCampo>
          <Etichetta testo="Chi è" />
          <FilaPastiglie>
            {CHI_E_VOCI.map(v => (
              <Pastiglia key={v} dati={`chi-${v}`} acceso={!f.libero && f.chiE === v} onClick={() => f.scegli(v)}>{v}</Pastiglia>
            ))}
            <Pastiglia dati="chi-altro" acceso={f.libero} onClick={f.scegliAltro}>{ALTRO}</Pastiglia>
          </FilaPastiglie>
          {f.libero && (
            <RigaCampo etichetta="Chi è">
              <input type="text" data-campo="persona-chi" value={f.chiE} onChange={e => f.setChiE(e.target.value)} style={stileCampo} />
            </RigaCampo>
          )}
          <div className="np-foglio-piede">
            {/* appena accesa la spunta, «Annulla» la rispegne: si torna all'intestataria */}
            <button type="button" className="mz-lnk q np-lnk" onClick={() => { const nuova = !f.inModifica; f.chiudi(); if (nuova && nonELei && persone.length === 0) onNonELei(false) }}>Annulla</button>
            <button type="button" data-salva-persona className="mz-cta" onClick={f.salva}>{f.inModifica ? SALVA_PERSONA : 'Aggiungi'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
