// ============================================================================
// LA PAGINA DELLA RICHIESTA «MAISON» (29/09/2026): due regole pure della
// pagina a linguette (app/richieste/[id]/proposta).
// ============================================================================

/**
 * L'alternativa Ambra/Allegra (novità 14e): la spunta sta sotto le camere e
 * compare SOLO quando Amelia è scelta (e il calcolo ha trovato l'alternativa);
 * non con «non c'è posto» né su una proposta già partita.
 */
export function mostraAlternativaAmelia(s: { amelia: boolean; ameliaScelta: boolean; completo: boolean; inviataBloccata: boolean }): boolean {
  return s.amelia && s.ameliaScelta && !s.completo && !s.inviataBloccata
}

/**
 * La nota delle opzioni divisa in titolo e resto, come nel riferimento:
 * «Amelia è in opzione» + « fino alle 18:00 per L. Greco. Libere …»;
 * «Ambra era in opzione» + « per Mario Rossi, scaduta alle 16:40. Puoi proporla.».
 * Senza uno dei due pezzi il titolo resta vuoto e il testo intero va nel resto.
 */
export function dividiNotaOpzioni(testo: string): [string, string] {
  const m = /^(.*? (?:è|sono|era|erano) in opzione)([\s\S]*)$/.exec(testo)
  return m ? [m[1], m[2]] : ['', testo]
}

// ── Le quattro linguette (novità 14d) ──────────────────────────────────────
export const LINGUETTE_RICHIESTA = [
  { id: 'controllare', label: 'Controllare' },
  { id: 'camere', label: 'Camere' },
  { id: 'pagamento', label: 'Pagamento' },
  { id: 'messaggio', label: 'Messaggio' },
] as const
export type LinguettaRichiesta = typeof LINGUETTE_RICHIESTA[number]['id']

/** Dall'indirizzo alla linguetta: #camere → camere; niente o altro → quella di partenza */
export function linguettaDaHash(hash: string, partenza: LinguettaRichiesta): LinguettaRichiesta {
  const h = hash.replace(/^#/, '')
  return (LINGUETTE_RICHIESTA.find(l => l.id === h)?.id ?? partenza)
}

/** La linguetta di partenza: Messaggio se la proposta è già inviata, altrimenti Controllare */
export const linguettaDiPartenza = (stato: string | null | undefined): LinguettaRichiesta =>
  (stato === 'proposta_inviata' ? 'messaggio' : 'controllare')

