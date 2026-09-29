// ============================================================================
// LA SCHEDA CLIENTE «MAISON» (ritocchi del 29/09/2026, D3; riferimento 2,
// schermata 2 «pagina unica»): le regole pure dei testi. Il disegno sta in
// app/clienti/[id]/page.tsx.
//   · la riga maiuscoletta sotto il nome: «da Nida · 4 soggiorni · 640 € ·
//     ricevuta · ottimo · paga in contanti», solo i pezzi presenti, lo speso
//     in mattone;
//   · la riga sotto ogni soggiorno: «date (con l'anno) · arrivo 17:00 /
//     orario non registrato · 🚌 / no navetta · 🛏 letto in più».
// ============================================================================
import { provenienzaInParole } from './provenienza.ts'
import { valutazioneDi, vuoleRicevuta } from './valutazione.ts'
import { pagamentoAbitualeDi, testoPagamentoAbituale } from './pagamentoAbituale.ts'
import { periodoCompatto } from './dateItaliane.ts'
import type { PezzoRiga } from './clientiElenco.ts'

type Cliente = {
  provenienza?: string | null
  struttura_nome?: string | null
  rating?: string | null
  vuole_ricevuta?: boolean | null
  pagamento_abituale?: string | null
}

const euro = (cent: number) => `${Math.round(cent / 100).toLocaleString('it-IT')} €`

/** La riga maiuscoletta della testata: solo i pezzi che ci sono */
export function rigaTestaCliente(c: Cliente, conclusi: { n: number; ricaviCent: number }): PezzoRiga[] {
  const pezzi: PezzoRiga[] = []
  const fonte = provenienzaInParole(c)
  if (fonte) pezzi.push({ testo: fonte === 'Google' ? 'da Google' : fonte === 'passaparola' ? 'da passaparola' : fonte })
  if (conclusi.n > 0) {
    pezzi.push({ testo: `${conclusi.n} ${conclusi.n === 1 ? 'soggiorno' : 'soggiorni'}` })
    if (conclusi.ricaviCent > 0) pezzi.push({ testo: euro(conclusi.ricaviCent), mat: true })
  }
  if (vuoleRicevuta(c)) pezzi.push({ testo: 'ricevuta' })
  if (valutazioneDi(c) === 'ottimo') pezzi.push({ testo: 'ottimo' })
  const paga = testoPagamentoAbituale(pagamentoAbitualeDi(c))
  if (paga) pezzi.push({ testo: paga })
  // i separatori « · » fra un pezzo e l'altro
  return pezzi.flatMap((p, i) => (i === 0 ? [p] : [{ testo: ' · ' }, p]))
}

type Segmento = { check_in_time?: string | null; shuttle?: string | null }

/** La riga piccola sotto le camere di un soggiorno */
export function rigaSoggiornoCliente(r: { check_in: string; check_out: string; status: string; extra_bed: boolean }, primo: Segmento | undefined, arrivoVero: boolean): string {
  const pezzi = [periodoCompatto(r.check_in, r.check_out, { anno: true })]
  // l'arrivo registrato, mai inventato: se manca l'orario lo si dice; la navetta solo se davvero salvata
  if (r.status !== 'annullata' && arrivoVero && primo) {
    pezzi.push(primo.check_in_time ? `arrivo ${primo.check_in_time}` : 'orario non registrato')
    if (primo.shuttle === 'si') pezzi.push('🚌')
    if (primo.shuttle === 'no') pezzi.push('no navetta')
  }
  if (r.extra_bed) pezzi.push('🛏 letto in più')
  return pezzi.join(' · ')
}

/** L'importo a destra: «470 €»; «—» su un'annullata senza importo (riferimento 2). Un
 *  mancato arrivo è annullato ma ha il suo dovuto: quello si scrive */
export const importoSoggiorno = (r: { status: string; totaleCent: number }) => (r.status === 'annullata' && !r.totaleCent ? '—' : euro(r.totaleCent))
