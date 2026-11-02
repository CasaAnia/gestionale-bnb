import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { STATI_CHE_OCCUPANO, siSovrappone, giorniTra, notti, ordinaCamere, type CameraMinima, type PrenotazioneMinima } from '@/lib/disponibilita'
import { ROOM_TYPE_BY_NAME } from '@/lib/roomTypes'
import { capienzaCamera } from '@/lib/tariffe'
import { lettiOccupatiPerNotte } from '@/lib/lettiAggiuntivi'
import { dataItaliana } from '@/lib/dateItaliane'
import { STATI_APERTI } from '@/lib/richieste'
import { richiesteInAttesa, nottiOrdinate, type RichiestaAttesa } from './richiesteAttesa'

// Disponibilità delle camere in SOLA LETTURA, per un assistente esterno
// (Ania, 02/11/2026). Un solo link con il token segreto:
//   /api/disponibilita?dal=AAAA-MM-GG&al=AAAA-MM-GG&token=…[&testo=1]
//
//  · il token si confronta ESATTAMENTE con DISPONIBILITA_TOKEN (401 altrimenti);
//  · le notti vanno da «dal» ad «al» escluso, come nel resto del gestionale;
//  · occupano solo le prenotazioni confermate o completate, e la partenza di
//    un ospite può coincidere con l'arrivo del successivo: la regola è quella
//    di lib/disponibilita.ts (STATI_CHE_OCCUPANO + siSovrappone), qui riusata
//    notte per notte;
//  · i letti aggiuntivi già impegnati per notte vengono da
//    lettiOccupatiPerNotte (lib/lettiAggiuntivi.ts), la stessa lettura del
//    calendario;
//  · le RICHIESTE IN ATTESA (tabella richieste, stato 'in_attesa' o
//    'proposta_inviata') si segnalano in più, per camera e notte, senza mai
//    rendere una camera occupata; quelle senza camera vanno a parte con sole
//    date e persone (regole in ./richiesteAttesa.ts, 02/11/2026);
//  · nessuna scrittura su Supabase; il client admin serve solo perché qui non
//    c'è un utente loggato (proxy.ts non copre /api).
// Niente cache: risposta sempre fresca.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const MASSIMO_NOTTI = 60
const SENZA_CACHE = { 'Cache-Control': 'no-store' }

type Camera = CameraMinima & { id: string; name: string }
type Prenotazione = PrenotazioneMinima & { num_guests?: number | string | null; extra_bed?: boolean | null; extra_bed_dates?: string[] | null }

function errore(stato: number, messaggio: string) {
  return NextResponse.json({ errore: messaggio }, { status: stato, headers: SENZA_CACHE })
}

// Data ISO vera (anche 2026-02-30 viene scartata).
function dataValida(v: string | null): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const t = Date.parse(v + 'T00:00:00Z')
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v
}

// La notte «g» è l'intervallo [g, g+1): si riusa la regola di sovrapposizione.
function giornoDopo(g: string): string {
  return new Date(Date.parse(g + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
}

// 15/11 — giorno e mese in cifre, per il testo semplice.
function giornoMeseCifre(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export async function GET(req: NextRequest) {
  const atteso = process.env.DISPONIBILITA_TOKEN
  const token = req.nextUrl.searchParams.get('token')
  if (!atteso || token !== atteso) return errore(401, 'non autorizzato')

  const dal = req.nextUrl.searchParams.get('dal')
  const al = req.nextUrl.searchParams.get('al')
  if (!dataValida(dal) || !dataValida(al) || !(al > dal)) return errore(400, 'date non valide')
  const n = notti(dal, al)
  if (n > MASSIMO_NOTTI) return errore(400, `massimo ${MASSIMO_NOTTI} notti`)

  let supabase
  try { supabase = createAdminClient() } catch { return errore(500, 'configurazione mancante') }

  const [camereRes, prenotazioniRes, richiesteRes] = await Promise.all([
    supabase.from('rooms').select('id, name, active, has_extra_bed, base_price, double_price').eq('active', true),
    supabase.from('bookings')
      .select('room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates')
      .in('status', [...STATI_CHE_OCCUPANO])
      .lt('check_in', al).gt('check_out', dal),
    // Solo le colonne che servono: niente nome, cognome, telefono, note.
    // (proposta_soluzione contiene i prezzi della proposta: si legge per le
    //  camere e i periodi, non esce mai dalla risposta.)
    supabase.from('richieste')
      .select('id, stato, arrivo, partenza, persone, camera_id, notti_richieste, proposta_soluzione, proposta_alternative')
      .in('stato', STATI_APERTI)
      .lt('arrivo', al).gt('partenza', dal),
  ])
  if (camereRes.error) return errore(500, 'lettura camere non riuscita')
  if (prenotazioniRes.error) return errore(500, 'lettura prenotazioni non riuscita')
  if (richiesteRes.error) return errore(500, 'lettura richieste non riuscita')

  const camere = ordinaCamere((camereRes.data ?? []) as Camera[])
  const prenotazioni = ((prenotazioniRes.data ?? []) as Prenotazione[]).filter(p => STATI_CHE_OCCUPANO.has(p.status))
  const nottiElenco = giorniTra(dal, al)
  const lettiPresi = lettiOccupatiPerNotte(prenotazioni)
  const attesa = richiesteInAttesa((richiesteRes.data ?? []) as unknown as RichiestaAttesa[], nottiElenco)

  const risultatoCamere = camere.map(c => {
    const mie = prenotazioni.filter(p => p.room_id === c.id)
    const nottiOccupate = nottiElenco.filter(g => mie.some(p => siSovrappone(p, g, giornoDopo(g))))
    return {
      nome: c.name,
      tipo: (ROOM_TYPE_BY_NAME[c.name] ?? '').toLowerCase(),
      persone_max: capienzaCamera(c),
      libera_tutto_il_periodo: nottiOccupate.length === 0,
      notti_occupate: nottiOccupate,
      notti_con_richiesta_in_attesa: nottiOrdinate(attesa, c.id),
    }
  })
  const lettiPerNotte: Record<string, number> = {}
  for (const g of nottiElenco) lettiPerNotte[g] = lettiPresi.get(g) ?? 0

  if (req.nextUrl.searchParams.get('testo') === '1') {
    const righe = [
      `Disponibilità Casa Ania dal ${dataItaliana(dal)} al ${dataItaliana(al)} (${n} ${n === 1 ? 'notte' : 'notti'})`,
      ...risultatoCamere.flatMap(c => [
        `${c.nome} (${c.tipo}, max ${c.persone_max}): ` +
        (c.libera_tutto_il_periodo
          ? 'LIBERA tutto il periodo'
          : `occupata le notti del ${c.notti_occupate.map(giornoMeseCifre).join(', ')}`),
        ...(c.notti_con_richiesta_in_attesa.length > 0
          ? [`  richiesta in attesa per le notti del ${c.notti_con_richiesta_in_attesa.map(giornoMeseCifre).join(', ')}`]
          : []),
      ]),
      `Letti aggiuntivi già impegnati: ${nottiElenco.map(g => `${giornoMeseCifre(g)}: ${lettiPerNotte[g]}`).join(' · ')}`,
      ...(attesa.senzaCamera.length > 0
        ? [`Richieste in attesa senza camera: ${attesa.senzaCamera
            .map(r => `dal ${giornoMeseCifre(r.dal)} al ${giornoMeseCifre(r.al)} (${r.persone} ${r.persone === 1 ? 'persona' : 'persone'})`)
            .join(' · ')}`]
        : []),
    ]
    return new NextResponse(righe.join('\n') + '\n', {
      status: 200,
      headers: { ...SENZA_CACHE, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return NextResponse.json(
    {
      dal, al, notti: n, camere: risultatoCamere,
      letti_aggiuntivi_impegnati_per_notte: lettiPerNotte,
      richieste_in_attesa_senza_camera: attesa.senzaCamera,
    },
    { status: 200, headers: SENZA_CACHE },
  )
}
