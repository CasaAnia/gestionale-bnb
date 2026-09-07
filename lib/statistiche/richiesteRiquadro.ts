// ============================================================================
// RIQUADRO «RICHIESTE» IN STATISTICHE (07/09/2026, incarico «Rifiuta con
// motivo», parte 3). Per il periodo scelto, sulle richieste ARRIVATE in quel
// periodo (created_at, giorno locale) e ormai CHIUSE — quelle in corso non
// contano, si dicono a parte:
//   · arrivate, diventate prenotazioni (con la percentuale), scadute senza
//     risposta (chiuse per scadenza + rifiutate «non ha risposto»), ha detto
//     di no, date a un altro, altro motivo (compresi i rifiuti vecchi senza
//     codice);
//   · per camera chiesta (Allegra, Ambra, Amelia, Lena + «Qualsiasi»):
//     chiesta, non era libera, diventata prenotazione. «Non era libera» =
//     è stata inviata una proposta e la camera chiesta non compariva fra le
//     camere proposte (soluzione + alternative);
//   · «hanno accettato una camera diversa da quella chiesta: 5 su 8» =
//     confermate con camera chiesta precisa la cui soluzione confermata non
//     è tutta in quella camera, su tutte le confermate con camera precisa;
//   · «proposta un'alternativa, non hanno risposto o hanno detto no» = camera
//     chiesta non libera, proposta inviata, esito non confermato.
// Funzioni pure, nessun Supabase; i motivi passano da lib/motivoRifiuto.
// ============================================================================
import { normalizzaMotivoRifiuto } from '../motivoRifiuto.ts'

type SegmentoCamera = { camera?: { id: string; name?: string } | null }
export type RichiestaRiquadro = {
  id: string
  created_at: string
  stato: string
  chiusura_motivo?: string | null
  motivo_rifiuto?: string | null
  camera_id: string | null
  proposta_inviata_at?: string | null
  proposta_soluzione?: { segmenti?: SegmentoCamera[] | null } | null
  proposta_alternative?: ({ segmenti?: SegmentoCamera[] | null } | null)[] | null
}
export type CameraNome = { id: string; name: string }

export type RigaCamera = { nome: string; chiesta: number; nonEraLibera: number | null; diventata: number }
export type RiquadroRichieste = {
  arrivate: number
  inCorso: number                       // arrivate nel periodo ma ancora aperte: NON contate sopra
  diventatePrenotazioni: number
  percentoPrenotazioni: number          // su arrivate, arrotondato
  scaduteSenzaRisposta: number
  dettoNo: number
  dateAdAltro: number
  altroMotivo: number
  perCamera: RigaCamera[]
  accettatoDiversa: { si: number; su: number }
  alternativaNonAccettata: number
}

export const NOME_QUALSIASI = 'Qualsiasi'
const APERTA = new Set(['in_attesa', 'proposta_inviata'])

// Giorno locale (YYYY-MM-DD) di un timestamp: il browser di Ania è a Roma
export function giornoLocale(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const segmentiSoluzione = (r: RichiestaRiquadro): SegmentoCamera[] => r.proposta_soluzione?.segmenti ?? []
const camereProposte = (r: RichiestaRiquadro): Set<string> => {
  const ids = new Set<string>()
  for (const s of segmentiSoluzione(r)) if (s.camera?.id) ids.add(s.camera.id)
  for (const a of r.proposta_alternative ?? []) for (const s of a?.segmenti ?? []) if (s.camera?.id) ids.add(s.camera.id)
  return ids
}
const propostaInviata = (r: RichiestaRiquadro) => !!r.proposta_inviata_at && segmentiSoluzione(r).length > 0
// Camera chiesta precisa, proposta inviata, camera chiesta assente dalle proposte
const cameraNonEraLibera = (r: RichiestaRiquadro) => !!r.camera_id && propostaInviata(r) && !camereProposte(r).has(r.camera_id)

export const eConfermata = (r: { stato: string }) => r.stato === 'confermata'
export const eScaduta = (r: { stato: string; chiusura_motivo?: string | null }) => r.stato === 'chiusa' && r.chiusura_motivo === 'scaduta'
export const eRifiutata = (r: { stato: string; chiusura_motivo?: string | null }) => r.stato === 'rifiutata' || (r.stato === 'chiusa' && r.chiusura_motivo === 'rifiutata')

export function riquadroRichieste(richieste: RichiestaRiquadro[], camere: CameraNome[], da: string, a: string, giornoDi: (iso: string) => string = giornoLocale): RiquadroRichieste {
  const nelPeriodo = richieste.filter(r => { const g = giornoDi(r.created_at); return g >= da && g < a })
  const inCorso = nelPeriodo.filter(r => APERTA.has(r.stato))
  const chiuse = nelPeriodo.filter(r => !APERTA.has(r.stato))
  const confermate = chiuse.filter(eConfermata)
  const motivo = (r: RichiestaRiquadro) => normalizzaMotivoRifiuto(r.motivo_rifiuto)
  const rifiutate = chiuse.filter(eRifiutata)
  const scadute = chiuse.filter(eScaduta).length + rifiutate.filter(r => motivo(r) === 'non_risposto').length
  const dettoNo = rifiutate.filter(r => motivo(r) === 'detto_no').length
  const dateAdAltro = rifiutate.filter(r => motivo(r) === 'data_ad_altro').length
  const altro = rifiutate.filter(r => { const m = motivo(r); return m === 'altro' || m === null }).length

  const ordinate = [...camere].sort((x, y) => x.name.localeCompare(y.name, 'it'))
  const perCamera: RigaCamera[] = ordinate.map(c => ({
    nome: c.name,
    chiesta: chiuse.filter(r => r.camera_id === c.id).length,
    nonEraLibera: chiuse.filter(r => r.camera_id === c.id && cameraNonEraLibera(r)).length,
    diventata: confermate.filter(r => r.camera_id === c.id).length,
  }))
  perCamera.push({ nome: NOME_QUALSIASI, chiesta: chiuse.filter(r => !r.camera_id).length, nonEraLibera: null, diventata: confermate.filter(r => !r.camera_id).length })

  const conCameraPrecisa = confermate.filter(r => !!r.camera_id)
  const diversa = conCameraPrecisa.filter(r => { const seg = segmentiSoluzione(r); return seg.length > 0 && !seg.every(s => s.camera?.id === r.camera_id) }).length
  const alternativaNonAccettata = chiuse.filter(r => cameraNonEraLibera(r) && !eConfermata(r)).length

  return {
    arrivate: chiuse.length,
    inCorso: inCorso.length,
    diventatePrenotazioni: confermate.length,
    percentoPrenotazioni: chiuse.length > 0 ? Math.round(confermate.length * 100 / chiuse.length) : 0,
    scaduteSenzaRisposta: scadute,
    dettoNo,
    dateAdAltro,
    altroMotivo: altro,
    perCamera,
    accettatoDiversa: { si: diversa, su: conCameraPrecisa.length },
    alternativaNonAccettata,
  }
}
