'use client'
import type { RefObject } from 'react'
import { roomWithType, bagnoDesc } from '@/lib/roomTypes'
import { NOME_STRUTTURA, CITTA_STRUTTURA, SITO_DISPLAY, TELEFONO_DISPLAY, INDIRIZZO, INDIRIZZO_NOTA } from '@/lib/config'
import { fmtEuro, type RigaCosto } from '@/lib/riepilogoCosti'
import { lineaSoggiorno } from '@/lib/richiesteImmagine'
import { dalAl, elencoDate } from '@/lib/richiesteTesti'

// Immagine WhatsApp del soggiorno (1080px, identità visiva del sito): la STESSA
// per la conferma di prenotazione e per la proposta a una richiesta. Il markup
// viveva dentro components/ConfermaWhatsApp.tsx ed è stato spostato qui tale e
// quale; cambiano solo intestazione e i riquadri che hanno senso soltanto
// per una prenotazione confermata (orario di arrivo, frase del pagamento).
// Pezzo 6: con `nottiNonDisponibili` (proposta, caso C) il biglietto unico
// check-in/check-out lascia il posto alla linea del soggiorno: i periodi
// disponibili come blocchi separati e ogni notte scoperta come spazio vuoto
// «notte non disponibile». Un caso C non deve mai sembrare un soggiorno continuo.

export const IMG_W = 820
const IMG_SANS = 'var(--font-manrope), Arial, Helvetica, sans-serif'
const IMG_DISPLAY = 'var(--font-fraunces), Georgia, serif'

export type SegmentoImmagine = {
  id: string
  check_in: string
  check_out: string
  rooms?: { name?: string | null; bathroom_type?: string | null; extra_bed_price?: number | string | null } | null
}

export type DatiBonifico = { ricevuto: number; importo: number; causale: string; scadenzaF: string; intestatario: string; iban: string }

type Props = {
  imgRef: RefObject<HTMLDivElement | null>
  variante: 'conferma' | 'proposta'
  nome: string
  segmenti: SegmentoImmagine[]       // già ordinati per check_in
  numOspiti: number
  righeCosti: RigaCosto[]
  totale: number
  pagamento: 'contanti' | 'bonifico'
  lettoAggiuntivo?: boolean          // caso singolo: "+ letto aggiuntivo" accanto alla camera
  bonifico?: DatiBonifico            // solo con pagamento = 'bonifico'
  nottiNonDisponibili?: string[]     // proposta, caso C: notti richieste ma scoperte (giorni ISO)
}

// Data breve per il "biglietto": giorno della settimana + giorno + mese, senza anno
function formatDateHero(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatGiornoMese(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}
function notti(cin: string, cout: string) {
  return Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
}

export default function ImmagineSoggiorno({ imgRef, variante, nome, segmenti, numOspiti, righeCosti, totale, pagamento, lettoAggiuntivo = false, bonifico, nottiNonDisponibili = [] }: Props) {
  const intestazione = variante === 'conferma'
    ? { badge: 'BENVENUTI', titolo: 'Prenotazione confermata' }
    : { badge: 'PROPOSTA', titolo: 'Proposta di soggiorno' }
  const isGruppo = segmenti.length > 1
  const principale = segmenti[0]
  const camereDiverse = new Set(segmenti.map(s => s.rooms?.name)).size > 1
  const cin = segmenti[0].check_in
  const cout = segmenti[segmenti.length - 1].check_out
  // Linea del soggiorno (solo proposta con notti scoperte): le notti contate sono quelle a Casa Ania
  const linea = variante === 'proposta' && nottiNonDisponibili.length > 0
    ? lineaSoggiorno(segmenti.map(s => ({ arrivo: s.check_in, partenza: s.check_out, seg: s })), nottiNonDisponibili)
    : null
  const nottiTot = linea ? segmenti.reduce((n, s) => n + notti(s.check_in, s.check_out), 0) : notti(cin, cout)
  const nottiScoperteTot = linea ? linea.reduce((n, b) => n + (b.tipo === 'vuoto' ? b.notti.length : 0), 0) : 0
  const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const ricevuto = bonifico?.ricevuto ?? 0
  const importoBonifico = bonifico?.importo ?? totale
  const causale = bonifico?.causale ?? ''
  const scadenzaF = bonifico?.scadenzaF ?? ''
  const BONIFICO_INTESTATARIO = bonifico?.intestatario ?? ''
  const BONIFICO_IBAN = bonifico?.iban ?? ''

  // ── Stili dell'immagine (1080px, solo da leggere: nessun elemento cliccabile) ──
  const S = {
    box: { background: '#F6F2EA', borderRadius: 24, padding: '44px 48px', marginBottom: 32 } as React.CSSProperties,
    boxTitle: { fontFamily: IMG_DISPLAY, fontSize: 36, fontWeight: 600, color: '#1F3D2F', margin: '0 0 28px' } as React.CSSProperties,
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, padding: '14px 0' } as React.CSSProperties,
    rowBig: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, padding: '18px 0' } as React.CSSProperties,
    label: { fontSize: 32, color: '#3a3a35', flexShrink: 0 } as React.CSSProperties,
    labelBig: { fontSize: 36, color: '#3a3a35', flexShrink: 0 } as React.CSSProperties,
    value: { fontSize: 34, fontWeight: 700, color: '#1F3D2F', textAlign: 'right' as const },
    valueBig: { fontSize: 40, fontWeight: 700, color: '#1F3D2F', textAlign: 'right' as const },
    small: { fontSize: 30, color: '#3a3a35', lineHeight: 1.45 } as React.CSSProperties,
  }

  return (
    <>
      {/* ═══ IMMAGINE (1080px) ═══ */}
      <div ref={imgRef} style={{ width: IMG_W, background: '#f9f6f1', fontFamily: IMG_SANS }}>

        {/* TESTATA verde pieno #007451 (stesso verde della card del sito) */}
        <div style={{ background: '#007451', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '52px 44px 46px' }}>
          <span style={{ border: '2px solid rgba(255,255,255,0.8)', color: 'white', borderRadius: 999, padding: '8px 30px', fontSize: 30, fontWeight: 600, letterSpacing: 6, marginBottom: 24 }}>{intestazione.badge}</span>
          <p style={{ fontFamily: IMG_DISPLAY, fontSize: 54, fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.15 }}>{intestazione.titolo}</p>
          <p style={{ fontSize: 34, color: 'rgba(255,255,255,0.92)', margin: '18px 0 0' }}>{NOME_STRUTTURA} · a 140 metri da Humanitas</p>
          {/* Vecchia denominazione: gerarchia visiva inferiore, solo qui (mai nel footer) */}
          <p style={{ fontFamily: IMG_DISPLAY, fontStyle: 'italic', fontSize: 26, color: 'rgba(255,255,255,0.75)', margin: '10px 0 0' }}>precedentemente Casa Granata Humanitas</p>
        </div>

        <div style={{ padding: '52px 52px 0' }}>

          {/* SALUTO — nome cliente in evidenza */}
          <p style={{ fontFamily: IMG_DISPLAY, fontSize: 84, fontWeight: 600, color: '#1F3D2F', textAlign: 'center', margin: '0 0 32px', lineHeight: 1.05 }}>{nome}</p>

          {linea ? (
            /* LINEA DEL SOGGIORNO — periodi disponibili e notti scoperte, mai un biglietto unico */
            <div style={{ marginBottom: 30 }}>
              <p style={{ fontSize: 32, letterSpacing: 3, color: '#3a3a35', fontWeight: 700, margin: '0 0 14px' }}>SOGGIORNO NON CONTINUO</p>
              {linea.map((b, i) => b.tipo === 'camera' ? (
                <div key={`c-${i}`} style={{ background: 'white', border: '2px solid #e3ddd0', borderRadius: 24, padding: '28px 40px', marginBottom: 16 }}>
                  <div style={{ fontSize: 44, fontWeight: 700, color: '#1F3D2F', lineHeight: 1.15 }}>{maiuscola(dalAl(b.arrivo, b.partenza))}</div>
                  <div style={{ fontSize: 32, color: '#3a3a35', marginTop: 10, lineHeight: 1.35 }}>
                    {b.notti} {b.notti === 1 ? 'notte' : 'notti'} · Camera {roomWithType(b.segmento.seg.rooms?.name)}{bagnoDesc(b.segmento.seg.rooms) ? ` · bagno ${bagnoDesc(b.segmento.seg.rooms)}` : ''}
                  </div>
                  <div style={{ fontSize: 30, color: '#3a3a35', marginTop: 12, lineHeight: 1.15 }}>Check-in 15:00 – 20:00 · Check-out entro le 10:00</div>
                </div>
              ) : (
                <div key={`v-${i}`} style={{ background: '#F6F2EA', border: '3px dashed #C58A67', borderRadius: 24, padding: '26px 40px', marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, letterSpacing: 3, color: '#8C3B2E', fontWeight: 700 }}>{b.notti.length === 1 ? 'NOTTE NON DISPONIBILE' : `${b.notti.length} NOTTI NON DISPONIBILI`}</div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: '#1F3D2F', marginTop: 10 }}>{elencoDate(b.notti)}</div>
                  <div style={{ fontSize: 30, color: '#3a3a35', marginTop: 8 }}>da sistemare altrove</div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ display: 'flex', background: 'white', border: '2px solid #e3ddd0', borderRadius: 24, overflow: 'hidden', marginBottom: 30 }}>
            {/* Righe fisse nei due lati (etichetta / giorno settimana / numero / mese / orario),
                così le due colonne restano sempre allineate qualunque sia la lunghezza delle parole */}
            <div style={{ flex: 1, padding: '38px 28px 42px', textAlign: 'center', borderRight: '3px dashed #d9d2c3' }}>
              <div style={{ fontSize: 32, letterSpacing: 2, color: '#3a3a35' }}>CHECK-IN</div>
              <div style={{ fontSize: 38, fontWeight: 600, color: '#1F3D2F', marginTop: 12, lineHeight: 1 }}>{formatDateHero(cin).split(' ')[0]}</div>
              <div style={{ fontSize: 68, fontWeight: 700, color: '#1F3D2F', marginTop: 8, lineHeight: 1 }}>{formatDateHero(cin).split(' ')[1]}</div>
              <div style={{ fontSize: 38, fontWeight: 600, color: '#1F3D2F', marginTop: 8, lineHeight: 1 }}>{formatDateHero(cin).split(' ').slice(2).join(' ')}</div>
              <div style={{ fontSize: 32, color: '#3a3a35', marginTop: 24, lineHeight: 1.15 }}>15:00 – 20:00</div>
            </div>
            <div style={{ flex: 1, padding: '38px 28px 42px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, letterSpacing: 2, color: '#3a3a35' }}>CHECK-OUT</div>
              <div style={{ fontSize: 38, fontWeight: 600, color: '#1F3D2F', marginTop: 12, lineHeight: 1 }}>{formatDateHero(cout).split(' ')[0]}</div>
              <div style={{ fontSize: 68, fontWeight: 700, color: '#1F3D2F', marginTop: 8, lineHeight: 1 }}>{formatDateHero(cout).split(' ')[1]}</div>
              <div style={{ fontSize: 38, fontWeight: 600, color: '#1F3D2F', marginTop: 8, lineHeight: 1 }}>{formatDateHero(cout).split(' ').slice(2).join(' ')}</div>
              <div style={{ fontSize: 32, color: '#3a3a35', marginTop: 24, lineHeight: 1.15 }}>entro le 10:00</div>
            </div>
          </div>
          )}

          {/* NOTTI · OSPITI */}
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 30 }}>
            <div>
              <div style={{ fontSize: 46, fontWeight: 700, color: '#1F3D2F' }}>{nottiTot}</div>
              <div style={{ fontSize: 32, color: '#3a3a35' }}>{linea ? (nottiTot === 1 ? 'notte da noi' : 'notti da noi') : (nottiTot === 1 ? 'notte' : 'notti')}</div>
            </div>
            {linea && (
              <div>
                <div style={{ fontSize: 46, fontWeight: 700, color: '#8C3B2E' }}>{nottiScoperteTot}</div>
                <div style={{ fontSize: 32, color: '#3a3a35' }}>{nottiScoperteTot === 1 ? 'notte scoperta' : 'notti scoperte'}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 46, fontWeight: 700, color: '#1F3D2F' }}>{numOspiti}</div>
              <div style={{ fontSize: 32, color: '#3a3a35' }}>{numOspiti === 1 ? 'ospite' : 'ospiti'}</div>
            </div>
          </div>

          {/* CAMERA / BAGNO (con la linea del soggiorno la camera è già in ogni blocco) */}
          {!linea && <div style={{ background: '#F6F2EA', borderRadius: 24, padding: '30px 44px', marginBottom: 30 }}>
            {isGruppo ? (
              segmenti.map((s, i) => (
                <div key={s.id} style={{ padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid #e3ddd0' }}>
                  <div style={{ fontSize: 34, fontWeight: 700, color: '#1F3D2F' }}>{camereDiverse ? `Camera ${i + 1}` : `Periodo ${i + 1}`} · {roomWithType(s.rooms?.name)}</div>
                  <div style={{ fontSize: 32, color: '#3a3a35', marginTop: 6 }}>
                    {formatGiornoMese(s.check_in)} → {formatGiornoMese(s.check_out)} ({notti(s.check_in, s.check_out)} {notti(s.check_in, s.check_out) === 1 ? 'notte' : 'notti'})
                    {bagnoDesc(s.rooms) ? ` · bagno ${bagnoDesc(s.rooms)}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, padding: '8px 0' }}>
                  <span style={{ fontSize: 34, color: '#3a3a35', flexShrink: 0 }}>Camera</span>
                  <span style={{ fontSize: 36, fontWeight: 700, color: '#1F3D2F', textAlign: 'right' }}>{roomWithType(principale.rooms?.name)}{lettoAggiuntivo ? ' + letto aggiuntivo' : ''}</span>
                </div>
                {bagnoDesc(principale.rooms) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, padding: '8px 0' }}>
                    <span style={{ fontSize: 34, color: '#3a3a35', flexShrink: 0 }}>Bagno</span>
                    <span style={{ fontSize: 32, fontWeight: 400, color: '#3a3a35', textAlign: 'right' }}>{bagnoDesc(principale.rooms)}</span>
                  </div>
                )}
              </>
            )}
          </div>}

          {/* RIEPILOGO COSTI */}
          <div style={{ ...S.box, background: 'white', border: '2px solid #e3ddd0' }}>
            {righeCosti.map((r, i) => r.sconto ? (
              <div key={i} style={{ ...S.row, background: '#E7EFE9', borderRadius: 14, padding: '12px 16px', margin: '6px 0' }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: '#1F3D2F', flexShrink: 1, minWidth: 0, lineHeight: 1.35 }}>{r.label}</span>
                <span style={{ fontSize: 36, fontWeight: 700, color: '#2D6A4F', flexShrink: 0 }}>−{fmtEuro(-r.amount)}</span>
              </div>
            ) : (
              <div key={i} style={S.row}>
                <span style={{ ...S.label, color: '#3a3a35', flexShrink: 1, minWidth: 0, lineHeight: 1.35 }}>{r.label}</span>
                <span style={{ ...S.value, flexShrink: 0 }}>{fmtEuro(r.amount)}</span>
              </div>
            ))}
            <div style={{ ...S.row, borderTop: '2px solid #e3ddd0', marginTop: 12, paddingTop: 26 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#1F3D2F' }}>Totale soggiorno</span>
              <span style={{ fontSize: 44, fontWeight: 700, color: '#2D6A4F' }}>{fmtEuro(totale)}</span>
            </div>
            {pagamento === 'contanti' && variante === 'conferma' && (
              <p style={{ fontSize: 34, fontWeight: 600, color: '#1F3D2F', lineHeight: 1.5, margin: '18px 0 0' }}>
                Pagamento all&apos;arrivo, alla consegna delle chiavi, per l&apos;intera prenotazione: contanti o bonifico istantaneo.
              </p>
            )}
          </div>

          {/* PAGAMENTO ANTICIPATO (variante bonifico) */}
          {pagamento === 'bonifico' && (
            <div style={S.box}>
              <p style={S.boxTitle}>Pagamento</p>
              <p style={{ fontSize: 32, color: '#3a3a35', lineHeight: 1.5, margin: '0 0 26px' }}>
                Il soggiorno si salda in anticipo con bonifico bancario, per l&apos;intero importo. La prenotazione è confermata alla ricezione della ricevuta.
              </p>
              <div style={{ background: '#f9f6f1', borderRadius: 16, padding: '12px 32px', marginBottom: 26 }}>
                {ricevuto > 0 && (
                  <div style={S.row}><span style={S.label}>Già ricevuto</span><span style={{ ...S.value, fontWeight: 400 }}>{fmtEuro(ricevuto)}</span></div>
                )}
                <div style={S.row}><span style={S.label}>{ricevuto > 0 ? 'Da bonificare' : 'Importo'}</span><span style={{ ...S.value, fontWeight: 600 }}>{fmtEuro(importoBonifico)}</span></div>
                <div style={S.row}><span style={S.label}>Intestatario</span><span style={{ ...S.value, fontWeight: 400 }}>{BONIFICO_INTESTATARIO}</span></div>
                <div style={S.row}><span style={S.label}>IBAN</span><span style={{ ...S.value, fontWeight: 400, fontSize: 32, whiteSpace: 'nowrap' }}>{BONIFICO_IBAN}</span></div>
                <div style={S.row}><span style={S.label}>Causale</span><span style={{ ...S.value, fontWeight: 400 }}>{causale}</span></div>
                <div style={S.row}><span style={S.label}>Entro il</span><span style={{ ...S.value, fontWeight: 600 }}>{scadenzaF}</span></div>
              </div>
              <div style={{ background: '#f9f6f1', borderLeft: '3px solid #C58A67', borderRadius: 16, padding: '26px 40px', margin: 0 }}>
                <p style={{ fontSize: 32, color: '#1F3D2F', lineHeight: 1.6, margin: 0 }}>
                  Quando ha effettuato il bonifico ci mandi la ricevuta su WhatsApp. Senza la ricevuta entro il {scadenzaF}, la camera torna ad essere disponibile.
                </p>
              </div>
            </div>
          )}

          {variante === 'conferma' && (<>
          {/* RIQUADRO EVIDENZIATO */}
          <div style={{ background: '#EFF3EA', borderRadius: 24, padding: '34px 48px', marginBottom: 32 }}>
            <p style={{ fontSize: 34, fontWeight: 600, color: '#2D6A4F', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
              Appena le sarà possibile, le chiedo di comunicarmi l&apos;orario di arrivo, così potrò organizzare al meglio la sua accoglienza.
            </p>
          </div>

          </>)}
          {/* DOVE SIAMO */}
          <p style={{ fontSize: 32, letterSpacing: 3, color: '#3a3a35', fontWeight: 700, margin: '0 0 14px' }}>DOVE SIAMO</p>
          <div style={{ background: 'white', borderLeft: '4px solid #C58A67', borderRadius: '0 16px 16px 0', padding: '28px 40px', marginBottom: 34 }}>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#1F3D2F', lineHeight: 1.35, margin: 0 }}>{INDIRIZZO}</p>
            <p style={{ fontSize: 32, color: '#3a3a35', margin: '10px 0 0' }}>{INDIRIZZO_NOTA}</p>
          </div>

          {/* CONTATTI — solo numero + firma */}
          <div style={{ textAlign: 'center', paddingBottom: 42 }}>
            <p style={{ fontSize: 46, fontWeight: 700, color: '#2D6A4F', margin: '0 0 26px' }}>{TELEFONO_DISPLAY}</p>
            <p style={{ fontFamily: IMG_DISPLAY, fontSize: 46, fontWeight: 600, color: '#1F3D2F', margin: 0 }}>A presto, Ania</p>
          </div>
        </div>

        {/* PIÈ DI PAGINA */}
        <div style={{ background: '#F6F2EA', padding: '26px 52px', textAlign: 'center' }}>
          <p style={{ fontSize: 32, color: '#3a3a35', margin: 0 }}>{NOME_STRUTTURA} · {CITTA_STRUTTURA} · {SITO_DISPLAY}</p>
        </div>
      </div>
      {/* ═══ FINE IMMAGINE ═══ */}
    </>
  )
}
