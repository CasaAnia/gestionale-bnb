// ============================================================================
// INTERRUTTORE del percorso di scrittura della revisione.
// 'legacy'    = il percorso attuale (scritture dirette + RPC 0020):
//               comportamento IDENTICO a prima, bit per bit.
// 'contratto' = il contratto di revisione collaudato (salva_revisione…):
//               NON va attivato in produzione prima della transizione
//               A/B COMPLETATA — mai una convivenza operativa dei due
//               percorsi di scrittura (PIANO-CABLAGGIO-CONTRATTO.md).
// L'attivazione è una MODIFICA DI CODICE deliberata dentro la pausa
// autorizzata del runbook, non una configurazione da ambiente.
// ============================================================================
export type PercorsoRevisione = 'legacy' | 'contratto'

export const PERCORSO_REVISIONE: PercorsoRevisione = 'legacy'
