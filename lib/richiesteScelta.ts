// Quali camere elencare nel messaggio del caso A (pezzo 9, corretto il
// 07/09/2026): la pagina della proposta decide qui, con logica pura, se il
// testo che parte deve proporre UNA camera sola o l'elenco delle camere libere.
//
// Bug in produzione del 07/09/2026: richiesta dal sito per Allegra, tutte le
// camere libere, Ania sceglie Allegra per l'intero soggiorno, ma il messaggio
// elencava le tre camere perché la pagina passava SEMPRE tutte le «completa»
// al generatore. L'elenco va usato solo quando nessuno ha scelto:
//  · Ania ha toccato una soluzione nel pannello «Cambia» → quella camera sola;
//  · «Scelgo io» (soluzione manuale) → quella camera sola;
//  · il cliente ha chiesto una camera ed è libera → quella camera sola;
//  · altrimenti (camera qualsiasi, o la richiesta è occupata) → l'elenco.
import { camereDelCasoA } from './richiesteTesti.ts'
import type { Soluzione } from './richiesteProposta.ts'

export type SceltaProposta = {
  cameraRichiesta: string | null   // camera chiesta dal cliente nel modulo del sito (id), o null = qualsiasi
  sceltaDiAnia: boolean            // Ania ha toccato il bottone di una soluzione nel pannello «Cambia»
}

// null = una camera sola (il generatore usa la soluzione e basta);
// un elenco = tutte le «completa», da salvare in proposta_alternative
export function alternativeDaElencare(soluzione: Soluzione | null, soluzioni: Soluzione[], scelta: SceltaProposta): Soluzione[] | null {
  if (!soluzione || soluzione.caso !== 'completa' || soluzione.manuale) return null
  if (scelta.sceltaDiAnia) return null
  if (scelta.cameraRichiesta && soluzione.segmenti[0]?.camera.id === scelta.cameraRichiesta) return null
  return camereDelCasoA(soluzione, soluzioni.filter(s => s.caso === 'completa'))
}

// ── La scelta di Ania come CHIAVE, non come posizione ────────────────────────
// Le soluzioni si ricalcolano ogni minuto e al ritorno in primo piano (le
// opzioni di 3 ore scadono): se una camera si libera la lista si riordina e
// una scelta ricordata come indice punterebbe a un'altra camera. La chiave
// è il caso più le camere con le loro date.
export function chiaveSoluzione(s: Soluzione): string {
  return `${s.caso}|${s.segmenti.map(x => `${x.camera.id}:${x.arrivo}:${x.partenza}`).join('+')}`
}
// Una scelta sparita richiede una nuova scelta esplicita: nessun'altra camera
// può prendere silenziosamente il suo posto. La prima vale solo all'apertura.
export function soluzioneScelta(soluzioni: Soluzione[], chiave: string | null): { soluzione: Soluzione | null; trovata: boolean } {
  const trovata = chiave !== null ? soluzioni.find(s => chiaveSoluzione(s) === chiave) ?? null : null
  return { soluzione: chiave === null ? soluzioni[0] ?? null : trovata, trovata: trovata !== null }
}
