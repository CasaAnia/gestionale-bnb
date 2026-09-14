// La nuova pagina di inserimento (14/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  dataDiOggi, volteInParole, rigaClienteTrovato, camereDelPeriodo, rigaCamereLibere,
  ospitiPossibiliNotte, ospitiDellaNotte, listinoLetto, raggruppaPerCamera, datiLinea, nottiDellaLinea,
  CRITERI_LETTO, campiConLei, PERSONE_CON_LEI_MAX, contoNuovaPrenotazione, scontoInParole, campiSconto,
  totaliScontati, ospitiMassimi, ospitiMassimiPrenotazione, ospitiScegliendoCamera,
  statoLettoNuova, LETTO_NON_DISPONIBILE_TESTO, mancaAlConto, MANCA_CAMERA, MANCA_DATE, doveManca,
  periodiDellaLinea, periodiDaNottiTenendoVuote,
} from './nuovaPrenotazione.ts'
import { conLettoAutomatico, tariffaProposta, lettoProposto, problemi, type PeriodoComposto } from './prenotazioneComposta.ts'
import {
  nottiDaPeriodi, giornoDellaNotte, avvisiStriscia, riassuntoStriscia,
  camereDellaNotte, cambiaCamera as cambiaCameraNotte, cambiaOspitiNotte,
  cambiaLetto as cambiaLettoNotte, cambiCamera, prezzoLettoNotte,
  lettoObbligatorio, motivoLettoObbligatorio, lettoDisponibileNotte, nonDormeQui,
} from './strisciaNotti.ts'
import { dataConGiorno } from './dateItaliane.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]

test('in cima la data di oggi per esteso', () => {
  assert.equal(dataDiOggi('2026-09-14'), 'Lunedì 14 settembre 2026')
  assert.equal(dataDiOggi('2026-01-01'), 'Giovedì 1 gennaio 2026')
})

test('quante volte è già stata qui', () => {
  assert.equal(volteInParole(0), 'nessun soggiorno')
  assert.equal(volteInParole(1), '1 soggiorno')
  assert.equal(volteInParole(3), 'già stata qui 3 volte')
  assert.equal(rigaClienteTrovato('333 000 0018', 2), '333 000 0018 · già stata qui 2 volte')
  assert.equal(rigaClienteTrovato(null, 0), 'nessun soggiorno')
})

test('le camere del periodo: occupata in una notte sola resta scegliibile per le altre', () => {
  const altre = [{ room_id: 'ambra', check_in: '2026-10-12', check_out: '2026-10-13', status: 'confermata' }]
  const scelte = camereDelPeriodo(CAMERE, altre, '2026-10-10', '2026-10-15')
  // Ambra non copre tutto il soggiorno, ma le sue quattro notti libere sì
  const ambra = scelte.find(s => s.camera.name === 'Ambra')!
  assert.equal(ambra.tutte, false)
  assert.equal(ambra.libera, true)
  assert.deepEqual(ambra.notti, ['2026-10-10', '2026-10-11', '2026-10-13', '2026-10-14'])
  assert.equal(scelte.filter(s => s.tutte).length, 3)
  assert.equal(rigaCamereLibere(scelte, '2026-10-10', '2026-10-15'), 'libere: Amelia · Allegra · Lena')
  // senza date non si dice niente e non si spegne niente
  assert.equal(rigaCamereLibere(camereDelPeriodo(CAMERE, altre, '', ''), '', ''), '')
  assert.equal(camereDelPeriodo(CAMERE, altre, '', '').every(s => s.libera), true)
})

test('la riga delle camere libere nei casi estremi', () => {
  const tutte = CAMERE.map(c => ({ room_id: c.id, check_in: '2026-10-10', check_out: '2026-10-11', status: 'confermata' }))
  assert.equal(rigaCamereLibere(camereDelPeriodo(CAMERE, tutte, '2026-10-10', '2026-10-11'), '2026-10-10', '2026-10-11'), 'nessuna camera libera in queste date')
  assert.equal(rigaCamereLibere(camereDelPeriodo(CAMERE, [], '2026-10-10', '2026-10-11'), '2026-10-10', '2026-10-11'), 'tutte le camere libere')
})

test('gli ospiti di una notte sono solo quelli salvabili', () => {
  // Lena: da due (senza letto) fino a quello che si è scelto
  assert.deepEqual(ospitiPossibiliNotte(LENA, 3), [2, 3])
  assert.deepEqual(ospitiPossibiliNotte(LENA, 4), [2, 3, 4])
  // Amelia: una senza letto, due col letto
  assert.deepEqual(ospitiPossibiliNotte(AMELIA, 2), [1, 2])
  // se il soggiorno è già alla capienza base non c'è niente da scegliere
  assert.deepEqual(ospitiPossibiliNotte(AMBRA, 2), [2])
  // e non si va oltre quello che la camera tiene
  assert.deepEqual(ospitiPossibiliNotte(AMBRA, 9), [2, 3])
})

test('gli ospiti scelti valgono per tutte le notti; senza letto scendono', () => {
  assert.equal(ospitiDellaNotte(LENA, 3, true), 3)
  assert.equal(ospitiDellaNotte(LENA, 3, false), 2)
  assert.equal(ospitiDellaNotte(AMELIA, 2, false), 1)
  assert.equal(ospitiDellaNotte(AMELIA, 1, false), 1)
})

// ── LA PAGINA, letta dai sorgenti ──────────────────────────────────────────
const pagina = readFileSync(new URL('../app/nuova-prenotazione/page.tsx', import.meta.url), 'utf8')

test('la pagina nasce a /nuova-prenotazione e non tocca quella di adesso', () => {
  assert.ok(pagina.length > 0)
  const vecchia = readFileSync(new URL('../app/nuova/page.tsx', import.meta.url), 'utf8')
  assert.ok(vecchia.includes('ComePaga'), 'la pagina di adesso è cambiata')
})

test('in cima non c’è il titolo: lo dice la barra. Resta la data in ottone', () => {
  // Ania, 14/09/2026: come nelle Richieste, il titolo non si legge due volte
  assert.equal(/<h1/.test(pagina), false, 'il titolo è tornato nel corpo della pagina')
  assert.equal(/fontSize: 26/.test(pagina), false)
  assert.match(pagina, /data-oggi className="uppercase" style=\{\{ fontSize: 10, letterSpacing: '1\.5px', color: OTTONE/)
  assert.match(pagina, /\{dataDiOggi\(oggi\)\}/)
  // la data è la prima cosa della pagina, dopo la freccia indietro
  assert.ok(pagina.indexOf('data-oggi') < pagina.indexOf('data-cerca-cliente'))
})

test('la ricerca è quella di sempre, col tastino sage «+ Nuovo cliente»', () => {
  assert.match(pagina, /import CampoRicerca from '@\/components\/CampoRicerca'/)
  assert.match(pagina, /placeholder="Cerca per nome o telefono…"/)
  assert.match(pagina, /export const NUOVO_CLIENTE = '\+ Nuovo cliente'/)
  assert.match(pagina, /height: 30, borderRadius: 6, padding: '0 9px', background: 'var\(--color-sage\)', color: 'var\(--color-green-mid\)', fontSize: 13, fontWeight: 700/)
  // il tastino c'è sopra e in fondo all'elenco
  assert.equal((pagina.match(/<TastinoSage testo=\{NUOVO_CLIENTE\}/g) || []).length >= 2, true)
})

test('le righe dei clienti trovati hanno la forma della Home', () => {
  assert.match(pagina, /fontSize: 15, fontWeight: 600, color: 'var\(--color-green-dark\)'/)
  assert.match(pagina, /fontSize: 12\.5, color: 'var\(--color-stone\)'/)
  assert.match(pagina, /vuoleRicevuta\(cliente\) && <span aria-label="vuole la ricevuta">🧾/)
  assert.match(pagina, /valutazioneDi\(cliente\) === 'ottimo'/)
  assert.match(pagina, /\{rigaClienteTrovato\(cliente\.phone, soggiorni\)\}/)
  // la ricerca guarda nome e telefono con la regola già in uso
  assert.match(pagina, /full_name\.ilike\.%\$\{testo\}%,phone\.ilike\.%\$\{cifre\}%/)
  assert.match(pagina, /import \{ filtraClienti \} from '@\/lib\/cambiaCliente'/)
})

// ── 2. NUOVO CLIENTE ───────────────────────────────────────────────────────
const nuovoCliente = readFileSync(new URL('../components/nuova/NuovoCliente.tsx', import.meta.url), 'utf8')
const pezzi = readFileSync(new URL('../components/nuova/PezziNuova.tsx', import.meta.url), 'utf8')

test('il nuovo cliente: campi a riga col filo, niente riquadri', () => {
  assert.match(nuovoCliente, /export const TITOLO_NUOVO_CLIENTE = 'Nuovo cliente'/)
  assert.match(pezzi, /padding: '8px 0', borderBottom: '1px solid var\(--color-card-border\)'/)
  assert.equal(/ed-riquadro|rounded-xl|rounded-lg/.test(nuovoCliente), false, 'il modulo ha rimesso i riquadri')
  // nome e cognome affiancati, poi il telefono
  assert.match(nuovoCliente, /className="flex" style=\{\{ gap: 12 \}\}[\s\S]{0,400}data-campo="nome"[\s\S]{0,300}data-campo="cognome"/)
  assert.match(nuovoCliente, /data-campo="telefono"/)
})

test('ricevuta e valutazione, con le tre voci e il motivo', () => {
  assert.match(nuovoCliente, /dati="ricevuta-no"[\s\S]{0,200}dati="ricevuta-si"/)
  assert.match(nuovoCliente, /\{ chiave: 'ottimo', segno: '★' \}/)
  assert.match(nuovoCliente, /\{ chiave: 'normale', segno: 'Normale' \}/)
  assert.match(nuovoCliente, /\{ chiave: 'problematico', segno: '!', colore: MATTONE \}/)
  // scegliendo «!» compare il motivo, e cambiando voce se ne va
  assert.match(nuovoCliente, /dati\.valutazione === 'problematico' && \(/)
  assert.match(nuovoCliente, /motivo: v\.chiave === 'problematico' \? dati\.motivo : ''/)
  // le etichettine sopra i due gruppi sono centrate
  assert.match(nuovoCliente, /<Etichetta testo="Ricevuta" centrata \/>/)
  assert.match(nuovoCliente, /<Etichetta testo="Valutazione" centrata \/>/)
})

test('«come ci ha trovato» e le strutture rientrate col filetto ottone', () => {
  assert.match(nuovoCliente, /\{PROVENIENZE\.map/)
  assert.match(nuovoCliente, /'altra_struttura' \? 'Struttura' : p\.label/)
  assert.match(nuovoCliente, /data-strutture style=\{\{ marginTop: 10, marginLeft: 10, paddingLeft: 12, borderLeft: `2px solid \$\{OTTONE\}` \}\}/)
  assert.match(nuovoCliente, /export const ALTRA_STRUTTURA = 'altra…'/)
  // le strutture arrivano da fuori: l'elenco è quello già in uso
  assert.match(nuovoCliente, /strutture\.map\(s =>/)
  assert.match(pagina, /import \{ leggiStrutture \} from '@\/lib\/provenienzaDati'/)
})

test('la nota del cliente e il tasto «Avanti» piccolo, verde e centrato', () => {
  assert.match(nuovoCliente, /export const ETICHETTA_NOTE = 'Note del cliente · restano anche le prossime volte'/)
  assert.match(nuovoCliente, /export const AVANTI = 'Avanti · date e camera'/)
  assert.match(pezzi, /height: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 18px', fontSize: 12, fontWeight: 600/)
  assert.match(pezzi, /export const ALTEZZA_PASTIGLIA = 30/)
  assert.equal(/w-full/.test(nuovoCliente), false, 'il tasto è a tutta larghezza')
})

test('il cliente nuovo si salva con le regole di sempre', () => {
  assert.match(pagina, /import \{ creaClienteNuovo \} from '@\/lib\/cambiaClienteDati'/)
  assert.match(pagina, /numeroUsabile\(nuovo\.telefono\)/)
  assert.match(pagina, /nomeCompleto\(\{ nome: nuovo\.nome, cognome: nuovo\.cognome \}\)/)
  assert.match(pagina, /motivo_problematico: nuovo\.motivo\.trim\(\)/)
  assert.match(pagina, /export const SENZA_TELEFONO = 'Il numero di telefono è obbligatorio/)
})

// ── 3. SOGGIORNO ───────────────────────────────────────────────────────────
const cameraSoggiorno = readFileSync(new URL('../components/nuova/CameraSoggiorno.tsx', import.meta.url), 'utf8')

test('la camera del soggiorno riusa la striscia già fatta, con gli ospiti sotto', () => {
  assert.match(cameraSoggiorno, /import StrisciaNottiCamere from '@\/components\/StrisciaNottiCamere'/)
  assert.match(cameraSoggiorno, /ospitiAttesi=\{ospiti\} spiegazione=\{false\}/)
  // niente tasto per il cambio camera: si fa dalla striscia
  const codice = cameraSoggiorno.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/cambio camera|Aggiungi cambio/i.test(codice), false)
  // toccare una notte la SCEGLIE (e ritoccandola si chiude): niente foglietto
  assert.match(pagina, /onNotte=\{n => setNotteScelta\(s =>/)
  assert.match(pagina, /s && s\.gruppo === linea\.gruppo && s\.iso === n\.iso \? null :/)
})

test('gli ospiti diversi da quelli del soggiorno si scrivono in mattone', () => {
  const striscia = readFileSync(new URL('../components/StrisciaNottiCamere.tsx', import.meta.url), 'utf8')
  assert.match(striscia, /export const MATTONE_OSPITI = '#8a4f2f'/)
  assert.match(striscia, /n\.persone === ospitiAttesi \? 'var\(--color-green-dark\)' : MATTONE_OSPITI/)
  assert.match(striscia, /fontFamily: GEORGIA, fontSize: 15/)
})

test('le camere occupate restano spente, e sotto si legge chi è libero', () => {
  assert.match(cameraSoggiorno, /spenta=\{!libera && roomId !== camera\.id\}/)
  assert.match(cameraSoggiorno, /data-camere-libere/)
  assert.match(pagina, /rigaLibere=\{rigaCamereLibere\(scelte, d\.arrivo, d\.partenza\)\}/)
})

test('il letto e lo sconto sono uno solo per tutta la prenotazione', () => {
  assert.match(pagina, /const \[letto, setLetto\] = useState<\{ importo: number \| null; criterio: 'notte' \| 'ogni4' \| 'totale' \}>/)
  // l'importo non scritto vale il listino della camera, non zero
  assert.match(pagina, /letto: p\.nottiLetto\.length > 0[\s\S]{0,120}criterio: letto\.criterio/)
  assert.deepEqual(CRITERI_LETTO.map(c => c.chiave), ['notte', 'ogni4', 'totale'])
  assert.match(pagina, /data-sconto-conto/)
})

test('il promemoria del listino dice «compreso» dove il posto è già nel prezzo', () => {
  assert.equal(listinoLetto([]), '')
  assert.equal(listinoLetto([{ nome: 'Lena', importo: 0 }]), 'di listino · Lena compreso')
  assert.equal(listinoLetto([{ nome: 'Lena', importo: 10 }, { nome: 'Amelia', importo: 5 }]), 'di listino · Lena 10 € · Amelia 5 €')
})

test('le camere si raggruppano in linee, e la striscia le rifà', () => {
  const periodo = (id: string, gruppo: string, roomId: string, dal: string, al: string): PeriodoComposto => ({
    id, gruppo, roomId, checkIn: dal, checkOut: al, ospiti: 2, nottiLetto: [], letto: null, tariffa: 80,
  })
  const linee = raggruppaPerCamera([periodo('a', 'g1', LENA.id, '2026-11-20', '2026-11-22'), periodo('b', 'g2', AMBRA.id, '2026-11-20', '2026-11-22')])
  assert.equal(linee.length, 2)
  const d = datiLinea(linee[0])
  assert.deepEqual([d.arrivo, d.partenza, d.ospiti, d.tariffa], ['2026-11-20', '2026-11-22', 2, 80])
  assert.equal(nottiDellaLinea(linee[0]), 2)
  // una linea spezzata dal cambio camera: le date vanno da capo a fondo
  const spezzata = raggruppaPerCamera([periodo('a', 'g1', LENA.id, '2026-11-20', '2026-11-22'), periodo('b', 'g1', AMBRA.id, '2026-11-22', '2026-11-24')])[0]
  const ds = datiLinea(spezzata)
  assert.deepEqual([ds.arrivo, ds.partenza, ds.spezzata, ds.tariffa], ['2026-11-20', '2026-11-24', true, null])
  assert.equal(nottiDellaLinea(spezzata), 4)
})

// ── 4. ARRIVO, COME PAGA, CON LEI, NOTA ────────────────────────────────────
const conLei = readFileSync(new URL('../components/nuova/ConLei.tsx', import.meta.url), 'utf8')

test('l’arrivo: l’ora con l’orologino e la navetta a tre pastiglie', () => {
  assert.match(pagina, /<Etichetta testo="A che ora arriva" \/>/)
  assert.match(pagina, /<RigaCampo etichetta="🕐 ora">/)
  assert.match(pagina, /oraDigitata\(e\.target\.value\)/)
  assert.match(pagina, /\[\['no', 'No'\], \['si', 'Sì'\], \['', '\?'\]\]/)
})

test('«come paga» è il componente già fatto, con il conto della prenotazione', () => {
  assert.match(pagina, /import ComePaga from '@\/components\/ComePaga'/)
  assert.match(pagina, /<ComePaga modo=\{comePaga\} onModo=\{setComePaga\} totaleCent=\{conto\.daPagareCent\}/)
})

test('«con lei»: le righe delle persone e il fogliettino per aggiungerne una', () => {
  assert.match(conLei, /export const AGGIUNGI_PERSONA = '\+ Aggiungi una persona'/)
  assert.match(conLei, /fontSize: 15, fontWeight: 600, color: 'var\(--color-green-dark\)'/)
  assert.match(conLei, /className="block uppercase" style=\{\{ fontSize: 9\.5, letterSpacing: '1\.4px', color: 'var\(--color-stone\)'/)
  assert.match(conLei, /\{CHI_E_VOCI\.map/)
  assert.match(conLei, /export const ALTRO = 'altro…'/)
  assert.match(conLei, /data-campo="persona-telefono"/)
  // il telefono può restare vuoto
  assert.match(conLei, /etichetta="Telefono · può restare vuoto"/)
})

test('le persone in più stanno nelle due colonne di sempre', () => {
  assert.equal(PERSONE_CON_LEI_MAX, 2)
  const campi = campiConLei([
    { id: '1', nome: 'Marco Riva', chiE: 'Figlio', telefono: '333 123 4567' },
    { id: '2', nome: 'Ada Riva', chiE: 'Amica', telefono: '' },
  ])
  assert.deepEqual(campi, {
    extra_phone_1_name: 'Marco Riva', extra_phone_1: '3331234567', chi_e: 'Figlio',
    extra_phone_2_name: 'Ada Riva',
  })
  // la terza non entra: la pagina lo dice
  const tre = campiConLei([
    { id: '1', nome: 'A', chiE: '', telefono: '' }, { id: '2', nome: 'B', chiE: '', telefono: '' }, { id: '3', nome: 'C', chiE: '', telefono: '' },
  ])
  assert.equal(JSON.stringify(tre).includes('"C"'), false)
  assert.match(pagina, /persone\.length > PERSONE_CON_LEI_MAX \? TROPPE_PERSONE : null/)
})

// ── 5. IL CONTO ────────────────────────────────────────────────────────────
const contoNuova = readFileSync(new URL('../components/nuova/ContoNuova.tsx', import.meta.url), 'utf8')

const periodo = (id: string, roomId: string, dal: string, al: string, extra: Partial<PeriodoComposto> = {}): PeriodoComposto => ({
  id, gruppo: 'g', roomId, checkIn: dal, checkOut: al, ospiti: 2, nottiLetto: [], letto: null, tariffa: null, ...extra,
})
const trova = (id: string | null) => (CAMERE.find(c => c.id === id) as never) ?? null

test('il conto: una riga per camera, il totale e quanto c’è da pagare', () => {
  const conto = contoNuovaPrenotazione([periodo('a', AMBRA.id, '2026-12-05', '2026-12-09')], trova, { tipo: 'nessuno', valore: null })
  assert.deepEqual(conto.righe.map(r => [r.titolo, r.dettaglio, r.importo]), [['Ambra', '4 notti × 80 €', '320 €']])
  assert.equal(conto.totale, '320 €')
  assert.equal(conto.sconto, null)
  assert.equal(conto.daPagare, '320 €')
  assert.equal(conto.aNotte, '4 notti · 80 € a notte')
})

test('il conto con lo sconto nei due modi', () => {
  const periodi = [periodo('a', AMBRA.id, '2026-12-05', '2026-12-09')]
  const percentuale = contoNuovaPrenotazione(periodi, trova, { tipo: 'percentuale', valore: 10 })
  assert.equal(percentuale.sconto, '32 €')
  assert.equal(percentuale.daPagare, '288 €')
  assert.equal(scontoInParole(percentuale.totaleCent, { tipo: 'percentuale', valore: 10 }), '320 € → 288 €')
  const finale = contoNuovaPrenotazione(periodi, trova, { tipo: 'finale', valore: 300 })
  assert.equal(finale.sconto, '20 €')
  assert.equal(finale.daPagare, '300 €')
  // un «prezzo finale» più alto del totale non è uno sconto: non si applica
  assert.equal(contoNuovaPrenotazione(periodi, trova, { tipo: 'finale', valore: 400 }).sconto, null)
})

test('il conto con il letto in più e con due camere insieme', () => {
  const conLetto = [periodo('a', LENA.id, '2026-12-05', '2026-12-07', {
    ospiti: 4, nottiLetto: ['2026-12-05', '2026-12-06'], letto: { importo: 10, criterio: 'notte' },
  })]
  const conto = contoNuovaPrenotazione(conLetto, trova, { tipo: 'nessuno', valore: null })
  assert.deepEqual(conto.righe.map(r => r.titolo), ['Lena', 'Letto in più'])
  assert.equal(conto.righe[1].dettaglio, '2 notti')
  assert.equal(conto.righe[1].importo, '20 €')
  assert.equal(conto.daPagare, '200 €')   // 90 × 2 notti + 20 di letto

  const due = contoNuovaPrenotazione([
    periodo('a', AMBRA.id, '2026-12-05', '2026-12-07'),
    { ...periodo('b', AMELIA.id, '2026-12-05', '2026-12-07'), gruppo: 'g2', ospiti: 1 },
  ], trova, { tipo: 'nessuno', valore: null })
  assert.deepEqual(due.righe.map(r => r.titolo), ['Ambra', 'Amelia'])
  assert.equal(due.daPagare, '300 €')     // 160 + 140
  assert.equal(due.notti, 2, 'le notti in parallelo si contano una volta sola')
})

test('finché manca una camera il conto non inventa un numero', () => {
  const senza = contoNuovaPrenotazione([periodo('a', '', '2026-12-05', '2026-12-07')], trova, { tipo: 'nessuno', valore: null })
  assert.equal(senza.totale, null)
  assert.equal(senza.daPagare, null)
  assert.equal(contoNuovaPrenotazione([], trova, { tipo: 'nessuno', valore: null }).totale, null)
})

test('come si salva lo sconto: percentuale, oppure totale concordato', () => {
  assert.deepEqual(campiSconto(32000, { tipo: 'nessuno', valore: null }, true), {})
  assert.deepEqual(campiSconto(32000, { tipo: 'percentuale', valore: 10 }, true), { discount_type: 'percentage', discount_value: 10 })
  assert.deepEqual(campiSconto(32000, { tipo: 'finale', valore: 300 }, true), { discount_type: 'target_total', discount_value: 300 })
  // con due camere il totale concordato diventa una percentuale, come fa oggi l'inserimento
  assert.deepEqual(campiSconto(40000, { tipo: 'finale', valore: 300 }, false), { discount_type: 'percentage', discount_value: 25 })
})

test('il disegno del conto: misure e Georgia', () => {
  assert.match(contoNuova, /fontSize: 14\.5, color: 'var\(--color-green-dark\)'/)
  assert.match(contoNuova, /fontSize: 12, color: 'var\(--color-stone\)', marginTop: 1/)
  assert.match(contoNuova, /fontFamily: GEORGIA, fontSize: 17/)
  assert.match(contoNuova, /data-totale[\s\S]{0,200}borderTop: `1px solid \$\{FILO_OTTONE\}`/)
  assert.match(contoNuova, /fontFamily: GEORGIA, fontSize: 22/)
  assert.match(contoNuova, /data-sconto-riga[\s\S]{0,200}color: OTTONE/)
  assert.match(contoNuova, /− \{conto\.sconto\}/)
  assert.match(contoNuova, /fontFamily: GEORGIA, fontSize: 28/)
  assert.match(contoNuova, /data-a-notte className="text-right"[\s\S]{0,120}fontSize: 12, color: 'var\(--color-stone\)'/)
  assert.match(contoNuova, /export const SALVA = 'Salva la prenotazione'/)
})

test('il salvataggio scrive le righe di sempre e apre la scheda nuova', () => {
  assert.match(pagina, /import \{ rigaDaSalvare, problemi \} from '@\/lib\/prenotazioneComposta'/)
  assert.match(pagina, /const fuori = problemi\(periodiColLetto,/)
  assert.match(pagina, /rigaDaSalvare\(p, camere\.find/)
  assert.match(pagina, /campiComePaga\(comePaga, \{/)
  assert.match(pagina, /router\.push\(`\/scheda\/\$\{prima\.id\}\?salvata=1`\)/)
  // la caparra si scrive una volta sola, sulla riga che arriva per prima
  assert.match(pagina, /p\.id === primo \? \{ caparra_centesimi: pagamento\.caparra_centesimi, caparra_entro: pagamento\.caparra_entro \} : \{\}/)
})

// ── 6. DOPO IL SALVATAGGIO ─────────────────────────────────────────────────
const scheda = readFileSync(new URL('../app/scheda/[id]/page.tsx', import.meta.url), 'utf8')
const adesso = readFileSync(new URL('../components/scheda/AdessoScheda.tsx', import.meta.url), 'utf8')

test('il totale di ogni riga si salva già scontato', () => {
  // due camere, 200 e 100, sconto del 10%: 180 e 90
  assert.deepEqual(totaliScontati([200, 100], { tipo: 'percentuale', valore: 10 }), [180, 90])
  // senza sconto restano com'erano
  assert.deepEqual(totaliScontati([200, 100], { tipo: 'nessuno', valore: null }), [200, 100])
  // prezzo finale: la somma torna esatta anche quando non è divisibile
  const finale = totaliScontati([100, 100, 100], { tipo: 'finale', valore: 250 })
  assert.equal(finale.reduce((s, t) => s + t, 0), 250)
  assert.match(pagina, /const scontati = totaliScontati\(base\.map\(r => Number\(r\.total_amount\) \|\| 0\), sconto\)/)
})

test('la scheda saluta la prenotazione appena salvata e poi smette', () => {
  assert.match(scheda, /export const PRENOTAZIONE_SALVATA = '✓ Prenotazione salvata'/)
  assert.match(scheda, /parametri\.get\('salvata'\) === '1'/)
  assert.match(scheda, /const t = setTimeout\(\(\) => setSalvata\(false\), SECONDI_SALVATA \* 1000\)/)
  assert.match(scheda, /data-salvata[\s\S]{0,200}onClick=\{\(\) => setSalvata\(false\)\}/)
  assert.match(scheda, /background: FONDO_SALVATA/)
})

test('«Adesso» sta sotto la fascia e sparisce quando la conferma è partita', () => {
  assert.match(adesso, /export const TITOLO_ADESSO = 'Adesso'/)
  assert.match(adesso, /\{TESTO_CONFERMA_IMMAGINE\}/)
  assert.match(adesso, /export const DATI_BONIFICO = 'Dati bonifico'/)
  assert.match(scheda, /const daFare = messaggiInviati\.every\(m => m\.message_type !== 'conferma'\) && ultimaPartenza > oggi/)
  // i dati del bonifico solo quando un bonifico è davvero atteso
  assert.match(scheda, /hrefBonifico=\{accordo\?\.bonifico \? hrefMessaggio\('dati_bonifico'\) : null\}/)
  // e sta prima di «Da controllare»
  assert.ok(scheda.indexOf('<AdessoScheda') < scheda.indexOf('id="controllare"'))
})

// ── La correzione dei soldi, anche nella pagina di adesso ──────────────────
test('con lo sconto il totale salvato è quello che la cliente paga davvero', () => {
  // il difetto: 4 notti × 70 = 280, sconto del 10% → la scheda mostrava 280
  const [riga] = totaliScontati([280], { tipo: 'percentuale', valore: 10 })
  assert.equal(riga, 252)
  // e quello che la scheda somma (i total_amount) torna col «Da pagare»
  const conto = contoNuovaPrenotazione(
    [{ id: 'a', gruppo: 'g', roomId: AMBRA.id, checkIn: '2026-12-05', checkOut: '2026-12-09', ospiti: 2, nottiLetto: [], letto: null, tariffa: 70 }],
    () => ({ ...AMBRA, base_price: 70 }) as never,
    { tipo: 'percentuale', valore: 10 },
  )
  assert.equal(conto.daPagare, '252 €')
  assert.equal(totaliScontati([280], { tipo: 'percentuale', valore: 10 })[0] * 100, conto.daPagareCent)

  // tutte e due le pagine scrivono il totale scontato
  const vecchia = readFileSync(new URL('../app/nuova/page.tsx', import.meta.url), 'utf8')
  assert.match(vecchia, /import \{ totaliScontati \} from '@\/lib\/nuovaPrenotazione'/)
  assert.match(vecchia, /total_amount: scontati\[i\]/)
  assert.match(pagina, /total_amount: scontati\[i\]/)
})

// ── 1. Gli ospiti arrivano al massimo VERO della camera (14/09/2026) ────────
// Ania si è fermata a 2: il «+» non saliva perché finché la camera non è
// scelta il massimo era la capienza di una camera qualunque.
test('il massimo degli ospiti è quello della camera scelta, letto compreso', () => {
  assert.equal(ospitiMassimi(LENA), 4)
  assert.equal(ospitiMassimi(ALLEGRA), 3)
  assert.equal(ospitiMassimi(AMBRA), 3)
  assert.equal(ospitiMassimi(AMELIA), 2)
})

test('senza camera scelta vale la più capiente della casa', () => {
  const soloLena = camereDelPeriodo(CAMERE, [
    { room_id: AMELIA.id, check_in: '2026-10-01', check_out: '2026-10-05', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' },
    { room_id: AMBRA.id, check_in: '2026-10-01', check_out: '2026-10-06', status: 'confermata' },
  ], '2026-10-02', '2026-10-04')
  assert.equal(rigaCamereLibere(soloLena, '2026-10-02', '2026-10-04'), 'libere: Lena')
  // resta libera solo Lena: il «+» deve poter arrivare a 4, non a 2
  assert.equal(ospitiMassimi(null, soloLena), 4)
  // con tutte libere vale comunque la più capiente
  assert.equal(ospitiMassimi(null, camereDelPeriodo(CAMERE, [], '2026-10-02', '2026-10-04')), 4)
  // e anche quando non è libera NESSUNA camera: il numero si scrive lo stesso,
  // poi si cercano le date giuste (Ania, 15/09/2026)
  assert.equal(ospitiMassimi(null, soloLena.map(s => ({ ...s, libera: false, tutte: false, notti: [] }))), 4)
  // solo senza nessuna camera in elenco non si promette niente
  assert.equal(ospitiMassimi(null, []), 2)
})

test('con più camere il massimo è la somma', () => {
  assert.equal(ospitiMassimiPrenotazione([LENA, AMBRA]), 7)
  assert.equal(ospitiMassimiPrenotazione([LENA, LENA]), 8)
  assert.equal(ospitiMassimiPrenotazione([AMELIA]), 2)
})

test('scegliendo la camera il numero scritto a mano non si perde', () => {
  // 3 ospiti scritti prima di scegliere: Lena li tiene
  assert.equal(ospitiScegliendoCamera(3, null, LENA), 3)
  // il numero lasciato com'era prende le persone solite della camera nuova
  assert.equal(ospitiScegliendoCamera(1, null, LENA), 2)
  assert.equal(ospitiScegliendoCamera(2, LENA, AMELIA), 1)
  // e non si sfora mai la capienza della camera nuova
  assert.equal(ospitiScegliendoCamera(4, LENA, ALLEGRA), 3)
})

test('oltre la capienza senza letto il letto si propone da solo', () => {
  const p: PeriodoComposto = { id: 'a', gruppo: 'g', roomId: LENA.id, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti: 3, nottiLetto: [], letto: null, tariffa: null }
  const dopo = conLettoAutomatico(p, LENA as never)
  assert.deepEqual(dopo.nottiLetto, ['2026-10-02', '2026-10-03'])
  assert.ok(dopo.letto)
  // e la pagina chiede il massimo alle camere, non a un numero fisso
  assert.match(pagina, /ospitiMax=\{ospitiMassimi\(camera, scelte\)\}/)
})

// ── 2. La tariffa a notte è già scritta (14/09/2026) ────────────────────────
// Era solo un suggerimento in grigio: Ania la vedeva vuota e scriveva 80 a mano.
test('scelta la camera, la tariffa a notte porta il listino di quella camera', () => {
  const periodo = (roomId: string, ospiti: number): PeriodoComposto => (
    { id: 'a', gruppo: 'g', roomId, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti, nottiLetto: [], letto: null, tariffa: null })
  assert.equal(tariffaProposta(periodo(LENA.id, 2), LENA as never), 80)
  assert.equal(tariffaProposta(periodo(LENA.id, 3), LENA as never), 90)
  assert.equal(tariffaProposta(periodo(AMELIA.id, 1), AMELIA as never), 70)
  assert.equal(tariffaProposta(periodo(ALLEGRA.id, 2), ALLEGRA as never), 80)

  // il campo la porta come VALORE, non come scritta in grigio
  const camera = readFileSync(new URL('../components/nuova/CameraSoggiorno.tsx', import.meta.url), 'utf8')
  assert.match(camera, /data-campo="tariffa" value=\{tariffa \?\? \(tariffaProposta \?\? ''\)\}/)
  assert.doesNotMatch(camera, /data-campo="tariffa"[^>]*placeholder/)
  // e la pagina gliela passa dalla camera scelta
  assert.match(pagina, /tariffaProposta=\{camera && linea\.periodi\[0\] \? tariffaProposta\(linea\.periodi\[0\], camera\) : null\}/)
})

test('il conto sta in piedi anche senza toccare la tariffa', () => {
  const conto = contoNuovaPrenotazione(
    [{ id: 'a', gruppo: 'g', roomId: LENA.id, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti: 3, nottiLetto: ['2026-10-02', '2026-10-03'], letto: null, tariffa: null }],
    () => LENA as never,
    { tipo: 'nessuno', valore: null },
  )
  assert.equal(conto.daPagare, '180 €')   // Lena tripla: 90 a notte, letto compreso
})

// ── 3. La striscia delle notti c'è, con le sue tre righe (14/09/2026) ───────
// Mancava del tutto finché la camera non era scelta: era il pezzo centrale
// della pagina e non compariva mai.
test('la striscia è quella della scheda, non una copia', () => {
  const camera = readFileSync(new URL('../components/nuova/CameraSoggiorno.tsx', import.meta.url), 'utf8')
  const scheda = readFileSync(new URL('../app/scheda/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(camera, /import StrisciaNottiCamere from '@\/components\/StrisciaNottiCamere'/)
  assert.match(scheda, /import StrisciaNottiCamere from '@\/components\/StrisciaNottiCamere'/)
  // sotto l'etichetta «LE NOTTI», subito dopo ospiti e tariffa
  assert.match(camera, /ETICHETTA_NOTTI = 'Le notti'/)
  assert.ok(camera.lastIndexOf('ETICHETTA_TARIFFA') < camera.lastIndexOf('ETICHETTA_NOTTI'))
  // e la pagina la passa SEMPRE, anche prima di scegliere la camera
  assert.match(pagina, /strisciaNotti=\{notti\}/)
})

test('ogni notte porta giorno, camera, letto e ospiti', () => {
  const notti = nottiDaPeriodi([
    { id: 'a', roomId: LENA.id, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti: 3, nottiLetto: ['2026-10-02', '2026-10-03'] },
  ], CAMERE as never)
  assert.equal(notti.length, 2)
  assert.deepEqual(notti.map(n => n.camera), ['Lena', 'Lena'])
  assert.deepEqual(notti.map(n => n.letto), [true, true])
  assert.deepEqual(notti.map(n => n.persone), [3, 3])
  assert.equal(giornoDellaNotte('2026-10-02').numero, 2)
  // senza camera la notte c'è lo stesso, da sistemare
  const senza = nottiDaPeriodi([{ id: 'a', roomId: null, checkIn: '2026-10-02', checkOut: '2026-10-03', ospiti: 2, nottiLetto: [] }], CAMERE as never)
  assert.equal(senza.length, 1)
  assert.equal(senza[0].camera, null)
  // il foglietto della notte: camera, letto e ospiti di quella notte sola
  const foglio = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /solo questa notte/i)
  assert.match(foglio, /da qui in poi/i)
})

// ── 4. Il letto in più (14/09/2026) ────────────────────────────────────────
// Non c'era modo di aggiungerlo: il blocco compariva solo se il letto era
// GIÀ acceso, cioè mai.
const sempreLibero = () => true
const sempreOccupato = () => false
const periodoLena = (ospiti: number, nottiLetto: string[] = []): PeriodoComposto => (
  { id: 'a', gruppo: 'g', roomId: LENA.id, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti, nottiLetto, letto: null, tariffa: null })

test('il blocco del letto c’è appena la camera lo prevede, anche da spento', () => {
  const stato = statoLettoNuova([periodoLena(2)], () => LENA as never, sempreLibero)
  assert.equal(stato.possibile, true)
  assert.equal(stato.acceso, false)
  assert.equal(stato.testo, null)
  // senza camera scelta non si promette nessun letto
  const senza = statoLettoNuova([{ ...periodoLena(2), roomId: null }], () => null, sempreLibero)
  assert.equal(senza.possibile, false)
})

test('se i due letti di casa sono impegnati resta spento con «non disponibile»', () => {
  const stato = statoLettoNuova([periodoLena(2)], () => LENA as never, sempreOccupato)
  assert.equal(stato.nonDisponibile, true)
  assert.equal(stato.testo, LETTO_NON_DISPONIBILE_TESTO)
  // acceso su una notte, l'avviso non serve più
  const acceso = statoLettoNuova([periodoLena(3, ['2026-10-02'])], () => LENA as never, sempreOccupato)
  assert.equal(acceso.acceso, true)
  assert.equal(acceso.nonDisponibile, false)
})

test('il letto si accende da solo quando gli ospiti lo richiedono, e costa il listino', () => {
  const dopo = conLettoAutomatico(periodoLena(3), LENA as never)
  assert.deepEqual(dopo.nottiLetto, ['2026-10-02', '2026-10-03'])
  assert.equal(statoLettoNuova([dopo], () => LENA as never, sempreLibero).acceso, true)
  // il listino accanto al campo: Amelia 5 €, le altre 10 €
  assert.equal(listinoLetto([{ nome: 'Amelia', importo: 5 }]), 'di listino · Amelia 5 €')
  assert.equal(listinoLetto([{ nome: 'Allegra', importo: 10 }]), 'di listino · Allegra 10 €')
  // e la pagina mostra il blocco in base allo stato, non al letto già acceso
  assert.match(pagina, /\{statoLetto\.possibile && \(/)
  assert.doesNotMatch(pagina, /periodi\.some\(p => p\.nottiLetto\.length > 0\) && \(/)
})

// ── 5. Il conto si vede, e dice cosa manca davvero (14/09/2026) ─────────────
// Diceva «da completare» con date, camera, ospiti e tariffa a posto.
test('con date e camera il conto c’è, e non manca niente', () => {
  const periodi = [periodoLena(3, ['2026-10-02', '2026-10-03'])]
  const conto = contoNuovaPrenotazione(periodi, () => LENA as never, { tipo: 'nessuno', valore: null })
  assert.equal(conto.daPagare, '180 €')
  assert.equal(mancaAlConto(periodi, () => LENA as never), null)
  // la tariffa vuota NON ferma il conto: vale il listino
  assert.equal(periodi[0].tariffa, null)
  // e nemmeno «come paga»: riguarda l'incasso, non il conto
  assert.equal(mancaAlConto(periodi, () => LENA as never), null)
})

test('quello che ferma il conto è solo la camera o le date', () => {
  assert.equal(mancaAlConto([], () => null), MANCA_CAMERA)
  assert.equal(mancaAlConto([{ ...periodoLena(2), roomId: null }], () => null), MANCA_CAMERA)
  assert.equal(mancaAlConto([{ ...periodoLena(2), checkOut: '2026-10-02' }], () => LENA as never), MANCA_DATE)
  // e si scrive in ottone sotto il totale
  const contoTsx = readFileSync(new URL('../components/nuova/ContoNuova.tsx', import.meta.url), 'utf8')
  assert.match(contoTsx, /data-manca-conto[\s\S]{0,160}color: OTTONE/)
  assert.match(pagina, /manca=\{mancaAlConto\(periodiColLetto, trovaCamera\)\}/)
})

test('il conto si aggiorna a ogni tocco: sconto, letto, ospiti', () => {
  const camera = () => LENA as never
  const base = contoNuovaPrenotazione([periodoLena(2)], camera, { tipo: 'nessuno', valore: null })
  assert.equal(base.daPagare, '160 €')                                   // 2 notti × 80
  const inTre = contoNuovaPrenotazione([periodoLena(3, ['2026-10-02', '2026-10-03'])], camera, { tipo: 'nessuno', valore: null })
  assert.equal(inTre.daPagare, '180 €')                                  // tripla 90, letto compreso
  const scontato = contoNuovaPrenotazione([periodoLena(3, ['2026-10-02', '2026-10-03'])], camera, { tipo: 'percentuale', valore: 10 })
  assert.equal(scontato.totale, '180 €')
  assert.equal(scontato.sconto, '18 €')
  assert.equal(scontato.daPagare, '162 €')
})

// ── 6. «+ Aggiungi camera» si raggiunge (14/09/2026) ───────────────────────
// Era alto 29 px: sul telefono il dito non lo prendeva.
test('il tastino «+ Aggiungi camera» è centrato dopo lo sconto e si tocca', () => {
  const pezzi = readFileSync(new URL('../components/nuova/PezziNuova.tsx', import.meta.url), 'utf8')
  assert.match(pezzi, /ALTEZZA_TOCCO = 44/)
  assert.match(pezzi, /TastinoTenue[\s\S]{0,600}minHeight: ALTEZZA_TOCCO/)
  assert.match(pezzi, /TastinoTenue[\s\S]{0,400}centrato \? 'text-center' : ''/)
  // dopo lo sconto, prima di «Arrivo»
  const dopoSconto = pagina.indexOf('data-sconto')
  const tastino = pagina.indexOf('dati="aggiungi-camera"')
  const arrivo = pagina.indexOf('data-arrivo')
  assert.ok(dopoSconto > 0 && dopoSconto < tastino && tastino < arrivo)
  // e apre una camera nuova, con le sue date e i suoi ospiti
  assert.match(pagina, /function aggiungiCamera\(\)[\s\S]{0,400}roomId: null/)
})

// ── 7. «Salva la prenotazione» o salva, o dice cosa manca (14/09/2026) ──────
// Ania lo toccava e non succedeva niente: il tasto era spento perché il conto
// era incompleto, e un tasto spento non dice niente.
test('il tasto non è più spento quando il conto è incompleto', () => {
  const conto = readFileSync(new URL('../components/nuova/ContoNuova.tsx', import.meta.url), 'utf8')
  assert.match(pagina, /salvaSpento=\{salvando\} avviso=\{avvisoSalva\}/)
  assert.doesNotMatch(pagina, /salvaSpento=\{salvando \|\| conto\.daPagareCent === null\}/)
  // l'avviso sta accanto al tasto, in mattone
  assert.match(conto, /data-avviso-salva[\s\S]{0,200}color: MATTONE/)
})

test('senza camera il tasto dice cosa manca e porta la pagina sulla camera', () => {
  const guai = problemi([{ ...periodoLena(2), roomId: null }], () => null)
  const manca = doveManca(guai)
  assert.ok(manca)
  assert.match(manca.avviso, /camera/i)
  assert.equal(manca.dove, '[data-camera-soggiorno]')
  // e la pagina ci scorre sopra
  assert.match(pagina, /querySelector\(manca\.dove\)\?\.scrollIntoView/)
})

test('ogni campo che ferma il salvataggio ha il suo posto', () => {
  assert.equal(doveManca(['Lena: la partenza deve venire dopo l’arrivo.'])?.dove, '[data-campo="arrivo"]')
  assert.equal(doveManca(['Lena tiene al massimo 4 persone.'])?.dove, '[data-ospiti]')
  assert.equal(doveManca(['La caparra deve essere un importo positivo.'])?.dove, '[data-come-paga-parte]')
  assert.equal(doveManca(['L’orario di arrivo è incompleto: scrivi per esempio 15:30.'])?.dove, '[data-arrivo]')
  assert.equal(doveManca([]), null)
})

test('con tutto a posto non manca niente e si salva', () => {
  const periodi = [periodoLena(3, ['2026-10-02', '2026-10-03'])]
  assert.deepEqual(problemi(periodi, () => LENA as never), [])
  assert.equal(doveManca(problemi(periodi, () => LENA as never)), null)
  assert.equal(mancaAlConto(periodi, () => LENA as never), null)
})

// ── 1. La striscia guarda notte per notte (14/09/2026) ─────────────────────
// 14 → 18 settembre: il 14 e il 15 non c'è niente, il 16 e il 17 sì. Prima
// tutte e quattro le notti erano «da sistemare» e nessuna camera si sceglieva.
const PIENE = [
  { room_id: AMELIA.id, check_in: '2026-09-13', check_out: '2026-09-16', status: 'confermata' },
  { room_id: ALLEGRA.id, check_in: '2026-09-14', check_out: '2026-09-16', status: 'confermata' },
  { room_id: AMBRA.id, check_in: '2026-09-11', check_out: '2026-09-16', status: 'confermata' },
  { room_id: LENA.id, check_in: '2026-09-13', check_out: '2026-09-16', status: 'confermata' },
]

test('le notti libere restano scegliibili anche se le prime sono piene', () => {
  const scelte = camereDelPeriodo(CAMERE, PIENE, '2026-09-14', '2026-09-18')
  const lena = scelte.find(s => s.camera.name === 'Lena')!
  assert.equal(lena.libera, true)                      // la pastiglia si può toccare
  assert.equal(lena.tutte, false)
  assert.deepEqual(lena.notti, ['2026-09-16', '2026-09-17'])
  // la frase «libere solo per qualche notte» è stata tolta: non diceva quando
  assert.equal(rigaCamereLibere(scelte, '2026-09-14', '2026-09-18'), '')
})

test('scegliendo Lena la camera va solo nelle notti in cui è libera', () => {
  const scelte = camereDelPeriodo(CAMERE, PIENE, '2026-09-14', '2026-09-18')
  const libera = (iso: string, id: string) => scelte.find(s => s.camera.id === id)?.notti.includes(iso) ?? false
  let contatore = 0
  const periodi = periodiDellaLinea(
    { gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, [],
    { cameraScelta: LENA.id, libera, ospiti: 3 }, () => `n${++contatore}`,
  )
  // due tratti: le notti senza camera NON si perdono, il soggiorno resta di 4 notti
  assert.equal(periodi.length, 2)
  assert.deepEqual(periodi.map(p => [p.roomId, p.checkIn, p.checkOut]), [
    [null, '2026-09-14', '2026-09-16'],
    [LENA.id, '2026-09-16', '2026-09-18'],
  ])
  assert.equal(nottiDellaLinea({ gruppo: 'g', periodi }), 4)
  // e la linea mostra Lena come camera scelta, anche se le prime notti sono vuote
  assert.equal(datiLinea({ gruppo: 'g', periodi }).roomId, LENA.id)
  assert.equal(datiLinea({ gruppo: 'g', periodi }).arrivo, '2026-09-14')
  assert.equal(datiLinea({ gruppo: 'g', periodi }).partenza, '2026-09-18')
})

test('solo le notti davvero senza camere restano «da sistemare», e lo dicono una volta sola', () => {
  const scelte = camereDelPeriodo(CAMERE, PIENE, '2026-09-14', '2026-09-18')
  const libera = (iso: string, id: string) => scelte.find(s => s.camera.id === id)?.notti.includes(iso) ?? false
  let c = 0
  const periodi = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, [], { cameraScelta: LENA.id, libera, ospiti: 3 }, () => `n${++c}`)
  const notti = nottiDaPeriodi(periodi, CAMERE as never)
  assert.deepEqual(notti.map(n => n.camera), [null, null, 'Lena', 'Lena'])
  // che cosa manca, e basta: il perché non si scrive (Ania, 15/09/2026)
  assert.deepEqual(avvisiStriscia(notti), ['lun 14 e mar 15 senza camera'])
})

test('nessuna camera per nessuna notte: lo dice una volta, non quattro', () => {
  const tutte = CAMERE.map(c => ({ room_id: c.id, check_in: '2026-09-14', check_out: '2026-09-18', status: 'confermata' }))
  const scelte = camereDelPeriodo(CAMERE, tutte, '2026-09-14', '2026-09-18')
  assert.equal(rigaCamereLibere(scelte, '2026-09-14', '2026-09-18'), 'nessuna camera libera in queste date')
  const periodi: PeriodoComposto[] = [{ id: 'a', gruppo: 'g', roomId: null, checkIn: '2026-09-14', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [], letto: null, tariffa: null }]
  const notti = nottiDaPeriodi(periodi, CAMERE as never)
  assert.equal(avvisiStriscia(notti).length, 1)
  assert.deepEqual(avvisiStriscia(notti), ['lun 14, mar 15, mer 16 e gio 17 senza camera'])
})

test('la disponibilità è quella di lib/disponibilita, chiesta una notte alla volta', () => {
  const fonte = readFileSync(new URL('./nuovaPrenotazione.ts', import.meta.url), 'utf8')
  assert.match(fonte, /import \{ camereLibere,/)
  assert.match(fonte, /camereDelPeriodo[\s\S]{0,900}camereLibere\(camere, altre, g, giornoDopo\(g\), 1\)/)
  // le stesse regole del foglietto della notte
  const striscia = readFileSync(new URL('./strisciaNotti.ts', import.meta.url), 'utf8')
  assert.match(striscia, /camereDellaNotte[\s\S]{0,200}camereLibere\(contesto\.camere, contesto\.altre, iso, giornoDopo\(iso\), 1\)/)
  // e la pagina non spalma più la camera sull'intero soggiorno
  assert.match(pagina, /periodiDellaLinea\(\{/)
  assert.match(pagina, /const notti = nottiDaPeriodi\(linea\.periodi, camere\)/)
})

// ── 10. Quattro ospiti in Lena: 100 € e letto acceso (14/09/2026) ──────────
// Il letto della prenotazione partiva con importo null e la pagina lo leggeva
// come ZERO: la quarta persona non costava niente e la notte restava a 90.
test('Lena a 4: il letto si accende da solo e la notte va a 100 €', () => {
  const p = periodoLena(4)
  const dopo = conLettoAutomatico(p, LENA as never)
  assert.deepEqual(dopo.nottiLetto, ['2026-10-02', '2026-10-03'])   // acceso da solo
  assert.equal(lettoProposto(LENA as never, 4), 10)                 // listino della camera
  const conLetto = { ...dopo, letto: { importo: lettoProposto(LENA as never, 4), criterio: 'notte' as const } }
  const conto = contoNuovaPrenotazione([conLetto], () => LENA as never, { tipo: 'nessuno', valore: null })
  assert.equal(conto.totale, '200 €')            // 2 notti × (90 + 10)
  assert.equal(conto.aNotte, '2 notti · 100 € a notte')
})

test('Lena a 3 resta 90 €: il terzo posto è compreso nella tripla', () => {
  const dopo = conLettoAutomatico(periodoLena(3), LENA as never)
  assert.equal(lettoProposto(LENA as never, 3), 0)
  const conLetto = { ...dopo, letto: { importo: lettoProposto(LENA as never, 3), criterio: 'notte' as const } }
  assert.equal(contoNuovaPrenotazione([conLetto], () => LENA as never, { tipo: 'nessuno', valore: null }).totale, '180 €')
})

test('gli altri listini del letto: Amelia 5 €, le altre 10 €', () => {
  assert.equal(lettoProposto(AMELIA as never, 2), 5)
  assert.equal(lettoProposto(ALLEGRA as never, 3), 10)
  assert.equal(lettoProposto(AMBRA as never, 3), 10)
  // la pagina non legge più «niente» come zero
  assert.match(pagina, /importo: letto\.importo \?\? lettoProposto\(trovaCamera\(p\.roomId\), p\.ospiti\)/)
})

// ── 9. Il calendario delle date è quello del telefono (14/09/2026) ─────────
test('la data si legge in italiano: «gio 10 set»', () => {
  assert.equal(dataConGiorno('2026-09-10'), 'gio 10 set')
  assert.equal(dataConGiorno('2026-10-02'), 'ven 2 ott')
  assert.equal(dataConGiorno(null), '')
})

test('il campo data è quello nativo, senza riquadro e senza librerie', () => {
  const campo = readFileSync(new URL('../components/nuova/CampoData.tsx', import.meta.url), 'utf8')
  assert.match(campo, /<input type="date"/)
  assert.match(campo, /opacity: 0/)                       // sopra, invisibile: il tocco apre il calendario del telefono
  assert.match(campo, /fontSize: 16, fontWeight: 600/)    // la data scritta, 16 px semibold
  assert.match(campo, /dataConGiorno\(valore\)/)
  // sul Mac toccare il testo di un campo data non apre niente: lo chiediamo noi
  assert.match(campo, /showPicker\?\.\(\)/)
  assert.match(campo, /onClick=\{e => apriSelettore\(e\.currentTarget\)\}/)
  // solo sul tocco: sul fuoco si riapriva da solo appena si chiudeva
  assert.doesNotMatch(campo, /onFocus=\{e => apriSelettore/)
  // e il rifiuto del browser non deve rompere la pagina
  assert.match(campo, /try \{ el\.showPicker\?\.\(\) \} catch/)
  // l'area del tocco prende tutta la riga, etichetta compresa
  assert.match(campo, /top: -8, bottom: -8/)
  assert.doesNotMatch(campo, /react-day-picker|react-datepicker|flatpickr|from 'date-fns/)
  // la riga col filo sotto, come le altre della pagina
  assert.match(campo, /RigaCampo etichetta=\{etichetta\}/)
  // arrivo e partenza lo usano, e la partenza non può venire prima dell'arrivo
  const camera = readFileSync(new URL('../components/nuova/CameraSoggiorno.tsx', import.meta.url), 'utf8')
  assert.match(camera, /<CampoData etichetta="Arrivo"[^/]*dati="arrivo"/)
  assert.match(camera, /<CampoData etichetta="Partenza"[^/]*min=\{giornoDopo\(arrivo\)\}[^/]*dati="partenza"/)
  // e la scadenza della caparra è vestita allo stesso modo
  const comePaga = readFileSync(new URL('../components/ComePaga.tsx', import.meta.url), 'utf8')
  assert.match(comePaga, /dataConGiorno\(data\)/)
  assert.match(comePaga, /data-entro-il[\s\S]{0,400}opacity: 0/)
  assert.match(comePaga, /apriSelettore\(e\.currentTarget\)/)
})

// ── 4. Le tre righe della striscia, e gli ospiti nel foglietto (14/09/2026) ─
test('ogni colonnina ha giorno, camera, quadratino del letto e ospiti', () => {
  const striscia = readFileSync(new URL('../components/StrisciaNottiCamere.tsx', import.meta.url), 'utf8')
  // 1ª riga il giorno, 2ª la camera, 3ª il letto, 4ª gli ospiti — in quest'ordine
  const ordine = ['<Giorno iso=', 'data-camera-notte', 'data-letto-notte', 'data-ospiti-notte']
  const posti = ordine.map(x => striscia.indexOf(x))
  assert.deepEqual(posti, [...posti].sort((a, z) => a - z))
  assert.ok(posti.every(x => x > 0))
  // gli ospiti: Georgia 15 px, mattone quando sono diversi da quelli del soggiorno
  assert.match(striscia, /data-ospiti-notte[\s\S]{0,320}fontFamily: GEORGIA, fontSize: 15/)
  assert.match(striscia, /n\.persone === ospitiAttesi \? 'var\(--color-green-dark\)' : MATTONE_OSPITI/)
  assert.match(striscia, /MATTONE_OSPITI = '#8a4f2f'/)
  // e la pagina glieli passa
  const camera = readFileSync(new URL('../components/nuova/CameraSoggiorno.tsx', import.meta.url), 'utf8')
  assert.match(camera, /ospitiAttesi=\{ospiti\}/)
})

test('il foglietto della notte cambia camera, letto E ospiti, per una notte o da lì in poi', () => {
  const foglio = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /ospitiPossibili && notte\.dentro/)
  assert.match(foglio, /data-ospiti-giu/)
  assert.match(foglio, /data-ospiti-su/)
  assert.match(foglio, /DOMANDA_SOLO_QUESTA/)
  assert.match(foglio, /DOMANDA_DA_QUI/)
  // «Non dorme qui» c'è sempre, anche nelle notti senza camera libera
  assert.match(foglio, /data-non-dorme/)
  assert.match(foglio, /NESSUNA_CAMERA_LIBERA/)
  // i valori possibili sono solo quelli salvabili
  assert.deepEqual(ospitiPossibiliNotte(LENA, 3), [2, 3])
  assert.deepEqual(ospitiPossibiliNotte(LENA, 4), [2, 3, 4])
  assert.deepEqual(ospitiPossibiliNotte(AMELIA, 2), [1, 2])
})

test('gli ospiti di una notte: col letto tutti, senza letto quelli della camera', () => {
  assert.equal(ospitiDellaNotte(LENA, 3, true), 3)
  assert.equal(ospitiDellaNotte(LENA, 3, false), 2)
  const notti = nottiDaPeriodi([
    { id: 'a', roomId: LENA.id, checkIn: '2026-10-02', checkOut: '2026-10-04', ospiti: 3, nottiLetto: ['2026-10-03'] },
  ], CAMERE as never)
  assert.deepEqual(notti.map(n => n.persone), [2, 3])   // la prima notte senza letto, la seconda con
})

// ── Il letto salvato: importo e criterio vanno insieme (15/09/2026) ─────────
// In produzione il salvataggio moriva su bookings_extra_bed_accordo_coerente
// (proposta 0048): con l'importo non scritto a mano finiva `null` accanto a
// «a notte», e il database rifiutava tutta la prenotazione.
test('col letto acceso si salvano sempre importo E criterio, mai uno solo', () => {
  // la pagina scrive quello che il conto ha applicato, non lo stato grezzo
  assert.match(pagina, /extra_bed_importo: p\.letto\.importo, extra_bed_criterio: p\.letto\.criterio/)
  assert.doesNotMatch(pagina, /extra_bed_importo: letto\.importo/)
  assert.match(pagina, /p\.nottiLetto\.length > 0 && p\.letto/)

  // e l'importo applicato è un numero anche quando il letto è «compreso»
  const conLetto = (ospiti: number) => {
    const p = conLettoAutomatico(periodoLena(ospiti), LENA as never)
    return { ...p, letto: { importo: 0 + lettoProposto(LENA as never, p.ospiti), criterio: 'notte' as const } }
  }
  assert.equal(conLetto(3).letto.importo, 0)    // Lena tripla: compreso, ma zero è un numero
  assert.equal(conLetto(4).letto.importo, 10)
  assert.notEqual(conLetto(3).letto.importo, null)
  // il vincolo del database: o tutti e due, o nessuno dei due
  const sql = readFileSync(new URL('../supabase/migrations/0048_letto_accordo.sql', import.meta.url), 'utf8')
  assert.match(sql, /\(extra_bed_importo is null\) = \(extra_bed_criterio is null\)/)
})

// ── 2. Il foglietto offre le camere libere DI QUELLA NOTTE (15/09/2026) ─────
// Anche quando in un'altra notte è già stata scelta un'altra camera: è così
// che si compone un soggiorno su più camere, quando in una sola non c'è posto.
test('scelta Allegra il 16, il foglietto del 17 offre comunque Lena', () => {
  // la situazione vera del 14→18 settembre: il 16 è libera solo Allegra,
  // il 17 solo Lena
  const altre = [
    { room_id: AMELIA.id, check_in: '2026-09-13', check_out: '2026-09-21', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-09-14', check_out: '2026-09-16', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-09-17', check_out: '2026-09-18', status: 'confermata' },
    { room_id: AMBRA.id, check_in: '2026-09-11', check_out: '2026-09-20', status: 'confermata' },
    { room_id: LENA.id, check_in: '2026-09-13', check_out: '2026-09-17', status: 'confermata' },
  ]
  const contesto = { camere: CAMERE as never, altre, ospiti: 2 }
  assert.deepEqual(camereDellaNotte('2026-09-16', contesto).map(c => c.name), ['Allegra'])
  assert.deepEqual(camereDellaNotte('2026-09-17', contesto).map(c => c.name), ['Lena'])
  // le notti senza niente restano senza niente
  assert.deepEqual(camereDellaNotte('2026-09-14', contesto).map(c => c.name), [])
})

test('la camera scelta nelle altre notti dello stesso soggiorno non occupa', () => {
  // la pagina toglie dal contesto i periodi della linea che sta modificando:
  // altrimenti Allegra, scelta per il 16, si toglierebbe da sola dall'elenco
  assert.match(pagina, /const miei = new Set\(linea\?\.periodi\.map\(p => p\.id\)\)/)
  assert.match(pagina, /periodi\.filter\(p => !miei\.has\(p\.id\) && p\.roomId\)/)
  // e il foglietto chiede proprio quelle camere lì
  const foglio = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /const libere = camereDellaNotte\(iso, contesto\)/)
  assert.match(foglio, /data-camera=\{c\.name\}/)
  // scegliere una camera cambia SOLO quella notte
  assert.match(foglio, /setBozza\(b => cambiaCamera\(b, iso, c, contesto\)\)/)
})

test('scegliere la camera di una notte non tocca le altre', () => {
  const notti = [
    { iso: '2026-09-16', cameraId: ALLEGRA.id, camera: 'Allegra', letto: false, dentro: true, persone: 2, motivo: null, parallela: false },
    { iso: '2026-09-17', cameraId: null, camera: null, letto: false, dentro: true, persone: 2, motivo: null, parallela: false },
  ]
  const dopo = cambiaCameraNotte(notti, '2026-09-17', LENA as never, { camere: CAMERE as never, altre: [], ospiti: 2 })
  assert.deepEqual(dopo.map(n => n.camera), ['Allegra', 'Lena'])
  // e da lì esce una prenotazione con due righe, una per camera
  const linea = { gruppo: 'g', periodi: [{ id: 'a', gruppo: 'g', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [], letto: null, tariffa: null }] }
  let c = 0
  const periodi = periodiDaNottiTenendoVuote(dopo, linea, () => `n${++c}`)
  assert.deepEqual(periodi.map(p => [p.roomId, p.checkIn, p.checkOut]), [
    [ALLEGRA.id, '2026-09-16', '2026-09-17'],
    [LENA.id, '2026-09-17', '2026-09-18'],
  ])
  const conto = contoNuovaPrenotazione(periodi, id => (CAMERE.find(x => x.id === id) ?? null) as never, { tipo: 'nessuno', valore: null })
  assert.deepEqual(conto.righe.map(r => r.titolo), ['Allegra', 'Lena'])
})

// ── 3. Sotto la striscia solo quello che manca (15/09/2026) ────────────────
test('la riga sotto le pastiglie parla solo di chi copre tutto il soggiorno', () => {
  const conPezzi = camereDelPeriodo(CAMERE, PIENE, '2026-09-14', '2026-09-18')
  assert.equal(rigaCamereLibere(conPezzi, '2026-09-14', '2026-09-18'), '')   // niente frase inutile
  // ma le pastiglie di chi è libero in QUALCHE notte restano accese
  assert.deepEqual(conPezzi.filter(s => s.libera).map(s => s.camera.name), ['Amelia', 'Allegra', 'Ambra', 'Lena'])
  // chi non è libero in NESSUNA notte resta spento
  const soloLena = camereDelPeriodo(CAMERE, [
    { room_id: AMELIA.id, check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' },
    { room_id: AMBRA.id, check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' },
  ], '2026-10-02', '2026-10-04')
  assert.deepEqual(soloLena.filter(s => !s.libera).map(s => s.camera.name), ['Amelia', 'Allegra', 'Ambra'])
  assert.equal(rigaCamereLibere(soloLena, '2026-10-02', '2026-10-04'), 'libere: Lena')
  // i due casi netti restano
  assert.equal(rigaCamereLibere(camereDelPeriodo(CAMERE, [], '2026-10-02', '2026-10-04'), '2026-10-02', '2026-10-04'), 'tutte le camere libere')
  const tutte = CAMERE.map(c => ({ room_id: c.id, check_in: '2026-10-02', check_out: '2026-10-04', status: 'confermata' }))
  assert.equal(rigaCamereLibere(camereDelPeriodo(CAMERE, tutte, '2026-10-02', '2026-10-04'), '2026-10-02', '2026-10-04'), 'nessuna camera libera in queste date')
})

test('con tutte le notti a posto sotto la striscia resta solo il riassunto', () => {
  const periodi: PeriodoComposto[] = [
    { id: 'a', gruppo: 'g', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-17', ospiti: 2, nottiLetto: [], letto: null, tariffa: null },
    { id: 'b', gruppo: 'g', roomId: LENA.id, checkIn: '2026-09-17', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [], letto: null, tariffa: null },
  ]
  const notti = nottiDaPeriodi(periodi, CAMERE as never)
  assert.deepEqual(avvisiStriscia(notti), [])
  assert.equal(riassuntoStriscia(notti), '1 cambio camera')
})

// ── Le notti sistemate a mano non si perdono (15/09/2026) ──────────────────
// Il difetto: la riga si rifaceva da capo da UNA camera sola, quindi toccando
// gli ospiti (o le date, o una pastiglia) la camera messa a mano su un'altra
// notte spariva. Adesso camera, ospiti e letto si tengono notte per notte.
// la situazione vera del 14 → 18: il 16 è libera solo Allegra, il 17 solo Lena
const LIBERA_14_18 = (() => {
  const scelte = camereDelPeriodo(CAMERE, [
    { room_id: AMELIA.id, check_in: '2026-09-13', check_out: '2026-09-21', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-09-14', check_out: '2026-09-16', status: 'confermata' },
    { room_id: ALLEGRA.id, check_in: '2026-09-17', check_out: '2026-09-18', status: 'confermata' },
    { room_id: AMBRA.id, check_in: '2026-09-11', check_out: '2026-09-20', status: 'confermata' },
    { room_id: LENA.id, check_in: '2026-09-13', check_out: '2026-09-17', status: 'confermata' },
  ], '2026-09-14', '2026-09-18')
  return (iso: string, id: string) => scelte.find(s => s.camera.id === id)?.notti.includes(iso) ?? false
})()
const contaId = () => { let n = 0; return () => `n${++n}` }

/** i periodi che restano dopo aver messo a mano una camera su una notte */
function aMano(periodi: PeriodoComposto[], iso: string, camera: { id: string; name: string }): PeriodoComposto[] {
  const linea = { gruppo: 'g', periodi }
  const notti = cambiaCameraNotte(nottiDaPeriodi(periodi, CAMERE as never), iso, camera as never, { camere: CAMERE as never, altre: [], ospiti: 2 })
  return periodiDaNottiTenendoVuote(notti, linea, contaId())
}

const VUOTO: PeriodoComposto[] = [{ id: 'a', gruppo: 'g', roomId: null, checkIn: '2026-09-14', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [], letto: null, tariffa: null }]

test('due notti sistemate a mano tengono camere diverse', () => {
  const dopoAllegra = aMano(VUOTO, '2026-09-16', ALLEGRA)
  const dopoLena = aMano(dopoAllegra, '2026-09-17', LENA)
  const notti = nottiDaPeriodi(dopoLena, CAMERE as never)
  assert.deepEqual(notti.map(n => n.camera), [null, null, 'Allegra', 'Lena'])
  assert.equal(riassuntoStriscia(notti), '1 cambio camera')
  assert.deepEqual(avvisiStriscia(notti), ['lun 14 e mar 15 senza camera'])
  const conto = contoNuovaPrenotazione(dopoLena, id => (CAMERE.find(c => c.id === id) ?? null) as never, { tipo: 'nessuno', valore: null })
  assert.deepEqual(conto.righe.map(r => r.titolo), ['Allegra', 'Lena'])
})

test('una terza notte a mano non tocca le prime due', () => {
  let periodi = aMano(VUOTO, '2026-09-15', AMBRA)
  periodi = aMano(periodi, '2026-09-16', ALLEGRA)
  periodi = aMano(periodi, '2026-09-17', LENA)
  const notti = nottiDaPeriodi(periodi, CAMERE as never)
  assert.deepEqual(notti.map(n => n.camera), [null, 'Ambra', 'Allegra', 'Lena'])
  assert.equal(cambiCamera(notti), 2)
  const conto = contoNuovaPrenotazione(periodi, id => (CAMERE.find(c => c.id === id) ?? null) as never, { tipo: 'nessuno', valore: null })
  assert.deepEqual(conto.righe.map(r => r.titolo), ['Ambra', 'Allegra', 'Lena'])
})

test('toccando gli ospiti in alto le camere delle notti restano', () => {
  const conDue = aMano(aMano(VUOTO, '2026-09-16', ALLEGRA), '2026-09-17', LENA)
  const dopo = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, conDue, { ospiti: 3 }, contaId())
  const notti = nottiDaPeriodi(dopo, CAMERE as never)
  assert.deepEqual(notti.map(n => n.camera), [null, null, 'Allegra', 'Lena'])
  assert.equal(dopo.every(p => p.ospiti === 3), true)
})

test('toccando le date le camere già messe restano, e le notti nuove sono vuote', () => {
  const conDue = aMano(aMano(VUOTO, '2026-09-16', ALLEGRA), '2026-09-17', LENA)
  const piuLunga = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-19' }, conDue, {}, contaId())
  assert.deepEqual(nottiDaPeriodi(piuLunga, CAMERE as never).map(n => n.camera), [null, null, 'Allegra', 'Lena', null])
  const piuCorta = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-16', partenza: '2026-09-18' }, conDue, {}, contaId())
  assert.deepEqual(nottiDaPeriodi(piuCorta, CAMERE as never).map(n => n.camera), ['Allegra', 'Lena'])
})

test('la pastiglia in alto riempie le notti libere e lascia stare le altre', () => {
  const conAllegra = aMano(VUOTO, '2026-09-16', ALLEGRA)
  // Lena è libera solo il 17: il 16 resta Allegra
  const dopo = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, conAllegra,
    { cameraScelta: LENA.id, libera: LIBERA_14_18 }, contaId())
  assert.deepEqual(nottiDaPeriodi(dopo, CAMERE as never).map(n => n.camera), [null, null, 'Allegra', 'Lena'])
})

test('il letto e gli ospiti di una notte non toccano le altre', () => {
  const contesto = { camere: CAMERE as never, altre: [], ospiti: 3 }
  let periodi = aMano(aMano(VUOTO, '2026-09-16', LENA), '2026-09-17', LENA)
  // tre persone solo la notte del 17
  let notti = cambiaOspitiNotte(nottiDaPeriodi(periodi, CAMERE as never), '2026-09-17', 3, contesto)
  periodi = periodiDaNottiTenendoVuote(notti, { gruppo: 'g', periodi }, contaId())
  notti = nottiDaPeriodi(periodi, CAMERE as never)
  assert.deepEqual(notti.map(n => n.persone), [2, 2, 2, 3])
  assert.deepEqual(notti.map(n => n.letto), [false, false, false, true])
  // e le camere sono rimaste dov'erano
  assert.deepEqual(notti.map(n => n.camera), [null, null, 'Lena', 'Lena'])
  // «No» con tre persone in Lena non fa niente: il letto serve per forza, e
  // soprattutto gli ospiti NON tornano a due da soli (Ania, 15/09/2026)
  const rifiutato = cambiaLettoNotte(notti, '2026-09-17', false, contesto, { ospitiAParte: true })
  assert.deepEqual(rifiutato.map(n => n.persone), [2, 2, 2, 3])
  assert.deepEqual(rifiutato.map(n => n.letto), [false, false, false, true])
  // riportando la notte a due persone il letto si può spegnere, e il 16 non si muove
  const dueInTre = cambiaOspitiNotte(notti, '2026-09-17', 2, contesto)
  const senzaLetto = cambiaLettoNotte(dueInTre, '2026-09-17', false, contesto, { ospitiAParte: true })
  assert.deepEqual(senzaLetto.map(n => n.persone), [2, 2, 2, 2])
  assert.deepEqual(senzaLetto.map(n => n.letto), [false, false, false, false])
  assert.deepEqual(senzaLetto.map(n => n.camera), [null, null, 'Lena', 'Lena'])
})

// ── Letto e ospiti di una notte non si combattono (15/09/2026) ─────────────
// Il difetto: toccando «No» o «Sì» sul letto, gli ospiti della notte venivano
// rimessi a posto da soli, e non si riusciva a tenere 3 persone col letto.
const CONTESTO = { camere: CAMERE as never, altre: [], ospiti: 2 }

test('toccare il letto non cambia MAI gli ospiti della notte', () => {
  const inTre = cambiaOspitiNotte(
    nottiDaPeriodi([{ id: 'a', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-17', ospiti: 3, nottiLetto: [] }], CAMERE as never),
    '2026-09-16', 3, CONTESTO)
  assert.equal(inTre[0].persone, 3)
  assert.equal(inTre[0].letto, true)                 // si accende da solo: 3 in Allegra non ci stanno senza
  // «Sì» di nuovo: gli ospiti restano 3
  const ancoraSi = cambiaLettoNotte(inTre, '2026-09-16', true, CONTESTO, { ospitiAParte: true })
  assert.equal(ancoraSi[0].persone, 3)
  assert.equal(ancoraSi[0].letto, true)
  // «No»: non fa niente, e gli ospiti restano 3
  const no = cambiaLettoNotte(inTre, '2026-09-16', false, CONTESTO, { ospitiAParte: true })
  assert.equal(no[0].persone, 3)
  assert.equal(no[0].letto, true)
})

test('il letto acceso a mano resta acceso anche tornando a due persone', () => {
  const base = nottiDaPeriodi([{ id: 'a', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-17', ospiti: 2, nottiLetto: [] }], CAMERE as never)
  const acceso = cambiaLettoNotte(base, '2026-09-16', true, CONTESTO, { ospitiAParte: true })
  assert.equal(acceso[0].letto, true)
  assert.equal(acceso[0].persone, 2)                 // due che dormono separate
  const inTre = cambiaOspitiNotte(acceso, '2026-09-16', 3, CONTESTO)
  assert.equal(inTre[0].persone, 3)
  const dueDiNuovo = cambiaOspitiNotte(inTre, '2026-09-16', 2, CONTESTO)
  assert.equal(dueDiNuovo[0].letto, true)            // non si spegne da solo
  assert.equal(dueDiNuovo[0].persone, 2)
  // e adesso «No» funziona: le due persone ci stanno senza
  assert.equal(cambiaLettoNotte(dueDiNuovo, '2026-09-16', false, CONTESTO, { ospitiAParte: true })[0].letto, false)
})

test('quando il letto serve per forza, «No» è spento e dice perché', () => {
  assert.equal(lettoObbligatorio(ALLEGRA as never, 3), true)
  assert.equal(lettoObbligatorio(ALLEGRA as never, 2), false)
  assert.equal(lettoObbligatorio(LENA as never, 3), true)
  assert.equal(lettoObbligatorio(AMELIA as never, 2), true)
  assert.equal(lettoObbligatorio(null, 3), false)    // senza camera non si promette niente
  assert.equal(motivoLettoObbligatorio(ALLEGRA as never, 3), 'servono 3 posti in Allegra')
  assert.equal(motivoLettoObbligatorio(LENA as never, 4), 'servono 4 posti in Lena')
  assert.equal(motivoLettoObbligatorio(ALLEGRA as never, 2), null)
  const foglio = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /const serveIlLetto = notte\.dentro && lettoObbligatorio\(scelta, notte\.persone\)/)
  assert.match(foglio, /spenta=\{!notte\.dentro \|\| serveIlLetto\}/)
  assert.match(foglio, /data-letto-serve[\s\S]{0,120}motivoLettoObbligatorio\(scelta, notte\.persone\)/)
})

test('accanto a «Sì» il costo di quella notte: «10 €» o «compreso»', () => {
  // Allegra in tre: il letto si paga
  assert.equal(prezzoLettoNotte(ALLEGRA as never, 3, { importo: 10, criterio: 'notte' }), '10 €')
  // Lena in tre: il terzo posto è compreso nella tripla
  assert.equal(prezzoLettoNotte(LENA as never, 3, { importo: 0, criterio: 'notte' }), 'compreso')
  // Lena in quattro: si paga
  assert.equal(prezzoLettoNotte(LENA as never, 4, { importo: 10, criterio: 'notte' }), '10 €')
  // la scritta vecchia non c'è più
  const striscia = readFileSync(new URL('./strisciaNotti.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(striscia, /LETTO_SENZA_AGGIUNTA/)
  // col listino della camera: in Lena il terzo posto non si paga, in Allegra sì
  assert.equal(prezzoLettoNotte(LENA as never, 3, { importo: null, criterio: 'notte' }), 'compreso')
  assert.equal(prezzoLettoNotte(ALLEGRA as never, 3, { importo: null, criterio: 'notte' }), '10 €')
  assert.equal(prezzoLettoNotte(LENA as never, 4, { importo: null, criterio: 'notte' }), '10 €')
  // e la pagina passa alla parte della notte l'accordo preso sopra
  assert.match(pagina, /prezzoLettoNotte\(cameraNotte as never, notte\.dentro \? notte\.persone : d\.ospiti, \{ importo: letto\.importo, criterio: letto\.criterio \}\)/)
})

test('se i due letti di casa sono impegnati, «Sì» resta spento con «non disponibile»', () => {
  const pieni = [
    { room_id: AMELIA.id, check_in: '2026-09-16', check_out: '2026-09-17', status: 'confermata', num_guests: 2, extra_bed: true, extra_bed_dates: ['2026-09-16'] },
    { room_id: AMBRA.id, check_in: '2026-09-16', check_out: '2026-09-17', status: 'confermata', num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-16'] },
  ]
  assert.equal(lettoDisponibileNotte('2026-09-16', ALLEGRA.id, { camere: CAMERE as never, altre: pieni, ospiti: 3 }), false)
  assert.equal(lettoDisponibileNotte('2026-09-17', ALLEGRA.id, { camere: CAMERE as never, altre: pieni, ospiti: 3 }), true)
  const foglio = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /spenta=\{!notte\.dentro \|\| \(!lettoLibero && !notte\.letto\)\}/)
  assert.match(foglio, /data-letto-non-disponibile[\s\S]{0,120}\{LETTO_NON_DISPONIBILE\}/)
})

test('in alto ospiti e letto non si combattono: il letto acceso a mano resta', () => {
  // conLettoAutomatico spegne solo quello che aveva acceso lui (auto)
  const aMano: PeriodoComposto = { id: 'a', gruppo: 'g', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-17', ospiti: 2, nottiLetto: ['2026-09-16'], letto: { importo: 10, criterio: 'notte' }, tariffa: null }
  assert.deepEqual(conLettoAutomatico(aMano, ALLEGRA as never).nottiLetto, ['2026-09-16'])
  const automatico: PeriodoComposto = { ...aMano, letto: { importo: 10, criterio: 'notte', auto: true } }
  assert.deepEqual(conLettoAutomatico({ ...automatico, ospiti: 2 }, ALLEGRA as never).nottiLetto, [])
})

// ── 3. La parte della notte scelta, sotto la striscia (15/09/2026) ─────────
const notteScelta = readFileSync(new URL('../components/nuova/NotteScelta.tsx', import.meta.url), 'utf8')

test('la parte compare con la notte scelta e sparisce ritoccandola', () => {
  // niente notte scelta, niente parte
  assert.match(pagina, /if \(notteScelta\?\.gruppo !== linea\.gruppo\) return null/)
  assert.match(pagina, /const notte = notti\.find\(n => n\.iso === notteScelta\.iso\)\s*\n\s*if \(!notte\) return null/)
  // la stessa notte toccata due volte si chiude
  assert.match(pagina, /s\.iso === n\.iso \? null :/)
  // sta sotto la striscia, dentro la camera del soggiorno
  assert.match(cameraSoggiorno, /<StrisciaNottiCamere[\s\S]{0,200}\/>\s*\n\s*\{sottoStriscia\}/)
  // filo card-border e 10 px di spazio
  assert.match(notteScelta, /borderTop: '1px solid var\(--color-card-border\)', paddingTop: 10, marginTop: 10/)
  // il giorno per esteso, 9,5 px maiuscolo stone, centrato
  assert.match(notteScelta, /fontSize: 9\.5, letterSpacing: '1\.4px', color: 'var\(--color-stone\)'/)
  assert.match(notteScelta, /data-titolo-notte className="uppercase text-center"/)
  assert.match(notteScelta, /\{titoloNotte\(notte\.iso\)\} · \{CODA_TITOLO\}/)
})

test('nella parte ci sono TUTTE le camere: le occupate spente e non toccabili', () => {
  assert.match(notteScelta, /camere\.map\(\(\{ camera, libera \}\)/)
  assert.match(notteScelta, /spenta=\{!libera && notte\.cameraId !== camera\.id\}/)
  assert.match(notteScelta, /acceso=\{notte\.cameraId === camera\.id\}/)
  // spente: scritta #C9BFA8 e filo #EFEADF, e il tasto è disabilitato
  const pezzi = readFileSync(new URL('../components/nuova/PezziNuova.tsx', import.meta.url), 'utf8')
  assert.match(pezzi, /SPENTA_TESTO = '#C9BFA8'/)
  assert.match(pezzi, /SPENTA_BORDO = '#EFEADF'/)
  assert.match(pezzi, /disabled=\{spenta\}/)
  // e la pagina dice quali sono libere QUELLA notte, con le regole di sempre
  assert.match(pagina, /const libereOra = new Set\(camereDellaNotte\(notte\.iso, ctx\)\.map\(c => c\.id\)\)/)
})

test('la camera scelta nella parte riempie solo quella notte', () => {
  assert.match(pagina, /function scegliCameraNotte[\s\S]{0,220}cambiaCameraNotte\(notti, iso, camera, ctx\)/)
  const notti = nottiDaPeriodi([
    { id: 'a', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [] },
  ], CAMERE as never)
  const dopo = cambiaCameraNotte(notti, '2026-09-17', LENA as never, { camere: CAMERE as never, altre: [], ospiti: 2 })
  assert.deepEqual(dopo.map(n => n.camera), ['Allegra', 'Lena'])
})

test('ospiti e letto della notte, sulla stessa riga, e «non dorme qui» in fondo', () => {
  assert.match(notteScelta, /ETICHETTA_OSPITI = 'ospiti'/)
  assert.match(notteScelta, /ETICHETTA_LETTO = 'letto in più'/)
  assert.match(notteScelta, /data-notte-ospiti-giu/)
  assert.match(notteScelta, /data-notte-ospiti-su/)
  assert.match(notteScelta, /Sì · \{prezzoLetto\}/)
  assert.match(notteScelta, /\{LETTO_NON_DISPONIBILE\}/)
  assert.match(notteScelta, /spenta=\{Boolean\(motivoLetto\)\}/)      // «No» spento quando il letto serve
  // «oppure non dorme qui», in fondo, 12 px
  assert.match(notteScelta, /NON_DORME_QUI = 'non dorme qui'/)
  assert.match(notteScelta, /OPPURE = 'oppure '/)
  assert.match(notteScelta, /fontSize: 12, color: 'var\(--color-stone\)'[\s\S]{0,200}data-non-dorme/)
  // la domanda «solo questa notte» / «da qui in poi» dopo aver toccato gli ospiti
  assert.match(notteScelta, /SOLO_QUESTA = 'solo questa notte'/)
  assert.match(notteScelta, /DA_QUI = 'da qui in poi'/)
  assert.match(notteScelta, /\{chiesto && \(/)
})

test('«da qui in poi» porta gli ospiti anche alle notti dopo, senza toccare le camere', () => {
  assert.match(pagina, /if \(daQui\) for \(const dopo of fatte\.filter\(n => n\.iso > iso && n\.dentro\)/)
  const contesto = { camere: CAMERE as never, altre: [], ospiti: 2 }
  const notti = nottiDaPeriodi([
    { id: 'a', roomId: LENA.id, checkIn: '2026-09-15', checkOut: '2026-09-16', ospiti: 2, nottiLetto: [] },
    { id: 'b', roomId: ALLEGRA.id, checkIn: '2026-09-16', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [] },
  ], CAMERE as never)
  let fatte = cambiaOspitiNotte(notti, '2026-09-16', 3, contesto)
  for (const iso of fatte.filter(n => n.iso > '2026-09-16' && n.dentro).map(n => n.iso)) fatte = cambiaOspitiNotte(fatte, iso, 3, contesto)
  assert.deepEqual(fatte.map(n => n.persone), [2, 3, 3])
  assert.deepEqual(fatte.map(n => n.camera), ['Lena', 'Allegra', 'Allegra'])   // le camere non si toccano
})

test('«non dorme qui» toglie la notte e si rimette scegliendo una camera', () => {
  assert.match(pagina, /function togliNotte[\s\S]{0,160}nonDormeQui\(notti, iso\)/)
  const notti = nottiDaPeriodi([
    { id: 'a', roomId: LENA.id, checkIn: '2026-09-16', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [] },
  ], CAMERE as never)
  const fuori = nonDormeQui(notti, '2026-09-16')
  assert.equal(fuori[0].dentro, false)
  assert.equal(fuori[0].camera, null)
  assert.match(notteScelta, /COME_RIMETTERLA = 'per rimetterla nel soggiorno scegli una camera'/)
  // e una notte senza nessuna camera libera lo dice
  assert.match(notteScelta, /NESSUNA_CAMERA_LIBERA = 'nessuna camera libera questa notte'/)
  assert.match(notteScelta, /libere\.length === 0 && notte\.dentro/)
})

// ── 4. Il foglietto non c'è più nell'inserimento ──────────────────────────
test('nell’inserimento il foglietto dal basso non esiste più', () => {
  assert.doesNotMatch(pagina, /FoglioNotte/)
  assert.match(pagina, /import NotteScelta from '@\/components\/nuova\/NotteScelta'/)
  // la scheda invece continua a usarlo
  const scheda = readFileSync(new URL('../app/scheda/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(scheda, /import FoglioNotte from '@\/components\/FoglioNotte'/)
})

test('sotto la striscia restano solo il riassunto e la riga di quello che manca', () => {
  const striscia = readFileSync(new URL('../components/StrisciaNottiCamere.tsx', import.meta.url), 'utf8')
  assert.match(striscia, /data-riassunto-striscia/)
  assert.match(striscia, /data-avviso-notte/)
  // la spiegazione «sopra la camera · sotto il letto» qui è spenta
  assert.match(cameraSoggiorno, /spiegazione=\{false\}/)
  // e la riga sotto le pastiglie in alto non dice più frasi inutili
  const conPezzi = camereDelPeriodo(CAMERE, PIENE, '2026-09-14', '2026-09-18')
  assert.equal(rigaCamereLibere(conPezzi, '2026-09-14', '2026-09-18'), '')
})

// ── 1. Quello che resta in alto (15/09/2026) ──────────────────────────────
test('le pastiglie in alto impegnano la camera per TUTTO il soggiorno', () => {
  const scelte = camereDelPeriodo(CAMERE, [], '2026-09-14', '2026-09-18')
  const libera = (iso: string, id: string) => scelte.find(s => s.camera.id === id)?.notti.includes(iso) ?? false
  const vuoto: PeriodoComposto[] = [{ id: 'a', gruppo: 'g', roomId: null, checkIn: '2026-09-14', checkOut: '2026-09-18', ospiti: 2, nottiLetto: [], letto: null, tariffa: null }]
  let n = 0
  const dopo = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, vuoto,
    { cameraScelta: LENA.id, libera }, () => `n${++n}`)
  // tutte e quattro le notti prendono Lena, in un tratto solo
  assert.equal(dopo.length, 1)
  assert.deepEqual(nottiDaPeriodi(dopo, CAMERE as never).map(x => x.camera), ['Lena', 'Lena', 'Lena', 'Lena'])
  // e dove non è libera restano quelle di prima (prova del 15/09/2026)
  const soloUna = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-18' }, vuoto,
    { cameraScelta: LENA.id, libera: LIBERA_14_18 }, () => `m${++n}`)
  assert.deepEqual(nottiDaPeriodi(soloUna, CAMERE as never).map(x => x.camera), [null, null, null, 'Lena'])
})

test('in alto restano ospiti e tariffa, e valgono per tutto il soggiorno', () => {
  assert.match(cameraSoggiorno, /ETICHETTA_OSPITI = 'Ospiti'/)
  assert.match(cameraSoggiorno, /ETICHETTA_TARIFFA = 'Tariffa a notte'/)
  assert.match(pagina, /ospiti=\{d\.ospiti\} onOspiti=\{n => cambiaLinea\(linea\.gruppo, \{ ospiti: n \}\)\}/)
  assert.match(pagina, /onTariffa=\{v => cambiaLinea\(linea\.gruppo, \{ tariffa: v \}\)\}/)
  // gli ospiti scritti in alto vanno su tutte le notti
  const vuoto: PeriodoComposto[] = [{ id: 'a', gruppo: 'g', roomId: LENA.id, checkIn: '2026-09-14', checkOut: '2026-09-16', ospiti: 2, nottiLetto: [], letto: null, tariffa: null }]
  let n = 0
  const dopo = periodiDellaLinea({ gruppo: 'g', arrivo: '2026-09-14', partenza: '2026-09-16' }, vuoto, { ospiti: 3 }, () => `n${++n}`)
  assert.equal(dopo.every(p => p.ospiti === 3), true)
})
