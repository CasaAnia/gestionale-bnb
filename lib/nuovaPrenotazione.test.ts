// La nuova pagina di inserimento (14/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  dataDiOggi, volteInParole, rigaClienteTrovato, camereDelPeriodo, rigaCamereLibere,
  ospitiPossibiliNotte, ospitiDellaNotte, listinoLetto, raggruppaPerCamera, datiLinea, nottiDellaLinea,
  CRITERI_LETTO,
} from './nuovaPrenotazione.ts'
import type { PeriodoComposto } from './prenotazioneComposta.ts'
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

test('le camere del periodo: occupata in una sola notte = spenta', () => {
  const altre = [{ room_id: 'ambra', check_in: '2026-10-12', check_out: '2026-10-13', status: 'confermata' }]
  const scelte = camereDelPeriodo(CAMERE, altre, '2026-10-10', '2026-10-15')
  assert.deepEqual(scelte.filter(s => !s.libera).map(s => s.camera.name), ['Ambra'])
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

test('in cima il titolo in Georgia 26 e la data in ottone maiuscolo', () => {
  assert.match(pagina, /fontFamily: GEORGIA, fontSize: 26/)
  assert.match(pagina, /\{TITOLO_PAGINA\}/)
  assert.match(pagina, /data-oggi className="uppercase" style=\{\{ fontSize: 10, letterSpacing: '1\.5px', color: OTTONE/)
  assert.match(pagina, /\{dataDiOggi\(oggi\)\}/)
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
  assert.match(pagina, /onNotte=\{n => setNotteAperta\(\{ gruppo: linea\.gruppo, iso: n\.iso \}\)\}/)
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
  assert.match(pagina, /periodi\.map\(p => \(\{ \.\.\.p, letto: p\.nottiLetto\.length > 0 \? \{ importo: letto\.importo \?\? 0, criterio: letto\.criterio \} : null \}\)\)/)
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
