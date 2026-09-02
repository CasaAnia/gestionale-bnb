// Testi delle proposte alle richieste (pezzo 6): UNICO generatore, puro e
// componibile. Lo usano l'anteprima, il testo che parte su WhatsApp, l'immagine
// e il testo archiviato in richieste.proposta_testo. Nessuna copia altrove.
//
//   generaProposta({ richiesta, soluzione, condizione, amelia }) → testo
//
// Regole fisse: sempre del Lei, apertura con «Gentile», tono caldo e diretto,
// righe vuote fra camere o periodi diversi. La proposta NON è una prenotazione:
// nei casi A–C il cliente ha ORE_RISPOSTA_PROPOSTA ore per rispondere, nel
// caso E nessun limite. Le condizioni di pagamento le sceglie Ania per ogni
// richiesta (mai preselezionate): senza condizione il testo si ferma prima
// della chiusura. Amelia è la camera più piccola; solo Allegra ha il balconcino.
// Importi sempre in centesimi (interi), mai float; formattazione italiana
// «1.234,50 €», senza decimali quando sono zero («140 €»).
// Le proposte già inviate restano quelle salvate in proposta_testo.
import { ROOM_TYPE_BY_NAME, bagnoDesc } from './roomTypes.ts'
import { capienzaBase, tariffaCamera } from './tariffe.ts'
import { giorniTra } from './richiesteCalendario.ts'
import { ORE_RISPOSTA_PROPOSTA, ORE_RISERVA_BONIFICO, GIORNI_PREAVVISO_CANCELLAZIONE, type CondizionePagamento } from './condizioniPrenotazione.ts'
import type { Soluzione, SegmentoSoluzione, AlternativaAmelia } from './richiesteProposta.ts'

export type Condizione =
  | { tipo: 'arrivo' }
  | { tipo: 'caparra'; caparraCentesimi: number }
  | { tipo: 'completo' }
  | { tipo: 'personalizzata'; testo: string }

export type RichiestaTesto = { nome: string; arrivo: string; partenza: string }

export const FIRMA = 'Grazie mille,\nAnia – Casa Ania'

// ── Importi in centesimi ────────────────────────────────────────────────────
export function centesimi(euro: number | string | null | undefined): number {
  const n = Number(euro)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

// «1.234,50 €» · «140 €» · «0,05 €»
export function formattaEuro(cent: number): string {
  const negativo = cent < 0
  const abs = Math.abs(Math.round(cent))
  const euro = Math.floor(abs / 100)
  const spiccioli = abs % 100
  const interi = String(euro).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '-' : ''}${interi}${spiccioli ? `,${String(spiccioli).padStart(2, '0')}` : ''} €`
}

// «50» · «34,5»: percentuale della caparra sul totale, al decimo
export function percentuale(parteCent: number, totaleCent: number): string {
  if (totaleCent <= 0) return '0'
  const p = Math.round(parteCent * 1000 / totaleCent) / 10
  return Number.isInteger(p) ? String(p) : String(p).replace('.', ',')
}

// Per l'interfaccia: prezzo in euro (numero della soluzione) → «140» / «140,50», senza simbolo
export function prezzo(n: number): string {
  return formattaEuro(centesimi(n)).replace(/ €$/, '')
}

// Prezzo a notte di un segmento, letto aggiuntivo compreso, in centesimi
export function centesimiNotte(s: SegmentoSoluzione): number {
  const letto = s.notti > 0 ? Math.round(centesimi(s.lettoTotale) / s.notti) : 0
  return centesimi(s.prezzoNotte) + letto
}
export const centesimiTotale = (sol: Soluzione) => centesimi(sol.prezzoTotale)

// ── Date in italiano ────────────────────────────────────────────────────────
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

function parti(iso: string) { const [a, m, g] = iso.split('-').map(Number); return { a, m, g } }

// "13 settembre" · con anno se richiesto
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

export const nottiTesto = (n: number) => (n === 1 ? '1 notte' : `${n} notti`)
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ── Descrizione della camera, dai dati ──────────────────────────────────────
// "singola con bagno privato, all'interno della camera"
// "matrimoniale con balconcino e bagno privato, all'interno della camera" (solo Allegra)
// "singola con aggiunta del secondo letto e bagno privato, all'interno della camera"
const ORDINALI = ['', 'primo', 'secondo', 'terzo', 'quarto']
export function descrizioneCamera(camera: SegmentoSoluzione['camera'], persone: number): string {
  const nome = camera.name || ''
  const tipo = (ROOM_TYPE_BY_NAME[nome] || 'camera').toLowerCase()
  const pezzi: string[] = []
  if (nome === 'Allegra') pezzi.push('balconcino')
  const { lettoAddebitato } = tariffaCamera(camera, persone)
  // Amelia: secondo letto · Allegra/Ambra: terzo · Lena (tripla): quarto
  if (lettoAddebitato) pezzi.push(`aggiunta del ${ORDINALI[nome === 'Lena' ? 4 : capienzaBase(camera) + 1]} letto`)
  const bagno = bagnoDesc(camera)
  if (bagno) pezzi.push(`bagno ${bagno}`)
  if (pezzi.length === 0) return tipo
  return `${tipo} con ${pezzi.length === 1 ? pezzi[0] : `${pezzi.slice(0, -1).join(', ')} e ${pezzi[pezzi.length - 1]}`}`
}

// "– dal 13 al 14 settembre, nella camera Amelia, singola con …, al prezzo di 70 € a notte"
function rigaSegmento(s: SegmentoSoluzione, persone: number): string {
  return `– ${dalAl(s.arrivo, s.partenza)}, nella camera ${s.camera.name}, ${descrizioneCamera(s.camera, persone)}, al prezzo di ${formattaEuro(centesimiNotte(s))} a notte`
}

// ── Blocchi del messaggio ───────────────────────────────────────────────────
export function apertura(nome: string): string {
  return `Gentile ${nome.trim()}, grazie per aver pensato a Casa Ania per il suo soggiorno. Ho appena verificato la disponibilità per le date che mi ha indicato e posso proporle questa soluzione:`
}

export function casoE(nome: string): string {
  return `Gentile ${nome.trim()}, grazie per aver pensato a Casa Ania per il suo soggiorno.

Mi dispiace, ma per le date che mi ha indicato siamo al completo e non ho una soluzione alternativa da poterle proporre.

Spero di poterla accogliere in futuro.

${FIRMA}`
}

// Notti richieste ma non coperte dalla soluzione (in ordine)
export function nottiScoperte(richiesta: { arrivo: string; partenza: string }, sol: Soluzione): string[] {
  const coperte = new Set(sol.segmenti.flatMap(s => giorniTra(s.arrivo, s.partenza)))
  return giorniTra(richiesta.arrivo, richiesta.partenza).filter(g => !coperte.has(g))
}

export function corpo(richiesta: { arrivo: string; partenza: string }, sol: Soluzione, persone: number): string {
  switch (sol.caso) {
    case 'completa': {
      const s = sol.segmenti[0]
      return `${maiuscola(dalAl(s.arrivo, s.partenza))} è disponibile la camera ${s.camera.name}, ${descrizioneCamera(s.camera, persone)}. Il prezzo complessivo per ${nottiTesto(s.notti)} è di ${formattaEuro(centesimiTotale(sol))}.`
    }
    case 'cambio': {
      const [s1, s2] = sol.segmenti
      return `Per tutto il periodo, ${dalAl(richiesta.arrivo, richiesta.partenza)}, posso ospitarla prevedendo un cambio di camera durante il soggiorno:

${rigaSegmento(s1, persone)};

${rigaSegmento(s2, persone)}.`
    }
    case 'manca_mezzo':
    case 'manca_estremo': {
      const scoperte = nottiScoperte(richiesta, sol)
      const cambio = new Set(sol.segmenti.map(s => s.camera.id)).size > 1
      const righe = sol.segmenti.map((s, i) => `${rigaSegmento(s, persone)}${i === sol.segmenti.length - 1 ? '.' : ';'}`)
      return [
        `Per l'intero periodo non ho purtroppo una soluzione continuativa, ma posso ospitarla per la maggior parte del soggiorno.`,
        ...(cambio ? ['Per coprire il maggior numero possibile di notti, la soluzione prevede anche un cambio di camera:'] : []),
        ...righe,
        `Resterebbe da trovare un'altra sistemazione soltanto per ${scoperte.length === 1 ? 'la notte non disponibile' : 'le notti non disponibili'}, cioè il ${elencoDate(scoperte)}.`,
      ].join('\n\n')
    }
    case 'completo':
      return ''
  }
}

export function bloccoAmelia(sol: Soluzione, amelia: AlternativaAmelia): string {
  const notti = sol.segmenti.reduce((s, x) => s + x.notti, 0)
  return `Visto che si tratta di un soggiorno di ${notti} notti, ci tengo però a indicarle anche un'alternativa. Amelia è la nostra camera più piccola e, per una permanenza più lunga, potrebbe risultare meno comoda. Con ${formattaEuro(amelia.differenzaNotteCentesimi)} in più a notte posso invece proporle la camera ${amelia.camera.name}, una camera matrimoniale più spaziosa. Il prezzo complessivo sarebbe di ${formattaEuro(amelia.prezzoTotaleCentesimi)}.`
}

export function bloccoCondizione(condizione: Condizione, totaleCentesimi: number): string {
  const ore = ORE_RISPOSTA_PROPOSTA
  switch (condizione.tipo) {
    case 'arrivo':
      return `Il pagamento potrà essere effettuato all'arrivo, in contanti oppure tramite bonifico istantaneo.

Se questa soluzione può andare bene per Lei, mi faccia sapere entro ${ore} ore dalla ricezione di questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.

La camera sarà riservata soltanto dopo la conferma definitiva della prenotazione.

Resto a disposizione per qualsiasi informazione.

${FIRMA}`
    case 'caparra':
      return `Se desidera accettare questa proposta, le chiedo di farmelo sapere entro ${ore} ore dalla ricezione del messaggio.

Dopo la sua risposta le invierò il riepilogo della prenotazione con i dati per effettuare il versamento della caparra confirmatoria di ${formattaEuro(condizione.caparraCentesimi)}, pari al ${percentuale(condizione.caparraCentesimi, totaleCentesimi)}% dell'importo complessivo, e terrò la camera a sua disposizione per ${ORE_RISERVA_BONIFICO} ore, in attesa del bonifico. Il restante importo potrà essere saldato all'arrivo, in contanti oppure tramite bonifico istantaneo.

In caso di cancellazione o richiesta di modifica delle date, le chiedo di avvisarmi almeno ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni prima dell'orario previsto di arrivo. Con un preavviso inferiore, oppure in caso di mancato arrivo, la caparra confirmatoria verrà trattenuta e non potrà essere trasferita a un soggiorno successivo.

La prenotazione sarà confermata definitivamente al ricevimento della caparra.

${FIRMA}`
    case 'completo':
      return `Se desidera accettare questa proposta, le chiedo di farmelo sapere entro ${ore} ore dalla ricezione del messaggio.

Dopo la sua risposta le invierò i dati per effettuare il pagamento anticipato dell'intero soggiorno, pari a ${formattaEuro(totaleCentesimi)}, e terrò la camera a sua disposizione per ${ORE_RISERVA_BONIFICO} ore, in attesa del bonifico.

La prenotazione sarà confermata definitivamente al ricevimento del pagamento.

${FIRMA}`
    case 'personalizzata':
      return `${condizione.testo.trim()}\n\n${FIRMA}`
  }
}

// Totale su cui si calcolano caparra e pagamento completo: la soluzione,
// oppure l'alternativa Amelia NON cambia il totale (è solo un'indicazione).
export function generaProposta({ richiesta, soluzione, condizione, amelia }: {
  richiesta: RichiestaTesto & { persone?: number }
  soluzione: Soluzione
  condizione: Condizione | null
  amelia?: AlternativaAmelia | null
}): string {
  if (soluzione.caso === 'completo') return casoE(richiesta.nome)
  const persone = Math.max(1, Number(richiesta.persone) || 1)
  const blocchi = [apertura(richiesta.nome), corpo(richiesta, soluzione, persone)]
  if (amelia) blocchi.push(bloccoAmelia(soluzione, amelia))
  if (condizione) blocchi.push(bloccoCondizione(condizione, centesimiTotale(soluzione)))
  return blocchi.join('\n\n')
}

// Da colonne salvate (richieste.condizione_pagamento …) all'oggetto del generatore
export function condizioneDaColonne(c: { condizione_pagamento?: CondizionePagamento | null; caparra_centesimi?: number | null; condizione_testo?: string | null }): Condizione | null {
  switch (c.condizione_pagamento) {
    case 'arrivo': return { tipo: 'arrivo' }
    case 'caparra': return { tipo: 'caparra', caparraCentesimi: Number(c.caparra_centesimi) || 0 }
    case 'completo': return { tipo: 'completo' }
    case 'personalizzata': return { tipo: 'personalizzata', testo: c.condizione_testo || '' }
    default: return null
  }
}
