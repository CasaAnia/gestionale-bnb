// Testi delle bozze di proposta (pezzo 3). UN file solo, da modificare a mano
// quando cambia una frase: i campi tra parentesi quadre si compilano dai dati.
// Le date si scrivono in italiano ("dal 13 al 15 settembre"); la descrizione
// della camera è quella della conferma di prenotazione (lib/roomTypes).
import { descrizioneBreveCamera } from './roomTypes.ts'
import { giorniTra } from './richiesteCalendario.ts'
import type { Soluzione, SegmentoSoluzione } from './richiesteProposta.ts'

export const TESTI = {
  saluto: 'Buongiorno [Nome], grazie per aver scritto a Casa Ania. Ho verificato la disponibilità per le date richieste.',
  casoA: 'Dal [check-in] al [check-out] posso proporti la camera [nome camera], [breve descrizione], al prezzo complessivo di [prezzo] € per [numero] notti.',
  casoB: `Per riuscire a ospitarti durante tutto il periodo, posso proporti una soluzione con un cambio di camera:
- dal [data] al [data]: camera [nome e descrizione]
- dal [data] al [data]: camera [nome e descrizione]
Il prezzo complessivo per l'intero soggiorno è di [prezzo] €. Il cambio sarebbe quindi soltanto il giorno [data].`,
  casoC: `Per il periodo richiesto mi manca disponibilità soltanto per [la notte/le notti] del [data o date]. Posso però ospitarti:
- dal [data] al [data]: camera [nome e descrizione]
- dal [data] al [data]: camera [nome e descrizione]
Se per [quella notte/quelle notti] riesci a trovare una sistemazione nelle vicinanze, puoi trascorrere da noi tutto il resto del soggiorno. Il prezzo complessivo per le [numero] notti da Casa Ania è di [prezzo] €.`,
  casoD: "Non ho disponibilità per [la prima notte/le prime due notti/l'ultima notte], ma posso ospitarti dal [data] al [data] nella camera [nome e descrizione], al prezzo complessivo di [prezzo] € per [numero] notti.",
  casoE: 'Per le date indicate purtroppo siamo al completo. Mi dispiace davvero non poterti aiutare questa volta.',
  chiusura: `Fammi sapere se questa soluzione può andare bene per te, così possiamo procedere con la prenotazione.
Grazie,
Ania – Casa Ania`,
  chiusuraCompleto: `Grazie,
Ania – Casa Ania`,
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const PAROLE = ['', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci']

function parti(iso: string) { const [a, m, g] = iso.split('-').map(Number); return { a, m, g } }

// "13 settembre" · con anno se diverso da quello di riferimento
export function dataLunga(iso: string, conAnno = false): string {
  const { a, m, g } = parti(iso)
  return `${g} ${MESI[m - 1]}${conAnno ? ` ${a}` : ''}`
}

// "dal 13 al 15 settembre" · "dal 30 settembre al 2 ottobre" · "dal 30 dicembre 2026 al 2 gennaio 2027"
export function dalAl(arrivo: string, partenza: string): string {
  const A = parti(arrivo), P = parti(partenza)
  if (A.a !== P.a) return `dal ${dataLunga(arrivo, true)} al ${dataLunga(partenza, true)}`
  if (A.m !== P.m) return `dal ${dataLunga(arrivo)} al ${dataLunga(partenza)}`
  return `dal ${A.g} al ${P.g} ${MESI[A.m - 1]}`
}

// Elenco di giorni: "14 settembre" · "14 e 15 settembre" · "14, 15 e 16 settembre" · "30 settembre e 1 ottobre"
export function elencoDate(giorni: string[]): string {
  if (giorni.length === 0) return ''
  const gruppi: { mese: number; giorni: number[] }[] = []
  for (const g of giorni) {
    const { m, g: giorno } = parti(g)
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && ultimo.mese === m) ultimo.giorni.push(giorno)
    else gruppi.push({ mese: m, giorni: [giorno] })
  }
  const congiunzione = (voci: string[]) => voci.length <= 1 ? voci.join('') : `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`
  return congiunzione(gruppi.map(gr => `${congiunzione(gr.giorni.map(String))} ${MESI[gr.mese - 1]}`))
}

export function prezzo(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const nottiTesto = (n: number) => (n === 1 ? '1 notte' : `${n} notti`)
const inParole = (n: number) => (n >= 1 && n <= 10 ? PAROLE[n] : String(n))

const descr = (s: SegmentoSoluzione) => descrizioneBreveCamera(s.camera)
const riga = (s: SegmentoSoluzione) => `- ${dalAl(s.arrivo, s.partenza)}: camera ${descr(s)}`

// "la prima notte" · "le prime due notti" · "l'ultima notte" · "le ultime tre notti" · "la prima notte e l'ultima notte"
export function notteMancanteEstremo(richiesta: { arrivo: string; partenza: string }, soluzione: Soluzione): string {
  const notti = giorniTra(richiesta.arrivo, richiesta.partenza)
  const coperte = new Set(soluzione.segmenti.flatMap(s => giorniTra(s.arrivo, s.partenza)))
  let inizio = 0
  while (inizio < notti.length && !coperte.has(notti[inizio])) inizio++
  let fine = 0
  while (fine < notti.length - inizio && !coperte.has(notti[notti.length - 1 - fine])) fine++
  const pezzi: string[] = []
  if (inizio > 0) pezzi.push(inizio === 1 ? 'la prima notte' : `le prime ${inParole(inizio)} notti`)
  if (fine > 0) pezzi.push(fine === 1 ? "l'ultima notte" : `le ultime ${inParole(fine)} notti`)
  return pezzi.join(' e ')
}

export function corpoBozza(richiesta: { arrivo: string; partenza: string }, sol: Soluzione): string {
  switch (sol.caso) {
    case 'completa': {
      const s = sol.segmenti[0]
      const intervallo = dalAl(s.arrivo, s.partenza)
      return `${intervallo.charAt(0).toUpperCase()}${intervallo.slice(1)} posso proporti la camera ${descr(s)}, al prezzo complessivo di ${prezzo(sol.prezzoTotale)} € per ${nottiTesto(sol.nottiCoperte)}.`
    }
    case 'cambio': {
      const [s1, s2] = sol.segmenti
      return `Per riuscire a ospitarti durante tutto il periodo, posso proporti una soluzione con un cambio di camera:
${riga(s1)}
${riga(s2)}
Il prezzo complessivo per l'intero soggiorno è di ${prezzo(sol.prezzoTotale)} €. Il cambio sarebbe quindi soltanto il giorno ${dataLunga(s2.arrivo)}.`
    }
    case 'manca_mezzo': {
      const [s1, s2] = sol.segmenti
      const una = sol.nottiMancanti.length === 1
      const notti = sol.nottiCoperte === 1 ? 'per la notte' : `per le ${sol.nottiCoperte} notti`
      return `Per il periodo richiesto mi manca disponibilità soltanto per ${una ? 'la notte' : 'le notti'} del ${elencoDate(sol.nottiMancanti)}. Posso però ospitarti:
${riga(s1)}
${riga(s2)}
Se per ${una ? 'quella notte' : 'quelle notti'} riesci a trovare una sistemazione nelle vicinanze, puoi trascorrere da noi tutto il resto del soggiorno. Il prezzo complessivo ${notti} da Casa Ania è di ${prezzo(sol.prezzoTotale)} €.`
    }
    case 'manca_estremo': {
      const s = sol.segmenti[0]
      return `Non ho disponibilità per ${notteMancanteEstremo(richiesta, sol)}, ma posso ospitarti ${dalAl(s.arrivo, s.partenza)} nella camera ${descr(s)}, al prezzo complessivo di ${prezzo(sol.prezzoTotale)} € per ${nottiTesto(sol.nottiCoperte)}.`
    }
    case 'completo':
      return TESTI.casoE
  }
}

export function componiBozza(richiesta: { nome: string; arrivo: string; partenza: string }, soluzione: Soluzione): string {
  const saluto = TESTI.saluto.replace('[Nome]', richiesta.nome.trim())
  const chiusura = soluzione.caso === 'completo' ? TESTI.chiusuraCompleto : TESTI.chiusura
  return `${saluto}\n\n${corpoBozza(richiesta, soluzione)}\n\n${chiusura}`
}
