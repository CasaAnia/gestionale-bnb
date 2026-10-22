// ============================================================================
// «ARRIVI PRECEDENTI» (13/09/2026): come erano andati gli arrivi degli altri
// soggiorni CONCLUSI di questa cliente — periodo, camere, orario e navetta —
// le stesse righe della scheda attuale, calcolate con lib/storicoCliente.
// Solo lettura: non scrive niente. Era dentro components/scheda/
// ArriviPrecedenti; sta qui dal 22/10/2026 per essere provato in Node.
//
// Dal 22/10/2026 (Codex): con un luogo esterno lo storico dice anche DOVE e
// a che ora è arrivata («Arriva a Rogoredo alle 09:20») e il prelievo, anche
// quando l'ora in struttura non c'è. Prima leggeva solo l'ora in struttura:
// con quella vuota il luogo e la sua ora sparivano. L'ora in struttura, il
// luogo, l'autista e il prelievo restano voci distinte.
// ============================================================================
import { righeStorico, type SegmentoStorico } from './storicoCliente.ts'
import { periodoCompatto } from './dateItaliane.ts'
import { leggiArrivo, periodoInStruttura, circaInStruttura, navettaInScheda, navettaRichiesta, rigaLuogo, rigaPrelievo } from './arrivo.ts'

export type ArrivoPrecedente = {
  chiave: string
  periodo: string
  camere: string
  /** l'ora in struttura («arrivo 16:00», «in struttura circa 15:30–16:30»); null quando c'è solo il luogo */
  orario: string | null
  /** «Arriva a Rogoredo alle 09:20»; null senza luogo esterno */
  luogo: string | null
  navetta: string
  /** «Prelievo a Linate · 09:15»; null senza navetta o senza dettagli */
  prelievo: string | null
}

export const ORARIO_NON_REGISTRATO = 'orario non registrato'

export function arriviPrecedenti(altre: SegmentoStorico[], oggi: string): ArrivoPrecedente[] {
  return righeStorico(altre)
    .filter(r => r.status !== 'annullata')
    .filter(r => r.segmenti.filter(s => s.status !== 'annullata').every(s => ['confermata', 'completata'].includes(s.status) && s.check_out <= oggi))
    .sort((a, z) => z.check_in.localeCompare(a.check_in))
    .map(r => {
      // il primo arrivo fra i tratti VIVI: un tratto annullato non dice com'è
      // arrivata (rilievo di Codex, 22/10/2026)
      const primo = r.segmenti.filter(s => s.status !== 'annullata').sort((a, z) => a.check_in.localeCompare(z.check_in))[0]
      // Dal 21/09/2026 sera si legge il MODELLO, non le due colonne di
      // sempre: lo storico non perde più la fine della fascia, il «circa»
      // della stima e il nome dell'autista (rilievo di Codex).
      const a = leggiArrivo(primo as unknown as Record<string, unknown>)
      const quando = periodoInStruttura(a)
      const luogo = rigaLuogo(a)
      const circa = circaInStruttura(a) ? 'circa ' : ''
      return {
        chiave: r.chiave,
        periodo: periodoCompatto(r.check_in, r.check_out, { anno: true }),
        camere: r.camere.join(' → '),
        orario: quando ? `${luogo ? 'in struttura' : 'arrivo'} ${circa}${quando}` : luogo ? null : ORARIO_NON_REGISTRATO,
        luogo,
        navetta: a.navetta === 'non_richiesta' ? 'navetta no'
          : navettaRichiesta(a.navetta) ? `navetta ${navettaInScheda(a).titolo.toLowerCase()}`
          : 'navetta non registrata',
        prelievo: rigaPrelievo(a),
      }
    })
}
