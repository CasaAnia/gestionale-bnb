// ============================================================================
// IL CONTENUTO DEL RIQUADRO DEL DITO PREMUTO (versione D, approvata da Ania il
// 02/10/2026) — la parte pura. Il riquadro: components/calendario/RiquadroPremuto.
//
//   AMBRA · DA INCASSARE                       occhiello: camera · testoStato
//   Susanna Massarenti                         nomeCompleto
//   +39 351 222 4410                           se c'è
//   DA FARE   preparare il letto in più …      solo se c'è almeno una voce (lib/daFarePrenotazione)
//   OSPITI    28 set. · 2 persone              solo se gli ospiti cambiano durante il soggiorno
//             29–30 set. · 1 persona
//   ARRIVO    lun 28 set · 15:00 · autonomo · bagagli alle 11:00   (o «da chiedere» in grigio)
//   PARTENZA  gio 1 ott · 10:30                                    (o «da chiedere» in grigio)
//   CONTO     240 € · acconto 120 € con bonifico · restano 120 €   («restano» in grigio)
//   CLIENTE   già ospite 3 volte · Google · 760 €                  (la cifra della scheda)
//   NOTE      vuole il cuscino basso                               se ci sono, in mattone
//
// Bagagli: `bagagli_alle` è l'ora in cui il cliente lascia i bagagli PRIMA
// dell'arrivo (foglio «Bagagli e partenza»), quindi sta nella riga Arrivo, e
// solo se c'è; la riga Partenza non parla di bagagli (Ania, 02/10/2026).
// Cliente: le parole neutre della scheda, «già ospite 3 volte» / «prima
// volta», mai «già stata/o» (Ania, 18/09/2026 e 02/10/2026).
//
// Le stesse funzioni della scheda e del vecchio foglietto: qui si compongono
// soltanto. Niente React, niente Supabase: `oggi` arriva dal chiamante.
// ============================================================================
import { caselleSoggiorno, euroScheda, segmentiAttivi, TITOLO_CONTO_NON_LEGGIBILE, type SegmentoScheda } from './schedaPrenotazione.ts'
import { contoPrenotazione, accordoPrenotazione, type RigaPrenotazione } from './prenotazioneUnica.ts'
import { riepilogoConto } from './schedaConto.ts'
import { arriviDeiPeriodi } from './arriviPeriodi.ts'
import { arrivoDaMostrare, cameraCorta } from './calendarioFoglietto.ts'
import { leggiArrivo, orarioIgnoto } from './arrivo.ts'
import { rigaArrivo, statoScheda, testoStato } from './calendarioSchede.ts'
import { catenePrenotazione, giornoBreve, type RigaOrari } from './bagagliPartenza.ts'
import { periodoOspitiTesto } from './ospitiSoggiorno.ts'
import { chiEIlCliente } from './clienteCheTorna.ts'
import { provenienzaInParole } from './provenienza.ts'
import { vuoleRicevuta } from './valutazione.ts'
import { nottiLettoExtra } from './lettiAggiuntivi.ts'
import { nomeCompleto, nomeOspite } from './guestName.ts'
import { telefonoPerEsteso } from './whatsapp.ts'
import { daFarePrenotazione, type VoceDaFare } from './daFarePrenotazione.ts'

export const DA_CHIEDERE = 'da chiedere'

/** Un pezzo di valore: normale, in grassetto (Cormorant) o in grigio */
export type PezzoRiquadro = { testo: string; tipo?: 'b' | 'gr' }
export type EtichettaRiquadro = 'Ospiti' | 'Arrivo' | 'Partenza' | 'Conto' | 'Cliente' | 'Note'
/** Una riga: le sue «linee» (Ospiti ne ha una per periodo, le altre una sola) */
export type RigaRiquadro = { etichetta: EtichettaRiquadro; linee: PezzoRiquadro[][] }
export type ContenutoRiquadro = { occhiello: string; titolo: string; telefono: string; daFare: VoceDaFare[]; righe: RigaRiquadro[] }

type Cliente = { full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null; provenienza?: string | null; struttura_nome?: string | null } | null
export type RigaRiquadroDati = SegmentoScheda & RigaPrenotazione & RigaOrari & {
  guest_name?: string | null; notes?: string | null; pagato?: boolean | null; bonifico?: boolean | null; color?: string | null; source?: string | null
  extra_bed?: boolean | null; extra_bed_dates?: string[] | null; accordo_pagamento?: string | null
  provenienza?: string | null; struttura_nome?: string | null
  guests?: Cliente
  rooms?: { name?: string | null } | null
  [colonna: string]: unknown
}

export type DatiRiquadro = {
  /** la scheda premuta (anche una barra unita di lib/barreSoggiorno) */
  premuta: RigaRiquadroDati
  /** il nome della camera della scheda premuta, come sul calendario */
  camera: string | null | undefined
  /** le notti della scheda premuta già coperte dagli acconti: −1 = tutte (il verde del calendario) */
  coperte: number | undefined
  /** TUTTE le righe della prenotazione (chiavePrenotazione), anche quelle annullate col mancato arrivo, con la camera */
  righe: RigaRiquadroDati[]
  /** i pagamenti delle sue righe, interi (regola fissa n. 9) */
  pagamenti: { booking_id: string; amount: number | string; method?: string | null }[]
  /** i cambi camera della catena (legami.poiCamera) */
  cambi: { giorno: string; camera: string }[]
  /** soggiorni conclusi della stessa persona fuori da questa prenotazione */
  volte: number
  /** quanto ha speso il cliente, questa compresa (spesoPerBooking del calendario); null = niente cifra */
  spesoCent: number | null
  oggi: string
}

const piuUno = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
const minuscolaIniziale = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const persone = (n: number) => `${n} ${n === 1 ? 'persona' : 'persone'}`

/**
 * I periodi in cui cambia il numero di persone, con lo stesso testo della
 * scheda e dell'immagine di conferma (periodoOspitiTesto, notti incluse:
 * «11 ott.», «12–17 ott.»). null quando il numero non cambia mai.
 */
export function ospitiRiquadro(attive: SegmentoScheda[], oggi: string): PezzoRiquadro[][] | null {
  const caselle = caselleSoggiorno(attive, oggi)
  const periodi: { arrivo: string; partenza: string; persone: number }[] = []
  for (const c of caselle) {
    const ultimo = periodi.at(-1)
    if (ultimo && ultimo.persone === c.persone && ultimo.partenza === c.iso) ultimo.partenza = piuUno(c.iso)
    else periodi.push({ arrivo: c.iso, partenza: piuUno(c.iso), persone: c.persone })
  }
  if (periodi.length < 2 || new Set(periodi.map(p => p.persone)).size < 2) return null
  return periodi.map(p => [{ testo: periodoOspitiTesto(p, true), tipo: 'b' }, { testo: ` · ${persone(p.persone)}` }])
}

const conMetodo = (m: string | null | undefined) => {
  const x = (m ?? '').trim()
  return x === 'bonifico' ? 'con bonifico' : x === 'contanti' || !x ? 'in contanti' : `con ${x}`
}

/** «240 € · acconto 120 € con bonifico · restano 120 €», oppure «240 € · pagato in contanti» */
export function contoRiquadro(righe: RigaRiquadroDati[], pagamenti: DatiRiquadro['pagamenti']): { linea: PezzoRiquadro[]; saldato: boolean } {
  let conto: { totaleCent: number; ricevutiCent: number }
  try { conto = contoPrenotazione(righe, pagamenti) } catch { return { linea: [{ testo: TITOLO_CONTO_NON_LEGGIBILE, tipo: 'gr' }], saldato: false } }
  const ids = new Set(righe.map(r => r.id))
  const suoi = pagamenti.filter(p => ids.has(p.booking_id))
  const r = riepilogoConto(conto, righe.some(x => x.status !== 'annullata' && x.pagato === true))
  const linea: PezzoRiquadro[] = [{ testo: r.totale, tipo: 'b' }]
  if (r.saldato) {
    const metodi = [...new Set(suoi.map(p => ((p.method ?? '').trim() || 'contanti')))]
    const come = metodi.length === 0 ? 'pagato'
      : metodi.length === 1 ? `pagato ${conMetodo(metodi[0])}`
      : `pagato con ${metodi.join(' e ')}`
    linea.push({ testo: ` · ${come}` })
    return { linea, saldato: true }
  }
  for (const p of suoi) linea.push({ testo: ` · acconto ${euroScheda(Math.round(Number(p.amount) * 100))} ${conMetodo(p.method)}` })
  linea.push({ testo: ' · ' }, { testo: `restano ${r.residuo}`, tipo: 'gr' })
  return { linea, saldato: false }
}

export function contenutoRiquadro(d: DatiRiquadro): ContenutoRiquadro {
  const p = d.premuta
  const guest = p.guests ?? d.righe.find(r => r.guests)?.guests ?? null
  const vive = segmentiAttivi(d.righe) as RigaRiquadroDati[]
  const attive = vive.length ? vive : [p]

  // Arrivo: con più arrivi il primo che deve ancora venire (come il foglietto)
  const arrivoRiga = arrivoDaMostrare(arriviDeiPeriodi(attive), d.oggi)
  const arrivo = arrivoRiga ? leggiArrivo(arrivoRiga as unknown as Record<string, unknown>) : null
  const ignoto = !arrivo || orarioIgnoto(arrivo)
  const catene = catenePrenotazione(attive)
  const bagagli = arrivoRiga ? catene.find(c => c.arrivo === arrivoRiga.check_in)?.bagagli ?? null : null
  const ultima = catene.reduce<(typeof catene)[number] | null>((m, c) => (!m || c.partenza > m.partenza ? c : m), null)
  const partenza = ultima?.partenza ?? p.check_out
  const oraPartenza = ultima?.oraPartenza ?? null

  const conto = contoRiquadro(d.righe.length ? d.righe : [p], d.pagamenti)
  const accordo = accordoPrenotazione(d.righe.length ? d.righe : [p])
  const ids = new Set((d.righe.length ? d.righe : [p]).map(r => r.id))

  const notti = caselleSoggiorno(attive, d.oggi).map(c => c.iso)
  const daFare = daFarePrenotazione({
    oggi: d.oggi,
    notti,
    nottiLetto: attive.flatMap(r => nottiLettoExtra(r)),
    cambi: d.cambi,
    arrivo: arrivoRiga ? { checkIn: arrivoRiga.check_in, orarioIgnoto: ignoto } : null,
    partenza: { checkOut: partenza, ora: oraPartenza },
    accordo: accordo ? { accordo_pagamento: accordo.accordo_pagamento as string | null | undefined, bonifico: accordo.bonifico as boolean | null | undefined } : null,
    pagamenti: d.pagamenti.filter(x => ids.has(x.booking_id)),
    saldato: conto.saldato,
    vuoleRicevuta: vuoleRicevuta(guest),
  })

  const righe: RigaRiquadro[] = []
  const ospiti = ospitiRiquadro(attive, d.oggi)
  if (ospiti) righe.push({ etichetta: 'Ospiti', linee: ospiti })

  const lineaArrivo: PezzoRiquadro[] = [{ testo: giornoBreve(arrivoRiga?.check_in ?? p.check_in), tipo: 'b' }, { testo: ' · ' }]
  if (ignoto) lineaArrivo.push({ testo: DA_CHIEDERE, tipo: 'gr' })
  else lineaArrivo.push({ testo: rigaArrivo(arrivo!).replace(/^arriva\s+/, '') })
  if (bagagli) lineaArrivo.push({ testo: ` · bagagli alle ${bagagli}` })
  righe.push({ etichetta: 'Arrivo', linee: [lineaArrivo] })

  righe.push({ etichetta: 'Partenza', linee: [[{ testo: giornoBreve(partenza), tipo: 'b' }, { testo: ' · ' }, oraPartenza ? { testo: oraPartenza } : { testo: DA_CHIEDERE, tipo: 'gr' }]] })

  righe.push({ etichetta: 'Conto', linee: [conto.linea] })

  const cliente: PezzoRiquadro[] = [{ testo: [minuscolaIniziale(chiEIlCliente(d.volte, false)), provenienzaInParole(guest ?? p)].filter(Boolean).join(' · ') }]
  if (d.spesoCent != null) cliente.push({ testo: ' · ' }, { testo: euroScheda(d.spesoCent), tipo: 'b' })
  righe.push({ etichetta: 'Cliente', linee: [cliente] })

  const note = [...new Set(attive.map(r => (r.notes ?? '').trim()).filter(Boolean))].join(' · ')
  if (note) righe.push({ etichetta: 'Note', linee: [[{ testo: note }]] })

  return {
    occhiello: `${cameraCorta(d.camera)} · ${testoStato(statoScheda(p, d.coperte === -1))}`,
    // il nome com'è scritto sulla prenotazione (come le schede), messo in ordine da nomeCompleto
    titolo: nomeCompleto({ full_name: p.guest_name || p.guests?.full_name }) || nomeOspite(p),
    telefono: telefonoPerEsteso(guest?.phone),
    daFare,
    righe,
  }
}
