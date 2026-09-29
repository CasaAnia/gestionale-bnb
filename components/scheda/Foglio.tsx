'use client'
// ============================================================================
// IL FOGLIO che si apre sopra la nuova scheda prenotazione (13/09/2026): dal
// basso sul telefono, al centro sul Mac — la stessa veste dei fogli della
// proposta (ed-velo, ed-foglio, scheda-in). Contiene quello che gli si passa.
//
// La veste comune di TUTTI i fogli di modifica (16/09/2026, decisa da Ania):
// fondo crema, angoli in alto arrotondati di 20 px, 22 px di margine ai lati,
// in cima il titolo in Georgia 20. Col titolo `grande` la testa è in Georgia
// 18: è il foglietto della notte della striscia («Sabato 12», 13/09/2026).
//
// In fondo, centrati, ci stanno la pastiglia verde piena con l'azione (alta
// 30 px, testo 12 px) e sotto «Annulla» in 13 px stone: è PiedeFoglio, qui
// sotto, così nessun foglio si ridisegna i suoi due tasti. Chiudendo con
// «Annulla» non cambia niente: il piede chiama solo `onAnnulla`.
// ============================================================================
// ----------------------------------------------------------------------------
// Dal 28/09/2026 (scheda «Maison», riferimento approvato da Ania) i fogli della
// scheda si aprono nella veste FoglioMaison: dentro <VesteMaison> questo
// componente disegna il foglio avorio con la maniglia, il NOME in Cormorant
// come titolo e sotto, in maiuscoletto ottone, il nome del foglio (quello che
// prima era il titolo); un'ALTEZZA FISSA per ogni foglio (lib/altezzeFogli:
// quella del suo contenuto più lungo, mai misure che cambiano scegliendo);
// il piede in fondo (PiedeFoglio: «Annulla» tenue e il tasto pieno, angoli
// vivi) e, dopo un salvataggio, la conferma B (spunta, «Salvato», chiusura da
// sola), che la pagina accende con ContestoFogli. Fuori da VesteMaison resta
// tutto com'era. Testi, campi, regole e messaggi dei fogli non cambiano.
// ----------------------------------------------------------------------------
import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDesktop } from '@/lib/richiesteVista'
import { useMaison } from '@/components/nuova/PezziNuova'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { ALTEZZA_FOGLIO_PREDEFINITA } from '@/lib/altezzeFogli'

/** Quello che la scheda dice ai suoi fogli: il nome (il titolo del foglio) e,
 *  dopo un salvataggio riuscito, la conferma da mostrare prima di chiudere. */
export type FogliScheda = { nome: string; salvato: { quando: Date; dopo: () => void } | null }
export const ContestoFogli = createContext<FogliScheda | null>(null)
/** Il posto in fondo al foglio Maison dove il piede si disegna (sempre al suo posto) */
const PostoPiede = createContext<HTMLElement | null | undefined>(undefined)

export const GEORGIA_FOGLIO = "Georgia, 'Times New Roman', serif"
export const MATTONE_FOGLIO = '#8C3B2E'
export const ANGOLI_FOGLIO = 20
export const MARGINE_FOGLIO = 22
export const ALTEZZA_AZIONE = 30
export const TESTO_ANNULLA = 'Annulla'

/** Col titolo `centrato` la testa è in Georgia 24 centrata, con la X a
 *  destra: è il foglio «Il soggiorno si allunga» (Ania, 18/09/2026).
 *  Con `misuraTitolo` il titolo a sinistra ha quella misura in Georgia (il
 *  foglio «Aggiungi pagamento» approvato il 20/09/2026 lo vuole in 23):
 *  senza, resta il 20 di tutti gli altri fogli. */
export default function Foglio({ titolo, grande = false, centrato = false, misuraTitolo, ampio = false, altezza, onChiudi, children }: { titolo: string; grande?: boolean; centrato?: boolean; misuraTitolo?: number; ampio?: boolean; altezza?: number; onChiudi: () => void; children: ReactNode }) {
  const desktop = useDesktop()
  const maison = useMaison()
  if (maison) return <FoglioSchedaMaison titolo={titolo} altezza={altezza ?? ALTEZZA_FOGLIO_PREDEFINITA} onChiudi={onChiudi}>{children}</FoglioSchedaMaison>
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={titolo}>
      <div className="velo-in absolute inset-0 ed-velo" onClick={onChiudi} />
      <div style={ampio ? { height: desktop ? '80dvh' : '88dvh' } : undefined} className={`scheda-in absolute ed-foglio shadow-lg overflow-y-auto ${desktop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[20px] w-[440px] max-h-[80vh] px-[22px] pt-4 pb-4' : 'left-0 right-0 bottom-0 rounded-t-[20px] px-[22px] pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[88dvh]'}`}>
        {!desktop && <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />}
        {centrato ? (
          <div className="relative mb-3" style={{ padding: '4px 36px 0' }}>
            <p data-titolo-foglio data-titolo-centrato className="text-green-dark text-center"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, lineHeight: '28px' }}>{titolo}</p>
            <button type="button" onClick={onChiudi} aria-label="Chiudi" className="absolute right-0 top-0 w-9 h-9 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
          </div>
        ) : (
        <div className="flex items-center justify-between gap-3 mb-3">
          <p data-titolo-foglio className="text-green-dark"
            style={misuraTitolo
              ? { fontFamily: GEORGIA_FOGLIO, fontSize: misuraTitolo, lineHeight: `${misuraTitolo + 4}px` }
              : grande
              ? { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, lineHeight: '22px' }
              : { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, lineHeight: '24px' }}>{titolo}</p>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="w-9 h-9 shrink-0 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
        </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** I due tasti in fondo a ogni foglio: l'azione in pastiglia piena, centrata,
 *  e sotto «Annulla» (o «Torna indietro»). Con `mattone` la pastiglia è
 *  #8C3B2E: è l'annullamento della prenotazione. Con `disabilitato` l'azione
 *  è spenta (manca un dato valido) ma «Annulla» resta viva: si spegne solo
 *  mentre si salva. */
export function PiedeFoglio({ azione, onAzione, salvando = false, testoSalvando = 'Salvo…', onAnnulla, testoAnnulla = TESTO_ANNULLA, mattone = false, disabilitato = false, dati }: {
  azione: string
  onAzione: () => void
  salvando?: boolean
  testoSalvando?: string
  onAnnulla: () => void
  testoAnnulla?: string
  mattone?: boolean
  disabilitato?: boolean
  dati?: string
}) {
  const posto = useContext(PostoPiede)
  // Veste «Maison»: «Annulla» tenue e l'azione piena (mattone per annullare
  // e togliere), sempre in fondo al foglio, anche quando il contenuto scorre
  if (posto !== undefined) {
    if (!posto) return null
    return createPortal(
      <div className="mz-foot" data-piede-foglio>
        <span />
        <span className="acts">
          <button type="button" className="mz-lnk q" data-annulla-foglio onClick={onAnnulla} disabled={salvando}>{testoAnnulla}</button>
          <button type="button" className={`mz-cta ${mattone ? 'mat' : ''}`} data-azione-foglio={dati} onClick={onAzione} disabled={salvando || disabilitato}>{salvando ? testoSalvando : azione}</button>
        </span>
      </div>, posto)
  }
  return (
    <div data-piede-foglio className="text-center" style={{ marginTop: 22, marginBottom: 2 }}>
      <button type="button" data-azione-foglio={dati} onClick={onAzione} disabled={salvando || disabilitato}
        style={{
          minHeight: ALTEZZA_AZIONE, maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: '18px', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600,
          background: mattone ? MATTONE_FOGLIO : 'var(--color-green-mid)', color: 'var(--color-cream)', opacity: salvando ? 0.5 : disabilitato ? 0.45 : 1,
        }}>{salvando ? testoSalvando : azione}</button>
      <p style={{ marginTop: 10 }}>
        <button type="button" data-annulla-foglio onClick={onAnnulla} disabled={salvando}
          style={{ minHeight: 44, padding: '0 14px', fontSize: 13, color: 'var(--color-stone)' }}>{testoAnnulla}</button>
      </p>
    </div>
  )
}

/** Il foglio della scheda nella veste «Maison» (vedi in cima). */
function FoglioSchedaMaison({ titolo, altezza, onChiudi, children }: { titolo: string; altezza: number; onChiudi: () => void; children: ReactNode }) {
  const scheda = useContext(ContestoFogli)
  const [posto, setPosto] = useState<HTMLElement | null>(null)
  const nome = scheda?.nome?.trim() || ''
  const salvato = scheda?.salvato ?? null
  return (
    <PostoPiede.Provider value={posto}>
      <FoglioMaison titolo={nome || titolo} sottotitolo={nome ? titolo : undefined} altezza={altezza} onChiudi={onChiudi}
        dati="scheda" salvato={salvato ? { cosa: nome ? `${titolo} · ${nome}` : titolo, quando: salvato.quando } : null}
        onFineSalvato={salvato?.dopo}
        piede={<div ref={setPosto} data-posto-piede />}>
        {children}
      </FoglioMaison>
    </PostoPiede.Provider>
  )
}
