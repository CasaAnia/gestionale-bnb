// ============================================================================
// I TESTI DEI MESSAGGI AL CLIENTE (13/09/2026).
//
// Sono gli STESSI testi della scheda `/prenotazioni/[id]`, approvati da Ania
// parola per parola: qui non è stata cambiata una virgola. Il corpo della
// funzione e i suoi aiutanti sono una COPIA ESATTA di quel file, che in questo
// momento è in carico a un'altra attività e non si poteva toccare per
// esportarli; `lib/messaggiPrenotazione.test.ts` confronta i due sorgenti e
// fallisce appena uno dei due cambia, così non possono divergere in silenzio.
//
// DA FARE quando quel file torna libero: cancellare la funzione da lì e
// importarla da qui, così il testo resta scritto in un posto solo.
// ============================================================================
import { nomeOspite, nomePerMessaggio } from './guestName.ts'
import { roomWithType, lettoInclusoNellaCamera } from './roomTypes.ts'
import { contoSoggiorno, residuoDaPagare } from './conto.ts'
import { dettaglioNottiSalvato, testoDettaglioNotti } from './prezzoNotti.ts'
import { haCamereParallele } from './prenotazioneUnica.ts'
import { righeCostiSegmenti } from './riepilogoCosti.ts'
import { causaleBonifico } from './causale.ts'
import { lettoDaComunicare } from './tariffe.ts'
import { dataItaliana } from './dateItaliane.ts'
import { messaggioRichiestaOrario } from './messaggiWhatsApp.ts'
import { GIORNI_PREAVVISO_CANCELLAZIONE } from './condizioniPrenotazione.ts'

export type TipoMessaggio = 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero'

// I tasti della parte MESSAGGI, nell'ordine deciso da Ania (13/09/2026).
// «Conferma · immagine e testo» sta a parte, sopra: apre la finestra con
// l'immagine (components/ConfermaWhatsApp), non un testo.
export const MESSAGGI_SCHEDA: { tipo: TipoMessaggio; label: string }[] = [
  { tipo: 'conferma', label: 'Conferma' },
  { tipo: 'modifica', label: 'Modifica' },
  { tipo: 'dati_bonifico', label: 'Dati bonifico' },
  { tipo: 'pagamento_ricevuto', label: 'Pagamento ricevuto' },
  { tipo: 'promemoria_bonifico', label: 'Promemoria bonifico' },
  { tipo: 'richiesta_orario', label: 'Richiesta orario' },
  { tipo: 'ringraziamento', label: 'Ringraziamento' },
  { tipo: 'libero', label: 'Messaggio libero' },
]
export const MESSAGGIO_ANNULLAMENTO = { tipo: 'annullamento' as TipoMessaggio, label: 'Annullamento' }

/* eslint-disable @typescript-eslint/no-explicit-any */
// ── COPIA ESATTA da app/prenotazioni/[id]/page.tsx (vedi sopra) ─────────────
function formatDateIT(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const formatDateShort = (dateStr: string) => dataItaliana(dateStr)

function bagnoDesc(room: any) {
  if (room?.bathroom_type === 'privato_interno') return "privato, all'interno della camera"
  if (room?.bathroom_type === 'privato_esterno') return room?.bathroom_note ? `privato esterno (${room.bathroom_note})` : 'privato esterno'
  return ''
}

function roomPageLink(roomName: string): string | null {
  if (roomName.includes('Amelia')) return 'https://www.casaaniarozzano.it/camere/singola'
  if (roomName.includes('Allegra')) return 'https://www.casaaniarozzano.it/camere/allegra'
  if (roomName.includes('Ambra')) return 'https://www.casaaniarozzano.it/camere/ambra'
  if (roomName.includes('Lena')) return 'https://www.casaaniarozzano.it/camere/lena'
  return null
}

export default function buildWhatsappMsg(b: any, type: 'conferma' | 'modifica' | 'annullamento' | 'dati_bonifico' | 'pagamento_ricevuto' | 'promemoria_bonifico' | 'richiesta_orario' | 'ringraziamento' | 'libero', gruppo: any[] = [], acconti: any[] = []) {
  const name = nomePerMessaggio(nomeOspite(b))
  const room = b.rooms?.name || ''
  // Nome con tipologia (es. "Amelia – Singola"): solo nei messaggi al cliente
  const roomFull = roomWithType(room)
  const isGruppo = gruppo.length > 1

  // Per soggiorno con cambio camera usa il gruppo ordinato per check_in
  const segmenti = isGruppo ? [...gruppo].sort((a, z) => a.check_in.localeCompare(z.check_in)) : [b]
  const cin = segmenti[0].check_in
  const cout = segmenti.reduce((fine, s) => s.check_out > fine ? s.check_out : fine, segmenti[0].check_out)
  // Totale dal conto unico (LETTURA: il record salvato è autorevole per le
  // prenotazioni senza sconto, i dati storici non vengono reinterpretati)
  const totaleNum = segmenti.reduce((s, x) => s + contoSoggiorno(x).totale, 0)
  const notti = Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
  const totale = totaleNum.toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const numOspiti = [...new Set(segmenti.map(s => s.group_id || s.id))].reduce((somma, gruppo) => somma + Math.max(...segmenti.filter(s => (s.group_id || s.id) === gruppo).map(s => Number(s.num_guests) || 1)), 0)
  const ospiti = `${numOspiti} ${numOspiti === 1 ? 'adulto' : 'adulti'}`
  const cinF = formatDateIT(cin)
  const coutF = formatDateIT(cout)
  const bagno = bagnoDesc(b.rooms)

  const isLena = room.includes('Lena')
  const roomLink = roomPageLink(room)

  // Un soggiorno può essere spezzato in più periodi o perché l'ospite cambia camera,
  // oppure perché resta nella stessa camera a una tariffa diversa: l'intestazione deve
  // dire la cosa giusta, altrimenti al cliente annunciamo un cambio camera che non c'è.
  const camereDiverse = new Set(segmenti.map((s: any) => s.rooms?.name)).size > 1
  const intestazioneSegmenti = haCamereParallele(segmenti) ? 'Camere della prenotazione:' : camereDiverse
    ? 'Camere (cambio camera durante il soggiorno):'
    : 'Periodi del soggiorno:'
  const riepilogoCamere = isGruppo ? segmenti.map((s, i) => {
    const n = Math.round((new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 86400000)
    // Per Lena con 3 ospiti il prezzo a notte mostrato è quello tutto compreso (letto incluso)
    const prezzoNotte = lettoInclusoNellaCamera(s, n)
      ? Number(s.price_per_night) + Number(s.rooms?.extra_bed_price || 0)
      : Number(s.price_per_night)
    // Tariffa diversa fra le notti (persone che cambiano): dettaglio per notte
    // al posto di un «/notte» unico che sarebbe falso
    const dett = dettaglioNottiSalvato(s.rooms, s)
    const prezzoTesto = dett ? testoDettaglioNotti(dett, x => `€${x}`) : `€${prezzoNotte.toFixed(0)}/notte`
    return `   ${i + 1}. *${roomWithType(s.rooms?.name) || 'Camera'}*: ${formatDateIT(s.check_in)} → ${formatDateIT(s.check_out)} (${n} ${n === 1 ? 'notte' : 'notti'}) – ${prezzoTesto}`
  }).join('\n') : ''

  // Riepilogo costi dal conto unico: righe di dettaglio a prezzo pieno e, solo
  // se esiste uno sconto SALVATO, la riga "Sconto a lei riservato". Se per un
  // dato storico il dettaglio non torna col totale autorevole, si rinuncia
  // allo spezzettamento e si mostra una riga unica: tutte le schermate devono
  // dire lo stesso totale.
  // Righe dal conto unico (lib/riepilogoCosti, la stessa funzione dell'immagine
  // WhatsApp e della proposta): «etichetta: importo», sconto fra le linee
  const fmtEuro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const { righe: righeConto, totale: totaleRighe } = righeCostiSegmenti(segmenti, isGruppo)
  const righeCosti = righeConto.map(r => r.sconto
    ? `━━━━━━━━━━━━━━\n*Sconto a lei riservato: −${fmtEuro(-r.amount)}*\n━━━━━━━━━━━━━━`
    : `${r.label}: ${fmtEuro(r.amount)}`)
  const riepilogoCosti = `💶 RIEPILOGO COSTI
${righeCosti.join('\n')}
*Totale soggiorno: ${fmtEuro(totaleRighe)}*`

  const causale = causaleBonifico(segmenti, name)

  // Blocco dati bonifico condiviso da conferma (variante bonifico), "Dati bonifico" e promemoria.
  // Con acconti già registrati l'importo da bonificare è il RESIDUO, non il
  // totale: al cliente non si chiedono soldi già consegnati.
  const ricevutoNum = (acconti || []).reduce((s, a) => s + Number(a.amount || 0), 0)
  const residuoNum = residuoDaPagare(totaleNum, acconti)
  const fmtIt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })
  const importoBlocco = ricevutoNum > 0
    ? `Totale soggiorno: ${fmtIt(totaleNum)} €
Già ricevuto: ${fmtIt(ricevutoNum)} €

Importo da bonificare:
*${fmtIt(residuoNum)} €*`
    : `Importo:
*${totale} €*`
  const datiBonifico = `Intestatario: *SAWICKA ANNA JANINA*
Banca: *BANCO BPM*

IBAN:
*IT32P0503401753000000159653*

${importoBlocco}

Causale:
${causale}`

  const ricevutaWhatsApp = `Una volta effettuato il bonifico, può inviarmi la ricevuta direttamente qui su WhatsApp. Le confermerò la ricezione appena possibile.`

  const pagamentoInfo = b.bonifico
    ? `💳 PAGAMENTO
Il soggiorno si salda in anticipo con bonifico bancario.

${datiBonifico}

${ricevutaWhatsApp}`
    : `💳 PAGAMENTO
Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.`

  // Formula ufficiale della transizione, identica da entrambi i WhatsApp
  const SOTTOTITOLO_STRUTTURA = 'precedentemente Casa Granata Humanitas'
  const firmaFormale = `A presto,
Ania
Casa Ania`

  // Blocco camera/bagno/link condiviso da conferma e modifica
  const cameraBlock = `${isGruppo ? `${intestazioneSegmenti}\n${riepilogoCamere}` : `Camera: ${roomFull}${lettoDaComunicare(b) ? ' + letto aggiuntivo' : ''}\n${isLena ? '🚿 Bagno: *privato esterno, chiuso a chiave, a circa 1 metro dalla camera*' : (bagno ? `🚿 Bagno: ${bagno}` : '')}`}${!isGruppo && roomLink ? `\n\nLa sua camera:\n${roomLink}` : ''}`

  if (type === 'conferma') {
    // Titoli di sezione in grassetto SOLO nella conferma: i blocchi restano condivisi
    // con la modifica, che mantiene i suoi titoli semplici
    const riepilogoCostiBold = riepilogoCosti.replace('💶 RIEPILOGO COSTI', '💶 *RIEPILOGO COSTI*')
    const pagamentoInfoBold = pagamentoInfo.replace('💳 PAGAMENTO', '💳 *PAGAMENTO*')
    return `CONFERMA DI PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

grazie per averci scelto. Sono felice di confermarle il soggiorno e sarà un piacere accoglierla. 🌿

📅 *IL SUO SOGGIORNO*
Check-in: *${cinF}* (dalle 15:00 alle 20:00)
Check-out: *${coutF}* (entro le 10:00)
Notti: *${notti}*
Ospiti: ${ospiti}
${cameraBlock}

${riepilogoCostiBold}

${pagamentoInfoBold}

💬 *Appena le sarà possibile, le chiedo di comunicarmi l'orario di arrivo, così potrò organizzare al meglio la sua accoglienza.*

📍 *DOVE SIAMO*
Via Liguria 26 – Fizzonasco, Pieve Emanuele (MI) 20072
*A 140 metri dalla palazzina 8 di Humanitas (ortopedia)*

Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

📞 *CONTATTI*
Per qualsiasi necessità sono a sua disposizione:
342 700 4354 (anche WhatsApp)

*CANCELLAZIONE*
Cancellazione gratuita fino a ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni prima dell'arrivo.

A presto,
*Ania*
*Casa Ania*`
  }

  if (type === 'modifica') {
    return `MODIFICA PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

la sua prenotazione è stata modificata.
Di seguito trova il riepilogo aggiornato del soggiorno.

📅 SOGGIORNO AGGIORNATO
Check-in: *${cinF}* (dalle 15:00 alle 20:00)
Check-out: *${coutF}* (entro le 10:00)
Notti: *${notti}*
Ospiti: ${ospiti}
${cameraBlock}

${riepilogoCosti}

${pagamentoInfo}

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

Per qualsiasi domanda sono a sua disposizione:
📞 342 700 4354 (anche WhatsApp)

${firmaFormale}`
  }
  if (type === 'dati_bonifico') {
    return `Gentile ${name},

come da accordi, le invio i dati per il pagamento tramite bonifico bancario.

💳 DATI PER IL BONIFICO

${datiBonifico}

${ricevutaWhatsApp}

Per qualsiasi necessità sono a sua disposizione.

A presto,
Ania`
  }

  if (type === 'promemoria_bonifico') {
    return `Gentile ${name},

le scrivo solo per ricordarle che non ho ancora ricevuto il bonifico relativo al soggiorno dal *${formatDateShort(cin)}* al *${formatDateShort(cout)}*.

Le lascio di nuovo i dati:

💳 DATI PER IL BONIFICO

${datiBonifico}

Quando avrà effettuato il bonifico, può inviarmi la ricevuta direttamente qui su WhatsApp.

Se invece ha già provveduto in queste ore, ignori pure questo messaggio. Grazie.

A presto,
Ania`
  }

  if (type === 'richiesta_orario') {
    // Testo unico con la Home «Da controllare» (lib/messaggiWhatsApp)
    return messaggioRichiestaOrario(name)
  }

  if (type === 'libero') {
    return ''
  }

  if (type === 'ringraziamento') {
    return `Gentile ${name},

grazie per aver soggiornato da noi. È stato un piacere averla come nostra ospite e spero che si sia trovata bene. 🌿

Se ha un momento e le fa piacere, può raccontare la sua esperienza lasciandoci una recensione su Google.

Per noi è davvero importante e può essere utile anche a chi sta cercando un posto dove soggiornare vicino a Humanitas.

⭐ Lascia una recensione:
https://maps.google.com/?cid=12687762198889638693

Grazie ancora per averci scelto.

E se dovesse tornare da queste parti, sarà un piacere accoglierla di nuovo.

Un caro saluto,
Ania`
  }

  if (type === 'pagamento_ricevuto') {
    return `Gentile ${name},

ho ricevuto il suo pagamento. Grazie. ✓

È tutto confermato e la aspetto con piacere *${cinF}*.

🏠 Tutte le informazioni utili per il soggiorno:
https://www.casaaniarozzano.it/info?v=7

Per qualsiasi necessità sono a sua disposizione.

A presto,
Ania`
  }

  return `ANNULLAMENTO PRENOTAZIONE – CASA ANIA
${SOTTOTITOLO_STRUTTURA}

Gentile ${name},

le confermo che la sua prenotazione è stata annullata.

📅 PRENOTAZIONE ANNULLATA
Check-in: ${formatDateShort(cin)}
Check-out: ${formatDateShort(cout)}
Camera: ${roomFull}
Ospiti: ${ospiti}

Mi dispiace non poterla accogliere questa volta. Se in futuro dovesse averne bisogno, sarà un piacere ospitarla.

Per qualsiasi necessità sono a sua disposizione:
📞 342 700 4354 (anche WhatsApp)

${firmaFormale}`
}
// ── fine della copia ────────────────────────────────────────────────────────
