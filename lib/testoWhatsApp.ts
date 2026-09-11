// Il grassetto di WhatsApp, letto come lo legge WhatsApp.
//
// Il testo delle proposte parte su WhatsApp con gli asterischi dentro
// (*così*): sono loro a fare il grassetto sul telefono dell'ospite, quindi non
// vanno mai tolti dal testo che si manda o che si copia. Nell'anteprima del
// gestionale, invece, Ania deve vedere il grassetto e non gli asterischi: per
// quello c'è components/TestoWhatsApp.tsx, che usa queste funzioni pure.
//
// Regole, le stesse di WhatsApp:
// - *…* grassetto, _…_ corsivo, e si possono annidare (*_così_*);
// - il delimitatore conta solo se è attaccato alla parola: niente spazio
//   subito dopo quello di apertura né subito prima di quello di chiusura;
// - la coppia non scavalca un a capo;
// - un delimitatore che non si chiude resta un carattere normale;
// - tutto il resto del testo, a capo compresi, non si tocca.

export type PezzoWhatsApp = { testo: string; grassetto: boolean; corsivo: boolean }

const STILE_DEL_SEGNO: Record<string, 'grassetto' | 'corsivo' | undefined> = { '*': 'grassetto', _: 'corsivo' }
const spazio = (c: string | undefined) => c === undefined || /\s/.test(c)

// Posizione del delimitatore che chiude quello aperto in `apertura`, oppure
// -1 se non si chiude (e allora il segno è testo normale).
function chiusura(testo: string, apertura: number): number {
  const segno = testo[apertura]
  const dopo = testo[apertura + 1]
  if (dopo === undefined || dopo === segno || spazio(dopo)) return -1
  for (let i = apertura + 2; i < testo.length; i++) {
    if (testo[i] === '\n') return -1
    if (testo[i] === segno && !spazio(testo[i - 1])) return i
  }
  return -1
}

function analizza(testo: string, grassetto: boolean, corsivo: boolean): PezzoWhatsApp[] {
  const pezzi: PezzoWhatsApp[] = []
  let normale = ''
  const chiudiNormale = () => {
    if (normale) pezzi.push({ testo: normale, grassetto, corsivo })
    normale = ''
  }
  let i = 0
  while (i < testo.length) {
    const stile = STILE_DEL_SEGNO[testo[i]]
    // Un segno del tipo già attivo qui dentro resta testo: niente doppioni
    const gia = stile === 'grassetto' ? grassetto : stile === 'corsivo' ? corsivo : true
    const fine = stile && !gia ? chiusura(testo, i) : -1
    if (fine < 0) { normale += testo[i]; i++; continue }
    chiudiNormale()
    pezzi.push(...analizza(testo.slice(i + 1, fine), grassetto || stile === 'grassetto', corsivo || stile === 'corsivo'))
    i = fine + 1
  }
  chiudiNormale()
  return pezzi
}

// Il testo spezzato nei suoi pezzi, nell'ordine: chi lo mostra decide come.
export function pezziWhatsApp(testo: string | null | undefined): PezzoWhatsApp[] {
  return testo ? analizza(testo, false, false) : []
}
