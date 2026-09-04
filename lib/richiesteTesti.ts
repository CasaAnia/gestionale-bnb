// Testi delle proposte alle richieste (pezzi 6 e 9): UNICO generatore, puro e
// componibile. Lo usano l'anteprima, il testo che parte su WhatsApp, l'immagine
// e il testo archiviato in richieste.proposta_testo. Nessuna copia altrove.
//
//   generaProposta({ richiesta, soluzione, condizione, amelia, alternative }) → testo
//
// Regole fisse: sempre del Lei, apertura con «Gentile», tono caldo e diretto,
// righe vuote fra camere o periodi diversi. La proposta NON è una prenotazione:
// nei casi A–C il cliente ha ORE_RISPOSTA_PROPOSTA ore per rispondere, nel
// caso E nessun limite. Le condizioni di pagamento le sceglie Ania per ogni
// richiesta (mai preselezionate): senza condizione il testo si ferma prima
// della chiusura. Amelia è la camera più piccola; solo Allegra ha il balconcino.
// Importi sempre in centesimi (interi), mai float; formattazione italiana
// «1.234,50 €», senza decimali quando sono zero («140 €»).
// Pezzo 9: date con l'elisione («dal 4 all'8 settembre»), link della pagina
// della camera sul sito, caso A con una o più camere libere, riga «Nel
// dettaglio» quando le persone cambiano da una notte all'altra.
// Le proposte già inviate restano quelle salvate in proposta_testo.
import { ROOM_TYPE_BY_NAME, ROOM_SLUG_BY_NAME, bagnoDesc } from './roomTypes.ts'
import { capienzaBase, tariffaCamera } from './tariffe.ts'
import { giorniTra } from './richiesteCalendario.ts'
import { ORE_RISPOSTA_PROPOSTA, ORE_RISERVA_BONIFICO, GIORNI_PREAVVISO_CANCELLAZIONE, type CondizionePagamento } from './condizioniPrenotazione.ts'
import { personeSegmento, prezziNottiCentesimi, personeMassime, personeUniformi, type Soluzione, type SegmentoSoluzione, type AlternativaAmelia } from './richiesteProposta.ts'

export type Condizione =
  | { tipo: 'arrivo' }
  | { tipo: 'caparra'; caparraCentesimi: number }
  | { tipo: 'completo' }
  | { tipo: 'personalizzata'; testo: string }

export type RichiestaTesto = { nome: string; arrivo: string; partenza: string }

export const FIRMA = 'Grazie mille,\nAnia – Casa Ania'
export const SITO_CAMERE = 'casaaniarozzano.it/camere'

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
// (con persone uniformi; con persone variabili vale la riga «Nel dettaglio»)
export function centesimiNotte(s: SegmentoSoluzione): number {
  const letto = s.notti > 0 ? Math.round(centesimi(s.lettoTotale) / s.notti) : 0
  return centesimi(s.prezzoNotte) + letto
}
export const centesimiTotale = (sol: Soluzione) => centesimi(sol.prezzoTotale)

// ── Date in italiano, con l'elisione ────────────────────────────────────────
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
// i giorni che si leggono con la vocale davanti: uno, otto, undici, diciotto, ventotto
const ELISI = new Set([1, 8, 11, 18, 28])
export const conPreposizione = (prep: 'dal' | 'al' | 'il', g: number): string =>
  ELISI.has(g) ? `${prep === 'il' ? '' : prep}l'${g}` : `${prep} ${g}`

function parti(iso: string) { const [a, m, g] = iso.split('-').map(Number); return { a, m, g } }

// "13 settembre" · con anno se richiesto
export function dataLunga(iso: string, conAnno = false): string {
  const { a, m, g } = parti(iso)
  return `${g} ${MESI[m - 1]}${conAnno ? ` ${a}` : ''}`
}

// "dal 13 al 15 settembre" · "dal 4 all'8 settembre" · "dall'8 al 10 settembre"
// "dal 30 settembre al 2 ottobre" · "dal 30 dicembre 2026 al 2 gennaio 2027"
export function dalAl(arrivo: string, partenza: string): string {
  const A = parti(arrivo), P = parti(partenza)
  const dal = conPreposizione('dal', A.g), al = conPreposizione('al', P.g)
  if (A.a !== P.a) return `${dal} ${MESI[A.m - 1]} ${A.a} ${al} ${MESI[P.m - 1]} ${P.a}`
  if (A.m !== P.m) return `${dal} ${MESI[A.m - 1]} ${al} ${MESI[P.m - 1]}`
  return `${dal} ${al} ${MESI[A.m - 1]}`
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
// "il 14 settembre" · "l'8 settembre" · "il 14 e 15 settembre"
export const elencoDateConArticolo = (giorni: string[]): string =>
  giorni.length === 0 ? '' : `${conPreposizione('il', parti(giorni[0]).g)}${elencoDate(giorni).slice(String(parti(giorni[0]).g).length)}`

export const nottiTesto = (n: number) => (n === 1 ? '1 notte' : `${n} notti`)
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAROLE = ['', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei']
const inParole = (n: number) => PAROLE[n] ?? String(n)

// ── Descrizione della camera, dai dati ──────────────────────────────────────
// "singola con bagno privato, all'interno della camera"
// "matrimoniale con balconcino e bagno privato, all'interno della camera" (solo Allegra)
// "singola con aggiunta del secondo letto e bagno privato, all'interno della camera"
const ORDINALI = ['', 'primo', 'secondo', 'terzo', 'quarto']
const ordinaleLetto = (camera: SegmentoSoluzione['camera']) => ORDINALI[camera.name === 'Lena' ? 4 : capienzaBase(camera) + 1]
export function descrizioneCamera(camera: SegmentoSoluzione['camera'], persone: number): string {
  const nome = camera.name || ''
  const tipo = (ROOM_TYPE_BY_NAME[nome] || 'camera').toLowerCase()
  const pezzi: string[] = []
  if (nome === 'Allegra') pezzi.push('balconcino')
  const { lettoAddebitato } = tariffaCamera(camera, persone)
  // Amelia: secondo letto · Allegra/Ambra: terzo · Lena (tripla): quarto
  if (lettoAddebitato) pezzi.push(`aggiunta del ${ordinaleLetto(camera)} letto`)
  const bagno = bagnoDesc(camera)
  if (bagno) pezzi.push(`bagno ${bagno}`)
  if (pezzi.length === 0) return tipo
  return `${tipo} con ${pezzi.length === 1 ? pezzi[0] : `${pezzi.slice(0, -1).join(', ')} e ${pezzi[pezzi.length - 1]}`}`
}

// Link della pagina della camera sul sito (mappa già usata per le richieste
// web); senza pagina niente riga
export function rigaLinkCamera(camera: { name?: string | null }): string | null {
  const slug = camera.name ? ROOM_SLUG_BY_NAME[camera.name] : undefined
  return slug ? `Qui può vedere le foto e i dettagli della camera: ${SITO_CAMERE}/${slug}` : null
}

// «Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in
// una a 70 € a notte.» — solo quando le persone cambiano da una notte all'altra
export function dettaglioPersone(s: SegmentoSoluzione): string | null {
  const persone = personeSegmento(s)
  if (personeUniformi(persone)) return null
  const prezzi = prezziNottiCentesimi(s)
  const giorni = giorniTra(s.arrivo, s.partenza)
  const letto = new Set(s.lettoNotti ?? [])
  const gruppi: { persone: number; prezzo: number; letto: boolean; notti: number }[] = []
  persone.forEach((p, i) => {
    const conLetto = letto.has(giorni[i])
    const g = gruppi.find(x => x.persone === p && x.prezzo === prezzi[i] && x.letto === conLetto)
    if (g) g.notti++
    else gruppi.push({ persone: p, prezzo: prezzi[i], letto: conLetto, notti: 1 })
  })
  return `Nel dettaglio: ${gruppi.map(g =>
    `${g.notti} ${g.notti === 1 ? 'notte' : 'notti'} in ${inParole(g.persone)}${g.letto ? ` con ${ordinaleLetto(s.camera)} letto` : ''} a ${formattaEuro(g.prezzo)} a notte`,
  ).join(', ')}.`
}

// "– dal 13 al 14 settembre, nella camera Amelia, singola con …, al prezzo di 70 € a notte"
// (con persone variabili: prezzo complessivo del periodo e riga «nel dettaglio»)
function rigaSegmento(s: SegmentoSoluzione): string {
  const persone = personeSegmento(s)
  const testa = `– ${dalAl(s.arrivo, s.partenza)}, nella camera ${s.camera.name}, ${descrizioneCamera(s.camera, personeMassime(persone))}`
  const dettaglio = dettaglioPersone(s)
  if (!dettaglio) return `${testa}, al prezzo di ${formattaEuro(centesimiNotte(s))} a notte`
  return `${testa}, al prezzo complessivo di ${formattaEuro(centesimi(s.totale))} per ${nottiTesto(s.notti)} (${dettaglio.charAt(0).toLowerCase()}${dettaglio.slice(1, -1)})`
}

// ── Blocchi del messaggio ───────────────────────────────────────────────────
export function apertura(nome: string): string {
  return `Gentile ${nome.trim()},\ngrazie per aver pensato a Casa Ania per il suo soggiorno.`
}
export const INTRO_SOLUZIONE = 'Ho appena verificato la disponibilità per le date che mi ha indicato e posso proporle questa soluzione:'

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

// Le soluzioni da elencare nel caso A: la scelta più tutte le altre
// «completa» (una per camera libera), senza doppioni
export function camereDelCasoA(soluzione: Soluzione, alternative?: Soluzione[] | null): Soluzione[] {
  if (soluzione.caso !== 'completa') return [soluzione]
  const out = [soluzione]
  for (const a of alternative ?? []) {
    if (a.caso === 'completa' && a.segmenti.length === 1 && !out.some(x => x.segmenti[0].camera.id === a.segmenti[0].camera.id)) out.push(a)
  }
  return out
}

const fraseNotti = (n: number) => (n === 1 ? 'la notte' : `le ${n} notti`)

// Pezzo 10: nella composizione manuale (B e C) il link di ogni camera usata,
// una volta sola per camera, come blocco dopo le righe dei segmenti. Le
// soluzioni automatiche B e C restano senza link (testi bloccati dal pezzo 9).
function linkCamere(sol: Soluzione): string[] {
  if (!sol.manuale) return []
  const visti = new Set<string>()
  const righe: string[] = []
  for (const s of sol.segmenti) {
    if (visti.has(s.camera.id)) continue
    visti.add(s.camera.id)
    const link = rigaLinkCamera(s.camera)
    if (link) righe.push(link)
  }
  return righe.length ? [righe.join('\n')] : []
}

function casoA(richiesta: { arrivo: string; partenza: string }, camere: Soluzione[]): string {
  const periodo = dalAl(richiesta.arrivo, richiesta.partenza)
  if (camere.length === 1) {
    const s = camere[0].segmenti[0]
    const dettaglio = dettaglioPersone(s)
    const link = rigaLinkCamera(s.camera)
    return `Ho verificato le date che mi ha indicato: ${periodo} è disponibile soltanto la camera ${s.camera.name}, ${descrizioneCamera(s.camera, personeMassime(personeSegmento(s)))}. Il prezzo per ${fraseNotti(s.notti)} è di ${formattaEuro(centesimiTotale(camere[0]))}.${dettaglio ? ` ${dettaglio}` : ''}${link ? `\n${link}` : ''}`
  }
  const righe = camere.map(c => {
    const s = c.segmenti[0]
    const dettaglio = dettaglioPersone(s)
    const link = rigaLinkCamera(s.camera)
    return `– ${s.camera.name}, ${descrizioneCamera(s.camera, personeMassime(personeSegmento(s)))}: ${formattaEuro(centesimiTotale(c))} per ${fraseNotti(s.notti)}.${dettaglio ? ` ${dettaglio}` : ''}${link ? `\n${link}` : ''}`
  })
  return `Ho verificato le date che mi ha indicato: ${periodo} ho ${inParole(camere.length)} camere libere che posso proporle:\n${righe.join('\n')}`
}

export function corpo(richiesta: { arrivo: string; partenza: string }, sol: Soluzione, alternative?: Soluzione[] | null): string {
  switch (sol.caso) {
    case 'completa':
      return casoA(richiesta, camereDelCasoA(sol, alternative))
    case 'cambio': {
      // uno o più cambi (pezzo 10): una riga per segmento, «;» fra le righe e «.» alla fine
      const righe = sol.segmenti.map((s, i) => `${rigaSegmento(s)}${i === sol.segmenti.length - 1 ? '.' : ';'}`)
      return [
        INTRO_SOLUZIONE,
        `Per tutto il periodo, ${dalAl(richiesta.arrivo, richiesta.partenza)}, posso ospitarla prevedendo un cambio di camera durante il soggiorno:`,
        ...righe,
        ...linkCamere(sol),
      ].join('\n\n')
    }
    case 'manca_mezzo':
    case 'manca_estremo': {
      const scoperte = nottiScoperte(richiesta, sol)
      const cambio = new Set(sol.segmenti.map(s => s.camera.id)).size > 1
      const righe = sol.segmenti.map((s, i) => `${rigaSegmento(s)}${i === sol.segmenti.length - 1 ? '.' : ';'}`)
      return [
        INTRO_SOLUZIONE,
        `Per l'intero periodo non ho purtroppo una soluzione continuativa, ma posso ospitarla per la maggior parte del soggiorno.`,
        ...(cambio ? ['Per coprire il maggior numero possibile di notti, la soluzione prevede anche un cambio di camera:'] : []),
        ...righe,
        `Resterebbe da trovare un'altra sistemazione soltanto per ${scoperte.length === 1 ? 'la notte non disponibile' : 'le notti non disponibili'}, cioè ${elencoDateConArticolo(scoperte)}.`,
        ...linkCamere(sol),
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

export function bloccoCondizione(condizione: Condizione, totaleCentesimi: number, piuCamere = false): string {
  const ore = ORE_RISPOSTA_PROPOSTA
  switch (condizione.tipo) {
    case 'arrivo':
      return `Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.

Se desidera confermare ${piuCamere ? 'una delle camere' : 'la camera'}, la prego di farmelo sapere entro ${ore} ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.

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

// Totale su cui si calcolano caparra e pagamento completo: la soluzione
// scelta; l'alternativa Amelia NON cambia il totale (è solo un'indicazione).
// `alternative` (pezzo 9): nel caso A le altre camere libere da elencare;
// con più camere il blocco Amelia non ha senso (le alternative sono già lì).
export function generaProposta({ richiesta, soluzione, condizione, amelia, alternative }: {
  richiesta: RichiestaTesto & { persone?: number; persone_per_notte?: number[] | null }
  soluzione: Soluzione
  condizione: Condizione | null
  amelia?: AlternativaAmelia | null
  alternative?: Soluzione[] | null
}): string {
  if (soluzione.caso === 'completo') return casoE(richiesta.nome)
  const camereA = camereDelCasoA(soluzione, alternative)
  const piuCamere = camereA.length > 1
  const blocchi = [apertura(richiesta.nome), corpo(richiesta, soluzione, alternative)]
  if (amelia && !piuCamere) blocchi.push(bloccoAmelia(soluzione, amelia))
  if (condizione) blocchi.push(bloccoCondizione(condizione, centesimiTotale(soluzione), piuCamere))
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
