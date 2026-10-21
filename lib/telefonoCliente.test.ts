// RICONOSCIMENTO DEL CLIENTE DAL TELEFONO E MAIUSCOLE (Ania, 21/10/2026):
// «cliente già presente non riconosciuto col +39 nella Nuova prenotazione».
// La causa era la ricerca della pagina nuova (phone.ilike.%cifre%: cercando
// «+39 333…» non trovava «333…» né «+39 333 …» con gli spazi) e la creazione
// del cliente nuovo senza controllo del numero in altre forme. Questi test
// fermano il ritorno del difetto in ogni percorso che cerca o crea clienti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  chiaveTelefono, stessoNumero, schedeConNumero, schedaConNumero, filtriTelefonoRicerca, sembraTelefono, ordinaPerNumeroUguale,
  schedeCheLaConfermaNonVede, testoNumeroGiaInArchivio, schemaRicercaTelefono,
} from './clienteTelefono.ts'
import { matchTelefono } from './ricerca.ts'
import { filtraClienti } from './cambiaCliente.ts'
import { filtraElenco } from './clientiElenco.ts'
import { moduloDaRicerca, campiNuovoCliente, telefonoDaSalvare } from './datiCliente.ts'
import { normalizzaTelefono } from './whatsapp.ts'
import { conIniziali, conInizialiDigitando } from './maiuscole.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

// lo stesso numero italiano in tutte le forme che arrivano davvero
const NBSP = '\u00a0', STRETTO = '\u202f', LRE = '\u202a', PDF = '\u202c', FSI = '\u2068', PDI = '\u2069', LRM = '\u200e'
const FORME_ITALIANE = [
  '3331234567', '+393331234567', '+39 333 123 4567', '0039 333 1234567', '00393331234567', '393331234567',
  '  +39 333 1234567  ', `+39${NBSP}333${NBSP}123${NBSP}4567`, `+39${STRETTO}333${STRETTO}1234567`,
  `${LRE}+39 333 123 4567${PDF}`, `${FSI}+39 333 123 4567${PDI}`, `${LRM}+39 333-123-4567${LRM}`,
  '333-123-4567', '(333) 123 4567', '+39 (333) 123-45-67', '333.123.4567', `${LRE}0039 333 123 4567${PDF}`,
]

test('chiave: tutte le forme dello stesso numero italiano danno 393331234567', () => {
  for (const f of FORME_ITALIANE) assert.equal(chiaveTelefono(f), '393331234567', JSON.stringify(f))
})

test('stesso numero: digitato in una forma, archiviato in un\'altra, in tutte le coppie', () => {
  for (const a of FORME_ITALIANE) for (const b of FORME_ITALIANE) assert.ok(stessoNumero(a, b), `${JSON.stringify(a)} ~ ${JSON.stringify(b)}`)
})

test('i prefissi internazionali si rispettano: paesi diversi restano distinti', () => {
  assert.equal(chiaveTelefono('+44 7700 900123'), '447700900123')
  assert.equal(chiaveTelefono('0044 7700 900123'), '447700900123')
  assert.equal(chiaveTelefono('+48 600 000 000'), '48600000000')
  assert.equal(chiaveTelefono('48600000000'), '48600000000')
  assert.ok(stessoNumero('+48 600 000 000', '48600000000'))
  assert.ok(stessoNumero(`${LRE}+44 7700 900123${PDF}`, '0044-7700-900123'))
  // stesse cifre nazionali, paesi diversi
  assert.ok(!stessoNumero('+44 333 123 4567', '+39 333 123 4567'))
  assert.ok(!stessoNumero('+44 333 123 4567', '3331234567'))
  assert.ok(!stessoNumero('+33 6 12 34 56 78', '+39 612345678'))
  // il prefisso non si toglie: +44 7700900123 non è 7700900123 (che non è italiano)
  assert.ok(!stessoNumero('+44 7700900123', '7700900123'))
  // un fisso italiano tiene lo 0 dopo il 39
  assert.equal(chiaveTelefono('02 1234567'), '39021234567')
  assert.ok(stessoNumero('+39 02 1234567', '021234567'))
})

test('numeri incompleti o non validi non sono «lo stesso» di nessuno', () => {
  for (const f of ['', '   ', '333', '333 12', '12345', '+39 333', '+39', 'abc', '333 1234567 casa', '+39 12345678', '39 33', '++393331234567'])
    assert.equal(chiaveTelefono(f), null, JSON.stringify(f))
  assert.ok(!stessoNumero('333 12', '333 12'))
  assert.ok(!stessoNumero(null, undefined))
  assert.ok(!stessoNumero('', ''))
  // le ultime cifre uguali non bastano
  assert.ok(!stessoNumero('+39 333 123 4567', '+39 334 123 4567'))
  assert.ok(!stessoNumero('3331234567', '3331234568'))
})

test('schede: lo stesso numero su più schede si restituisce tutto, niente scelta automatica', () => {
  const righe = [
    { id: 'a', full_name: 'Anna Prova', phone: '+39 333 123 4567' },
    { id: 'b', full_name: 'Bruno Prova', phone: '3331234567' },
    { id: 'c', full_name: 'Carla Prova', phone: '+44 333 123 4567' },
    { id: 'd', full_name: 'Dario Prova', phone: '3331234568' },
  ]
  assert.deepEqual(schedeConNumero(righe, `${LRE}+39 333 123 4567${PDF}`).map(r => r.id), ['a', 'b'])
  assert.deepEqual(schedeConNumero(righe, '+44 333 1234567').map(r => r.id), ['c'])
  assert.deepEqual(schedeConNumero(righe, '333 12'), [])
  assert.equal(schedaConNumero(righe, '0039 333 1234568')?.id, 'd')
  assert.match(testoNumeroGiaInArchivio(righe.slice(0, 2)) ?? '', /già su 2 schede: scegli quella giusta/)
  assert.match(testoNumeroGiaInArchivio(righe.slice(0, 1)) ?? '', /è di Anna Prova/)
  assert.equal(testoNumeroGiaInArchivio([]), null)
})

// PostgREST ilike, simulato: % = qualunque sequenza, senza maiuscole
function ilike(valore: string, schema: string): boolean {
  const re = new RegExp('^' + schema.replace(/[.+^${}()|[\]\\?*]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
  return re.test(valore)
}
const ARCHIVIO = ['3331234567', '393331234567', '+393331234567', '+39 333 123 4567', '0039 333-123-4567', '+39 (333) 123 45 67']

test('la lettura del server trova il numero in ogni forma archiviata, con ogni forma digitata', () => {
  for (const digitato of FORME_ITALIANE) {
    const filtri = filtriTelefonoRicerca(digitato).map(f => f.replace(/^phone\.ilike\./, ''))
    for (const salvato of ARCHIVIO) assert.ok(filtri.some(f => ilike(salvato, f)), `${JSON.stringify(digitato)} → ${salvato}`)
    // solo cifre e %: nessun carattere che rompa .or()
    for (const f of filtri) assert.match(f, /^[\d%]+$/)
  }
  // anche il prefiltro della scheda per telefono (creazione, Clienti, richieste)
  for (const digitato of FORME_ITALIANE) for (const salvato of ARCHIVIO) assert.ok(ilike(salvato, schemaRicercaTelefono(digitato)!), `${digitato} → ${salvato}`)
  assert.deepEqual(filtriTelefonoRicerca('An'), [])
  // anche all'estero: 0044, +44 e i segni di WhatsApp trovano «447700900123» e «+44 7700 900123»
  for (const digitato of ['0044 7700 900 123', '+44 7700 900123', `${LRE}+44 7700 900123${PDF}`, '00447700900123']) {
    const filtri = filtriTelefonoRicerca(digitato).map(f => f.replace(/^phone\.ilike\./, ''))
    for (const salvato of ['447700900123', '+447700900123', '+44 7700 900123', '0044 7700 900123']) {
      assert.ok(filtri.some(f => ilike(salvato, f)), `${digitato} → ${salvato}`)
      assert.ok(matchTelefono(salvato, digitato), `a schermo ${digitato} → ${salvato}`)
    }
  }
  // 10 cifre senza prefisso e non italiane: paese ignoto, nessuna identità
  // automatica; nell'elenco resta trovabile per pezzi, sceglie Ania
  assert.equal(chiaveTelefono('7700900123'), null)
  assert.ok(!stessoNumero('7700900123', '+44 7700 900123'))
  assert.ok(matchTelefono('+44 7700 900123', '7700900123'))
  // a metà numero col +39 scritto: trova anche le schede salvate senza 39
  for (const parziale of ['+39 333 99', `${LRE}0039 333 99`]) {
    const filtri = filtriTelefonoRicerca(parziale).map(f => f.replace(/^phone\.ilike\./, ''))
    assert.ok(filtri.some(f => ilike('3339990001', f)), parziale)
  }
  // ma un +44 a metà non perde il prefisso
  assert.deepEqual(filtriTelefonoRicerca('+44 333').map(f => f.replace(/^phone\.ilike\./, '')), ['%44333%'])
})

test('ricerca a schermo (Nuova prenotazione, Cambia cliente, Clienti, Prenotazioni): trova e non confonde', () => {
  const clienti = [
    { id: 'a', full_name: 'Anna Prova', phone: '3331234567' },
    { id: 'b', full_name: 'Bea Inglese', phone: '+44 333 123 4567' },
    { id: 'c', full_name: 'Carlo Prova', phone: '+39 333 765 4321' },
  ]
  for (const q of FORME_ITALIANE) {
    assert.deepEqual(filtraClienti(q, clienti).map(c => c.id), ['a'], JSON.stringify(q))
    assert.deepEqual(filtraElenco(clienti, q).map(c => c.id), ['a'], JSON.stringify(q))
    assert.ok(matchTelefono('+39 333 123 4567', q))
  }
  // mentre si scrive restano in elenco i candidati, mai confusi a numero completo
  assert.ok(matchTelefono('3331234567', '333123'))
  assert.ok(matchTelefono('3331234567', '+39 333 123 456'))   // 9 cifre: è l'inizio del numero a 10
  assert.ok(!matchTelefono('+44 333 123 4567', '+39 333 123 4567'))
  // i numeri identici prima nell'elenco
  const ordinati = ordinaPerNumeroUguale([{ id: 'x', phone: '+39 333 123 45' }, { id: 'a', phone: '3331234567' }], '+39 333 123 4567')
  assert.equal(ordinati[0].id, 'a')
  assert.ok(sembraTelefono(`${LRE}+39 (333) 123-4567${PDF}`))
  assert.ok(!sembraTelefono('Anna Rossi'))
  assert.ok(!sembraTelefono('Anna 333'))
})

test('dalla ricerca al cliente nuovo: il numero incollato da WhatsApp resta nel campo, il nome resta vuoto', () => {
  for (const q of [`${LRE}+39 333 123 4567${PDF}`, `${FSI}+39${NBSP}333${NBSP}1234567${PDI}`, '  0039 333 1234567  ']) {
    const m = moduloDaRicerca(q)
    assert.equal(m.nome, '', JSON.stringify(q))
    assert.equal(m.cognome, '')
    assert.equal(chiaveTelefono(m.telefono), '393331234567')
  }
  // nome e numero incollati insieme: entrambi, nome con la maiuscola già nel campo
  const m = moduloDaRicerca(`mario rossi ${LRE}+39 333 123 4567${PDF}`)
  assert.deepEqual([m.nome, m.cognome, chiaveTelefono(m.telefono)], ['Mario', 'Rossi', '393331234567'])
})

test('il telefono si salva col prefisso del paese, senza invisibili; quello che non si riconosce resta com\'è', () => {
  assert.equal(telefonoDaSalvare(`${LRE}+39 333 123 4567${PDF}`), '393331234567')
  assert.equal(telefonoDaSalvare('0044 7700 900123'), '447700900123')
  assert.equal(telefonoDaSalvare(`333${NBSP}12`), '33312')
  const campi = campiNuovoCliente({ ...moduloDaRicerca(''), nome: 'anna', cognome: "d'angelo", telefono: '+39 333 123 4567' }, false)
  assert.equal(campi.phone, '393331234567')
  assert.equal(campi.full_name, "Anna D'Angelo")
  // WhatsApp e numeroUsabile non si fanno ingannare dai segni invisibili davanti a 0039
  assert.equal(normalizzaTelefono(`${LRE}0039 333 1234567${PDF}`).numero, '393331234567')
})

test('conferma di una richiesta: avvisa quando la RPC non vedrebbe la scheda dello stesso numero', () => {
  const schede = [{ full_name: 'Anna Prova', phone: '3331234567' }]
  assert.equal(schedeCheLaConfermaNonVede('+393331234567', schede).length, 1)
  // con le stesse cifre la RPC la ritrova: nessun avviso
  assert.equal(schedeCheLaConfermaNonVede('3331234567', schede).length, 0)
  assert.equal(schedeCheLaConfermaNonVede('+393331234567', [...schede, { full_name: 'Anna Prova', phone: '+39 333 123 4567' }]).length, 0)
  assert.equal(schedeCheLaConfermaNonVede('', schede).length, 0)
})

test('nome e cognome: iniziale maiuscola, accenti/apostrofi/trattini conservati, il resto non si tocca', () => {
  assert.equal(conIniziali('mario rossi'), 'Mario Rossi')
  assert.equal(conIniziali("élodie d'angelo-rossi"), "Élodie D'Angelo-Rossi")
  assert.equal(conIniziali('anna-maria de luca'), 'Anna-Maria De Luca')
  assert.equal(conIniziali('ŁUKASZ żółć'), 'ŁUKASZ Żółć')
  assert.equal(conIniziali('McDonald o’neill'), 'McDonald O’Neill')
  assert.equal(conIniziali('JOSÉ'), 'JOSÉ')
  // copiati da WhatsApp: i segni invisibili non fermano la maiuscola e non si salvano
  assert.equal(conIniziali(`${FSI}mario${PDI} rossi`), 'Mario Rossi')
  assert.equal(conInizialiDigitando(`${FSI}mario`), `${FSI}Mario`)
  assert.equal(conInizialiDigitando(`${FSI}mario`).length, `${FSI}mario`.length)   // il cursore non si sposta
})

test('guardie sui sorgenti: ogni percorso usa la regola comune e non crea doppioni', () => {
  const nuova = leggi('app/nuova-prenotazione/page.tsx')
  assert.match(nuova, /leggiClientiPerRicerca<ClienteRiga>\(testo, '\*', 30\)/)
  assert.match(nuova, /cercaSchedaPerTelefono<ClienteRiga>\(telefonoNuovo\)/)
  assert.match(nuova, /if \(esito\.schede\?\.length\) \{ setSchedeDoppie/)
  assert.match(nuova, /<SchedeStessoNumero schede=\{schedeDelNumero\}/)
  const dati = leggi('lib/cambiaClienteDati.ts')
  assert.match(dati, /leggiClientiPerRicerca<ClienteBreve>\(q, campi, 30\)/)
  assert.match(dati, /const gia = await cercaSchedaPerTelefono<ClienteBreve>\(String\(campi\.phone \?\? ''\)\)[\s\S]*?if \(gia\.schede\.length\) return/)
  assert.doesNotMatch(dati, /phone\.ilike\.%\$\{cifre\}%/)
  for (const f of ['components/scheda/FoglioCambiaCliente.tsx', 'components/CambiaCliente.tsx']) assert.match(leggi(f), /<SchedeStessoNumero schede=\{schedeDoppie\}/, f)
  const clienti = leggi('app/clienti/nuovo/page.tsx')
  assert.match(clienti, /cercaSchedaPerTelefono<SchedaStessoNumero>\(formattedPhone\)/)
  assert.doesNotMatch(clienti, /`39\$\{rawP\}`/)
  assert.match(leggi('lib/provenienzaDati.ts'), /cercaSchedaPerTelefono</)
  assert.match(leggi('app/api/richieste/web/route.ts'), /schedeConNumero\(/)
  assert.match(leggi('components/richieste/FinestraConferma.tsx'), /schedeCheLaConfermaNonVede\(richiesta\.telefono/)
  assert.match(leggi('lib/clientiElenco.ts'), /matchTelefono\(g\.phone, ricerca\)/)
  // «Dati della cliente»: il numero cambiato non può finire su due schede
  assert.match(leggi('components/scheda/FoglioCliente.tsx'), /const altre = gia\.schede\.filter\(g => g\.id !== cliente\.id\)/)
})
