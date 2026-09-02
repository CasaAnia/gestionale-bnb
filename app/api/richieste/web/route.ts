import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { validaRichiestaWeb, stessaRichiesta, consentiIp, FINESTRA_DOPPIONI_MIN } from '@/lib/richiesteWeb'

// Ingresso delle richieste dal modulo del sito casaaniarozzano.it (pezzo 5A).
//
//  · segreto condiviso nell'header Authorization: Bearer <RICHIESTE_WEB_SECRET>;
//  · validazione completa con messaggi chiari (400);
//  · anti-doppioni: stessa richiesta negli ultimi 10 minuti → 200 con l'id esistente;
//  · limite per IP: 10 richieste in 10 minuti → 429;
//  · crea la richiesta (canale web, in attesa) con il service role: qui non c'è
//    un utente loggato e l'unica porta è il segreto;
// Nessun messaggio al cliente parte da qui. Nei log MAI nome, telefono o note.

const pulisci = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, '')
const registroIp = new Map<string, number[]>()

function log(esito: string, motivo: string) {
  console.warn(`[richieste/web] ${new Date().toISOString()} ${esito} ${motivo}`)
}

export async function POST(req: NextRequest) {
  const atteso = pulisci(process.env.RICHIESTE_WEB_SECRET)
  const header = req.headers.get('authorization') ?? ''
  if (!atteso || !header.startsWith('Bearer ') || pulisci(header.slice(7)) !== atteso) {
    log('401', atteso ? 'segreto mancante o errato' : 'RICHIESTE_WEB_SECRET non configurato')
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sconosciuto'
  if (!consentiIp(registroIp, ip)) {
    log('429', 'troppe richieste dallo stesso indirizzo')
    return NextResponse.json({ error: 'Troppe richieste, riprova tra qualche minuto' }, { status: 429 })
  }

  let corpo: unknown
  try { corpo = await req.json() } catch {
    log('400', 'JSON non valido')
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: camere, error: errCamere } = await supabase.from('rooms').select('id, name').eq('active', true)
  if (errCamere) {
    log('500', `camere non lette: ${errCamere.code ?? ''}`)
    return NextResponse.json({ error: 'Servizio momentaneamente non disponibile' }, { status: 500 })
  }

  const oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })   // YYYY-MM-DD in Italia
  const esito = validaRichiestaWeb(corpo, oggi, camere || [])
  if (!esito.ok) {
    log('400', esito.errore)
    return NextResponse.json({ error: esito.errore }, { status: 400 })
  }
  const d = esito.dati

  // Anti-doppioni: stessa richiesta negli ultimi 10 minuti
  const da = new Date(Date.now() - FINESTRA_DOPPIONI_MIN * 60000).toISOString()
  const { data: recenti, error: errRecenti } = await supabase.from('richieste')
    .select('id, nome, cognome, arrivo, partenza, telefono')
    .eq('canale', 'web').gte('created_at', da)
  if (errRecenti) {
    log('500', `controllo doppioni fallito: ${errRecenti.code ?? ''}`)
    return NextResponse.json({ error: 'Servizio momentaneamente non disponibile' }, { status: 500 })
  }
  const doppione = (recenti || []).find(r => stessaRichiesta(d, r))
  if (doppione) {
    log('200', 'doppione entro 10 minuti, nessuna nuova richiesta')
    return NextResponse.json({ id: doppione.id, doppione: true }, { status: 200 })
  }

  const riga: Record<string, unknown> = {
    nome: d.nome, cognome: d.cognome, arrivo: d.arrivo, partenza: d.partenza, persone: d.persone,
    camera_id: d.camera_id, canale: 'web', telefono: d.telefono, note: d.note, stato: 'in_attesa',
  }
  let inserita = await supabase.from('richieste').insert(d.origine ? { ...riga, origine: d.origine } : riga).select('id').single()
  if (inserita.error && d.origine && /origine/i.test(inserita.error.message || '')) {
    // Colonna della 0028 non ancora applicata: la richiesta entra comunque, l'origine si perde (avvisato nel log)
    log('avviso', 'colonna origine assente: applicare la migrazione 0028')
    inserita = await supabase.from('richieste').insert(riga).select('id').single()
  }
  if (inserita.error || !inserita.data) {
    log('500', `inserimento fallito: ${inserita.error?.code ?? ''}`)
    return NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 })
  }
  const id = inserita.data.id as string

  return NextResponse.json({ id }, { status: 201 })
}
