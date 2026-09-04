// Documenti d'identità dei clienti (05/09/2026): funzioni pure, senza
// Supabase e senza React. Le foto stanno nel bucket privato «documenti»
// (migrazione 0032) e la tabella documenti_cliente le traccia.
// Nessuna cancellazione automatica: restano finché Ania non le toglie.

export type EtichettaDocumento = 'documento' | 'carta_identita' | 'passaporto' | 'patente' | 'altro'
export type LatoDocumento = 'fronte' | 'retro'

export type DocumentoCliente = {
  id: string
  guest_id: string
  percorso: string
  etichetta: EtichettaDocumento
  lato: LatoDocumento | null
  nome_file: string | null
  dimensione: number | null
  created_at: string
}

export const ETICHETTE: { chiave: EtichettaDocumento; label: string }[] = [
  { chiave: 'carta_identita', label: "Carta d'identità" },
  { chiave: 'passaporto', label: 'Passaporto' },
  { chiave: 'patente', label: 'Patente' },
  { chiave: 'documento', label: 'Documento' },
  { chiave: 'altro', label: 'Altro' },
]

export function etichettaLeggibile(d: Pick<DocumentoCliente, 'etichetta' | 'lato'>): string {
  const base = ETICHETTE.find(e => e.chiave === d.etichetta)?.label ?? 'Documento'
  return d.lato ? `${base} · ${d.lato}` : base
}

// Percorso nel bucket: <guest_id>/<id>.<ext>. Estensione presa dal tipo MIME
// (le foto vengono sempre ridotte a JPEG), mai dal nome scelto dall'utente.
export function percorsoDocumento(guestId: string, id: string, tipoMime: string): string {
  const ext = tipoMime === 'image/png' ? 'png' : tipoMime === 'image/webp' ? 'webp' : tipoMime === 'application/pdf' ? 'pdf' : 'jpg'
  return `${guestId}/${id}.${ext}`
}

// Tipi accettati dal telefono: foto (fotocamera/galleria) e PDF.
export function tipoAccettato(tipoMime: string): boolean {
  return /^image\/(jpeg|png|webp|heic|heif)$/.test(tipoMime) || tipoMime === 'application/pdf'
}

// Lato lungo massimo della foto ridotta: 1600 px bastano a leggere un documento
export const LATO_MAX = 1600

// Nuove misure mantenendo le proporzioni; mai ingrandire.
export function misureRidotte(larghezza: number, altezza: number, latoMax = LATO_MAX): { larghezza: number; altezza: number } {
  const maggiore = Math.max(larghezza, altezza)
  if (maggiore <= latoMax || maggiore === 0) return { larghezza, altezza }
  const f = latoMax / maggiore
  return { larghezza: Math.round(larghezza * f), altezza: Math.round(altezza * f) }
}

// "312 KB" · "1,4 MB"
export function dimensioneLeggibile(byte: number | null | undefined): string {
  if (!byte || byte <= 0) return ''
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`
  return `${(byte / (1024 * 1024)).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`
}

// Testo della riga discreta nella scheda prenotazione
export function rigaDocumenti(n: number): string {
  return n === 0 ? 'Nessun documento' : n === 1 ? 'Documenti · 1' : `Documenti · ${n}`
}
