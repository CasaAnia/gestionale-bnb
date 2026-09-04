// Testi delle proposte alle richieste — DEFINITIVI, bloccati da Ania il
// 04/09/2026 (pezzo 11; sostituiscono per intero quelli dei pezzi 6 e 9).
// UNICO generatore, puro e componibile: lo usano l'anteprima, il testo che
// parte su WhatsApp, l'immagine e il testo archiviato in proposta_testo.
//
//   generaProposta({ richiesta, soluzione, condizione, amelia, alternative }) → testo
//
// Stile: sempre il Lei; apertura «Gentile [Nome],⏎grazie…»; niente due punti
// nel corpo (solo davanti a un elenco); il nome della camera da solo («è
// disponibile soltanto Ambra»); «un letto in più»; date con l'elisione («dal 4
// all'8», «dal 17 al 21 settembre», «dal 30 settembre al 2 ottobre»); importi
// in centesimi («350 €», «72,50 €»); una riga vuota fra i paragrafi e fra le
// righe con trattino. Le descrizioni brevi stanno in lib/descrizioniCamere.
// Le proposte già inviate restano quelle salvate in proposta_testo.
import { ROOM_SLUG_BY_NAME } from './roomTypes.ts'
import { giorniTra } from './richiesteCalendario.ts'
import { DESCRIZIONI_CAMERE, LETTO_IN_PIU, SITO_CAMERE } from './descrizioniCamere.ts'
import { ORE_RISPOSTA_PROPOSTA, ORE_RISERVA_BONIFICO, GIORNI_PREAVVISO_CANCELLAZIONE, type CondizionePagamento } from './condizioniPrenotazione.ts'
import { personeSegmento, prezziNottiCentesimi, type Soluzione, type SegmentoSoluzione, type AlternativaAmelia } from './richiesteProposta.ts'

export type Condizione =
  | { tipo: 'arrivo' }
  | { tipo: 'caparra'; caparraCentesimi: number }
  | { tipo: 'completo' }
  | { tipo: 'personalizzata'; testo: string }

export type RichiestaTesto = { nome: string; arrivo: string; partenza: string }

export const FIRMA = 'Grazie mille,\nAnia – Casa Ania'
export { SITO_CAMERE }

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

// Prezzo a notte di un segmento, letto compreso, in centesimi (con persone uniformi)
export function centesimiNotte(s: SegmentoSoluzione): number {
  const letto = s.notti > 0 ? Math.round(centesimi(s.lettoTotale) / s.notti) : 0
  return centesimi(s.prezzoNotte) + letto
}
export const centesimiTotale = (sol: Soluzione) => centesimi(sol.prezzoTotale)

// ── Date in italiano, con l'elisione ────────────────────────────────────────
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
// i giorni che si leggono con la vocale davanti: uno, otto, undici, diciotto, ventotto
const ELISI = new Set([1, 8, 11, 18, 28])
export const conPreposizione = (prep: 'dal' | 'al' | 'il' | 'del', g: number): string =>
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

// Nelle righe con trattino e nel dettaglio: solo i giorni («dal 17 al 18») se
// il tratto sta nello stesso mese del periodo richiesto; altrimenti con i mesi
export function dalAlBreve(arrivo: string, partenza: string, periodo: { arrivo: string; partenza: string }): string {
  const A = parti(arrivo), P = parti(partenza), R = parti(periodo.arrivo), Q = parti(periodo.partenza)
  const stessoMese = A.m === P.m && A.a === P.a && R.m === Q.m && R.a === Q.a && A.m === R.m
  if (!stessoMese) return dalAl(arrivo, partenza)
  return `${conPreposizione('dal', A.g)} ${conPreposizione('al', P.g)}`
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
// "la notte del 18 settembre" · "la notte dell'8 settembre" · "le notti del 14 e 15 settembre"
export function notteDel(giorni: string[]): string {
  if (giorni.length === 0) return ''
  const primo = parti(giorni[0]).g
  return `${giorni.length === 1 ? 'la notte' : 'le notti'} ${conPreposizione('del', primo)}${elencoDate(giorni).slice(String(primo).length)}`
}

export const nottiTesto = (n: number) => (n === 1 ? '1 notte' : `${n} notti`)
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const PAROLE = ['', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci']
const inParole = (n: number) => PAROLE[n] ?? String(n)
// «per le 4 notti» · «per la notte»
const perLeNotti = (n: number) => (n === 1 ? 'per la notte' : `per le ${n} notti`)

// ── Camere: descrizioni brevi e link ────────────────────────────────────────
const slugDi = (camera: { name?: string | null }) => (camera.name ? ROOM_SLUG_BY_NAME[camera.name] : undefined)
export function descrizioneBreve(camera: { name?: string | null }): string {
  const slug = slugDi(camera)
  return (slug && DESCRIZIONI_CAMERE[slug]?.breve) || 'una camera'
}
export function tipoCamera(camera: { name?: string | null }): string {
  const slug = slugDi(camera)
  return (slug && DESCRIZIONI_CAMERE[slug]?.tipo) || 'una camera'
}
export function rigaLinkCamera(camera: { name?: string | null }): string | null {
  const slug = slugDi(camera)
  return slug ? `Qui può vedere le foto e i dettagli della camera: ${SITO_CAMERE}/${slug}` : null
}
export const RIGA_LINK_CAMERE = `Qui può vedere le foto e i dettagli delle camere: ${SITO_CAMERE}`
// Una camera sola → la sua pagina; più camere → la pagina delle camere
function rigaLink(sol: Soluzione): string | null {
  const camere = [...new Set(sol.segmenti.map(s => s.camera.id))]
  if (camere.length === 1) return rigaLinkCamera(sol.segmenti[0].camera)
  return camere.length > 1 ? RIGA_LINK_CAMERE : null
}

// ── Gruppi di notti (persone e prezzo uguali, consecutive) ──────────────────
type Gruppo = { da: number; a: number; notti: number; persone: number; prezzo: number }
function gruppiNotti(s: SegmentoSoluzione): Gruppo[] {
  const persone = personeSegmento(s)
  const prezzi = prezziNottiCentesimi(s)
  const out: Gruppo[] = []
  persone.forEach((p, i) => {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.persone === p && ultimo.prezzo === prezzi[i]) { ultimo.a = i; ultimo.notti++ }
    else out.push({ da: i, a: i, notti: 1, persone: p, prezzo: prezzi[i] })
  })
  return out
}
const prezzoUniforme = (s: SegmentoSoluzione): number | null => {
  const prezzi = prezziNottiCentesimi(s)
  return prezzi.every(p => p === prezzi[0]) ? prezzi[0] : null
}

// Dettaglio per notte in italiano parlato (caso A), oppure null se non varia:
// «La prima notte in due a 80 €, le altre tre notti in tre a 90 € a notte.»
// Fino a tre gruppi: prima/prime, seguente/i, altre/ultime; oltre, le date.
export function dettaglioParlato(s: SegmentoSoluzione, periodo: { arrivo: string; partenza: string }): string | null {
  const gruppi = gruppiNotti(s)
  if (gruppi.length <= 1) return null
  const giorni = giorniTra(s.arrivo, s.partenza)
  const inA = (g: Gruppo) => `in ${inParole(g.persone)} a ${formattaEuro(g.prezzo)}`
  let pezzi: string[]
  if (gruppi.length > 3) {
    pezzi = gruppi.map(g => `${dalAlBreve(giorni[g.da], g.a + 1 < giorni.length ? giorni[g.a + 1] : s.partenza, periodo)} ${inA(g)}`)
  } else {
    pezzi = gruppi.map((g, k) => {
      const ultimo = k === gruppi.length - 1
      const etichetta = k === 0
        ? (g.notti === 1 ? 'la prima notte' : `le prime ${inParole(g.notti)} notti`)
        : ultimo
          ? (g.notti === 1 ? "l'ultima notte" : `le ${gruppi.length === 2 ? 'altre' : 'ultime'} ${inParole(g.notti)} notti`)
          : (g.notti === 1 ? 'la notte seguente' : `le ${inParole(g.notti)} notti seguenti`)
      return `${etichetta} ${inA(g)}`
    })
  }
  return `${maiuscola(pezzi.join(', '))} a notte.`
}

// Frase del letto in più (caso A): solo se in qualche notte il letto serve
export function fraseLettoInPiu(s: SegmentoSoluzione): string | null {
  const letto = s.lettoNotti ?? []
  if (letto.length === 0) return null
  const giorni = giorniTra(s.arrivo, s.partenza)
  const persone = personeSegmento(s)
  const indici = letto.map(g => giorni.indexOf(g)).filter(i => i >= 0)
  const p = inParole(Math.max(...indici.map(i => persone[i])))
  if (indici.length === 1) {
    const i = indici[0]
    const quando = i === 0 ? 'la prima notte' : i === giorni.length - 1 ? "l'ultima notte" : notteDel([giorni[i]])
    return `Per ${quando}, in cui sarete in ${p}, posso aggiungere ${LETTO_IN_PIU}.`
  }
  return `Per le notti in cui sarete in ${p} posso aggiungere ${LETTO_IN_PIU}.`
}

// Prezzo della riga con trattino (casi B e C): «80 € a notte», oppure per
// gruppi «in due a 80 € a notte, poi in tre a 90 € a notte»
function prezzoRiga(gruppi: Gruppo[]): string {
  if (gruppi.every(g => g.prezzo === gruppi[0].prezzo && g.persone === gruppi[0].persone)) return `${formattaEuro(gruppi[0].prezzo)} a notte`
  const personeVariano = gruppi.some(g => g.persone !== gruppi[0].persone)
  return gruppi.map(g => `${personeVariano ? `in ${inParole(g.persone)} ` : ''}a ${formattaEuro(g.prezzo)} a notte`).join(', poi ')
}
// «in Amelia, una singola, con un letto in più»
function camereRiga(s: SegmentoSoluzione): string {
  const letto = (s.lettoNotti ?? []).length > 0 ? `, con ${LETTO_IN_PIU}` : ''
  return `in ${s.camera.name}, ${tipoCamera(s.camera)}${letto}`
}
const rigaSegmento = (s: SegmentoSoluzione, periodo: { arrivo: string; partenza: string }) =>
  `– ${dalAlBreve(s.arrivo, s.partenza, periodo)} ${camereRiga(s)}: ${prezzoRiga(gruppiNotti(s))}`

// «Il prezzo per le 4 notti è di 350 €.» + dettaglio, oppure «…, a 80 € a notte.»
function paragrafoPrezzo(sol: Soluzione, s: SegmentoSoluzione, periodo: { arrivo: string; partenza: string }): string {
  const base = `Il prezzo ${perLeNotti(s.notti)} è di ${formattaEuro(centesimiTotale(sol))}`
  const dettaglio = dettaglioParlato(s, periodo)
  if (dettaglio) return `${base}. ${dettaglio}`
  const uniforme = prezzoUniforme(s)
  if (s.notti > 1 && uniforme !== null) return `${base}, a ${formattaEuro(uniforme)} a notte.`
  return `${base}.`
}

// ── Blocchi del messaggio ───────────────────────────────────────────────────
export function apertura(nome: string): string {
  return `Gentile ${nome.trim()},\ngrazie per aver pensato a Casa Ania per il suo soggiorno.`
}
const HO_VERIFICATO = 'Ho verificato le date che mi ha indicato.'

export function casoE(richiesta: RichiestaTesto): string {
  return `${apertura(richiesta.nome)}

${HO_VERIFICATO} Purtroppo ${dalAl(richiesta.arrivo, richiesta.partenza)} siamo al completo e non ho una soluzione da poterle proporre.

Mi dispiace davvero. Spero di poterla accogliere in un'altra occasione.

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

type Blocchi = { paragrafi: string[]; oreVariante: 'camera' | 'camere' | 'nessuna' }

function casoA(richiesta: RichiestaTesto, camere: Soluzione[]): Blocchi {
  const periodo = { arrivo: richiesta.arrivo, partenza: richiesta.partenza }
  const testa = `${HO_VERIFICATO} ${maiuscola(dalAl(richiesta.arrivo, richiesta.partenza))}`
  if (camere.length === 1) {
    const s = camere[0].segmenti[0]
    const letto = fraseLettoInPiu(s)
    const link = rigaLinkCamera(s.camera)
    return {
      oreVariante: 'camera',
      paragrafi: [
        `${testa} è disponibile soltanto ${s.camera.name}, ${descrizioneBreve(s.camera)}.${letto ? ` ${letto}` : ''}`,
        paragrafoPrezzo(camere[0], s, periodo),
        ...(link ? [link] : []),
      ],
    }
  }
  const righe = camere.map(c => {
    const s = c.segmenti[0]
    const letto = fraseLettoInPiu(s)
    const link = rigaLinkCamera(s.camera)
    return `– ${s.camera.name}, ${descrizioneBreve(s.camera)}.${letto ? ` ${letto}` : ''} ${paragrafoPrezzo(c, s, periodo)}${link ? `\n${link}` : ''}`
  })
  return {
    oreVariante: 'camere',
    paragrafi: [`${testa} ho ${inParole(camere.length)} camere libere che posso proporle:`, ...righe],
  }
}

function casoB(richiesta: RichiestaTesto, sol: Soluzione): Blocchi {
  const periodo = { arrivo: richiesta.arrivo, partenza: richiesta.partenza }
  const cambi = sol.segmenti.length - 1
  const link = rigaLink(sol)
  return {
    oreVariante: 'nessuna',
    paragrafi: [
      `${HO_VERIFICATO} ${maiuscola(dalAl(richiesta.arrivo, richiesta.partenza))} non ho una camera libera per tutto il periodo, ma posso ospitarla comunque con ${cambi > 1 ? 'qualche cambio' : 'un cambio'} di camera durante il soggiorno:`,
      ...sol.segmenti.map(s => rigaSegmento(s, periodo)),
      `Il cambio di camera lo faccio io al mattino, non deve pensare a nulla. Il prezzo ${perLeNotti(sol.nottiCoperte)} è di ${formattaEuro(centesimiTotale(sol))}.`,
      ...(link ? [link] : []),
    ],
  }
}

function casoC(richiesta: RichiestaTesto, sol: Soluzione): Blocchi {
  const periodo = { arrivo: richiesta.arrivo, partenza: richiesta.partenza }
  const scoperte = nottiScoperte(richiesta, sol)
  const camere = [...new Set(sol.segmenti.map(s => s.camera.id))]
  let righe: string[]
  if (camere.length === 1) {
    // stessa camera: UNA riga sola, i tratti uniti con «e»; i gruppi di prezzo su tutte le notti coperte
    const unito: SegmentoSoluzione = {
      ...sol.segmenti[0], notti: sol.nottiCoperte,
      personeNotti: sol.segmenti.flatMap(s => personeSegmento(s)),
      prezziNottiCentesimi: sol.segmenti.flatMap(s => prezziNottiCentesimi(s)),
      lettoNotti: sol.segmenti.flatMap(s => s.lettoNotti ?? []),
    }
    righe = [`– ${sol.segmenti.map(s => dalAlBreve(s.arrivo, s.partenza, periodo)).join(' e ')} ${camereRiga(unito)}: ${prezzoRiga(gruppiNotti(unito))}`]
  } else {
    righe = sol.segmenti.map(s => rigaSegmento(s, periodo))
  }
  const link = rigaLink(sol)
  const nottiCoperte = sol.nottiCoperte
  return {
    oreVariante: 'nessuna',
    paragrafi: [
      `${HO_VERIFICATO} Purtroppo per ${notteDel(scoperte)} siamo al completo, ma posso ospitarla per il resto del soggiorno:`,
      ...righe,
      ...(camere.length > 1 ? ['Il cambio di camera lo faccio io al mattino, non deve pensare a nulla.'] : []),
      `Mi dispiace per ${notteDel(scoperte)}, per ${scoperte.length === 1 ? 'la quale' : 'le quali'} dovrebbe trovare un'altra soluzione nelle vicinanze. Sarei comunque felice di ospitarla per ${nottiCoperte === 1 ? "l'altra notte" : `le altre ${nottiCoperte} notti`}, al prezzo di ${formattaEuro(centesimiTotale(sol))}.`,
      ...(link ? [link] : []),
    ],
  }
}

// Blocco Amelia (pezzo 6, riscritto nello stile del pezzo 11)
export function bloccoAmelia(sol: Soluzione, amelia: AlternativaAmelia): string {
  const notti = sol.segmenti.reduce((s, x) => s + x.notti, 0)
  return `Visto che si tratta di un soggiorno di ${notti} notti, le segnalo anche un'alternativa. Amelia è la nostra camera più piccola e per una permanenza più lunga potrebbe risultare meno comoda. Con ${formattaEuro(amelia.differenzaNotteCentesimi)} in più a notte posso proporle ${amelia.camera.name}, ${descrizioneBreve(amelia.camera)}. Il prezzo per le ${notti} notti sarebbe di ${formattaEuro(amelia.prezzoTotaleCentesimi)}.`
}

export function bloccoCondizione(condizione: Condizione, totaleCentesimi: number): string {
  switch (condizione.tipo) {
    case 'arrivo':
      return `Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.`
    case 'caparra':
      return `Per confermare la prenotazione le chiedo una caparra di ${formattaEuro(condizione.caparraCentesimi)}, pari al ${percentuale(condizione.caparraCentesimi, totaleCentesimi)}% del totale, da versare con bonifico. Dopo la sua risposta le invierò i dati per il bonifico e terrò la camera a sua disposizione per ${ORE_RISERVA_BONIFICO} ore. Il saldo si paga all'arrivo, alla consegna delle chiavi, in contanti oppure con bonifico istantaneo.

In caso di cancellazione o cambio di date, la prego di avvisarmi almeno ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni prima dell'arrivo. Con un preavviso inferiore, o in caso di mancato arrivo, la caparra verrà trattenuta.

La prenotazione sarà confermata definitivamente al ricevimento della caparra.`
    case 'completo':
      return `Per confermare la prenotazione le chiedo il pagamento anticipato dell'intero soggiorno, ${formattaEuro(totaleCentesimi)}, con bonifico. Dopo la sua risposta le invierò i dati per il bonifico e terrò la camera a sua disposizione per ${ORE_RISERVA_BONIFICO} ore.

In caso di cancellazione con almeno ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni di preavviso le restituisco l'intero importo. Con un preavviso inferiore, o in caso di mancato arrivo, l'importo non viene restituito. Se invece ha bisogno di spostare le date, la prenotazione si può trasferire a un altro periodo, in base alla disponibilità.

La prenotazione sarà confermata definitivamente al ricevimento del pagamento.`
    case 'personalizzata':
      return condizione.testo.trim()
  }
}

// La frase delle 3 ore, nelle tre varianti
export function fraseTreOre(variante: 'camera' | 'camere' | 'nessuna'): string {
  const cosa = variante === 'camera' ? 'confermare la camera' : variante === 'camere' ? 'confermare una delle camere' : 'confermare'
  return `Se desidera ${cosa}, la prego di farmelo sapere entro ${ORE_RISPOSTA_PROPOSTA} ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.`
}
export const CHIUSURA = `Resto a disposizione per qualsiasi informazione.\n\n${FIRMA}`

// Ordine dei paragrafi (A–C): apertura → caso (→ prezzo → link) → [Amelia]
// → condizione → 3 ore → chiusura; senza condizione il testo si ferma dopo
// il caso (e l'eventuale blocco Amelia). Caso E: messaggio intero a sé.
export function generaProposta({ richiesta, soluzione, condizione, amelia, alternative }: {
  richiesta: RichiestaTesto & { persone?: number; persone_per_notte?: number[] | null }
  soluzione: Soluzione
  condizione: Condizione | null
  amelia?: AlternativaAmelia | null
  alternative?: Soluzione[] | null
}): string {
  if (soluzione.caso === 'completo') return casoE(richiesta)
  const camereA = camereDelCasoA(soluzione, alternative)
  const blocchi: Blocchi = soluzione.caso === 'completa' ? casoA(richiesta, camereA)
    : soluzione.caso === 'cambio' ? casoB(richiesta, soluzione)
      : casoC(richiesta, soluzione)
  const paragrafi = [apertura(richiesta.nome), ...blocchi.paragrafi]
  if (amelia && camereA.length === 1) paragrafi.push(bloccoAmelia(soluzione, amelia))
  if (condizione) paragrafi.push(bloccoCondizione(condizione, centesimiTotale(soluzione)), fraseTreOre(blocchi.oreVariante), CHIUSURA)
  return paragrafi.join('\n\n')
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
