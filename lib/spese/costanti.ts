// Costanti e formattatori del modulo spese (estratti da SpeseTracker.tsx in
// Fase 1 — valori identici, nessun cambiamento visibile).

export const GROUP_COLORS: Record<string, string> = {
  'Casa': '#5B8A70', 'Ania': '#BCA06A', 'Matteo': '#8AA1B8',
  'Matteo e Ania': '#AD90A8', 'Casa Ania': '#BC7E6E',
}
export const FALLBACK_COLOR = '#9AA096'
export const ACCENT = '#7D9DB0' // azzurro carta da zucchero, come "pagato" in arrivi/calendario
export const ICONE: Record<string, string> = {
  'Spesa alimentare': '🛒', 'Detersivi e pulizia': '🧴', 'Bar': '☕', 'Bar e caffe': '☕',
  'Mangiare fuori': '🍽️', 'Abbigliamento': '👗', 'Gelato e merenda': '🍦', 'Sacchetti': '🛍️',
  'Scarpe': '👟', 'Salute ed estetica': '💆‍♀️', 'Salute e farmacia': '💊', 'Manutenzione': '🔧',
  'Manutenzione casa': '🔧', 'Arredo e acquisti': '🛋️', 'Utensili cucina': '🍳', 'Cancelleria': '✏️',
  'Tecnologia': '📱', 'Telefono/Internet': '📶', 'Telefono': '📶', 'Internet': '📶', 'Cura persona': '🧼',
  'Forniture': '📦', 'Utenze': '💡', 'Luce': '💡', 'Gas': '🔥', 'Acqua': '🚿', 'Spesa': '🛒',
  'Lavori e ristrutturazione': '🏗️', 'Riparazioni': '🔧', 'Prodotti di pulizia': '🧴',
  'Macchina': '🚗', 'Trasporti': '🚌', 'Viaggi': '✈️', 'Regali': '🎁', 'Svago': '🎉',
  'Scuola': '🎒', 'Sport': '⚽', 'Paghetta': '💰', 'Parrucchiere': '💇', 'Assicurazioni': '🛡️',
  'Tasse': '🏛️', 'Abbonamenti': '🔁', 'Varie': '📦', 'Servizi': '🧾',
  // Nomi nuovi (riordino 0015)
  'Detersivi': '🧴', 'Cura corpo': '🧼', 'Medico': '💊', 'Colazione/Bar': '☕',
  'Merenda': '🍦', 'Divertimento': '🎉', 'Cucina utensili': '🍳', 'Arredo casa': '🛋️',
  'Riparazioni e manutenzione': '🔧', 'Auto': '🚗', 'Cancelleria casa': '✏️',
  'Assicurazioni e tasse': '🛡️', 'Biancheria': '🛏️', 'Commissioni': '💳',
}
export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const eur = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
export const eur2 = (n: number) => '€' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// Nome negozio corto: via la città, ma "Iper bar" e "Iper supermercato" restano distinti
export const corto = (s: string) => s.replace(/ (Rozzano|Milano( \S+)?|Fiordaliso|Milanofiori|Assago|Pieve Emanuele|Locate Triulzi|Basiglio|Scalo Milano)( bar| supermercato)?$/i, '$3').trim()
export const icona = (cat: string) => ICONE[cat] || '🏷️'
