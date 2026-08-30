// ============================================================================
// PULIZIA DEL COLLAUDO (Fase 4) — logica PURA e iniettabile, testata in
// locale con servizi simulati. Regole:
//  · PRIMA di cancellare si RECUPERA: gli id documento mancanti si
//    risolvono dai SOLI token esatti registrati (registrazione riuscita ma
//    risposta persa prima di annotare l'id);
//  · un file si elimina SOLO dopo aver verificato che NESSUNA ricevuta lo
//    usa (mai lasciare una ricevuta che punta a un allegato cancellato);
//  · gli utenti si recuperano anche dalle IDENTITÀ esatte registrate prima
//    della richiesta (creazione riuscita, risposta persa);
//  · un registro si marca pulito SOLO dopo la verifica di assenza dei suoi
//    residui; errori o incertezze lo lasciano recuperabile;
//  · NESSUNA cancellazione generica (per token qualunque o per prefisso).
// ============================================================================

// controlli OBBLIGATORI prima di qualsiasi cancellazione: fotografia
// presente, completa e leggibile; registri ben formati. Un controllo
// fallito blocca tutto.
export function validaPreliminari({ fotografia, chiaviAttese, registri }) {
  const controlli = []
  const aggiungi = (nome, ok, dettaglio = '') => controlli.push({ nome, ok, dettaglio })

  aggiungi('fotografia presente e leggibile', !!fotografia && typeof fotografia === 'object')
  if (fotografia && typeof fotografia === 'object') {
    const mancanti = chiaviAttese.filter(k => !(k in fotografia))
    aggiungi('fotografia completa (tutte le chiavi attese)', mancanti.length === 0,
      mancanti.length ? `mancano: ${mancanti.join(', ')}` : '')
    const invalide = chiaviAttese.filter(k => {
      const v = fotografia[k]
      return !(v && Number.isInteger(v.n) && v.n >= 0 && typeof v.impronta === 'string' && v.impronta.length > 0)
    })
    aggiungi('fotografia valida (conteggio e impronta per ogni voce)', invalide.length === 0,
      invalide.length ? `voci invalide: ${invalide.join(', ')}` : '')
  }
  const campi = ['tokens', 'documenti', 'percorsi', 'estranei', 'utenti', 'identita']
  const rotti = (registri ?? []).filter(r => !r?.dati || typeof r.dati.pulito !== 'boolean'
    || campi.some(c => r.dati[c] !== undefined && !Array.isArray(r.dati[c])))
  aggiungi('registri ben formati', Array.isArray(registri) && rotti.length === 0,
    rotti.length ? `registri rotti: ${rotti.length}` : '')

  return { ok: controlli.every(c => c.ok), controlli }
}

// Pulisce i registri APERTI usando SOLO i loro contenuti. `servizi` è
// l'accesso al mondo esterno (vero nel passo 5, simulato nei test).
export async function eseguiPulizia(registri, servizi, log = () => {}) {
  const bilancio = { puliti: 0, aperti: 0, documenti: 0, ricevute: 0, oggetti: 0, utenti: 0, problemi: [] }

  for (const r of registri.filter(x => !x.dati.pulito)) {
    const problemi = []
    try {
      const { tokens = [], documenti = [], percorsi = [], estranei = [], utenti = [], identita = [] } = r.dati

      // 1) RECUPERO: id mancanti risolti dai soli token esatti registrati
      const daToken = tokens.length ? await servizi.documentiDaToken(tokens) : []
      const ids = [...new Set([...documenti, ...daToken.map(d => d.id)])]

      // 2) ricevute e documenti (le ricevute PRIMA: la FK lo impone)
      for (const id of ids) {
        bilancio.ricevute += await servizi.eliminaRicevuteDiDocumento(id)
        bilancio.documenti += await servizi.eliminaDocumento(id)
      }

      // 3) oggetti storage: SOLO percorsi esatti, e MAI se una ricevuta
      //    (di chiunque) li usa ancora
      for (const percorso of [...new Set([...percorsi, ...estranei])]) {
        if (await servizi.ricevutaCheUsaPercorso(percorso)) {
          problemi.push(`percorso ${percorso}: ancora usato da una ricevuta — NON cancellato`)
          continue
        }
        if (await servizi.eliminaOggetto(percorso)) bilancio.oggetti++
      }

      // 4) utenti sintetici: id registrati + RECUPERO dalle identità esatte
      const daIdentita = identita.length ? await servizi.utentiDaIdentita(identita) : []
      for (const id of [...new Set([...utenti, ...daIdentita.map(u => u.id)])]) {
        await servizi.rimuoviAppartenenza(id)
        if (await servizi.eliminaUtente(id)) bilancio.utenti++
      }

      // 5) CHIUSURA solo a residui ZERO, verificati adesso
      const residui = await servizi.residuiRegistro(r.dati)
      const totale = Object.values(residui).reduce((s, n) => s + n, 0)
      if (problemi.length || totale > 0) {
        problemi.push(...Object.entries(residui).filter(([, n]) => n > 0)
          .map(([k, n]) => `residui ${k}: ${n}`))
        bilancio.aperti++
        bilancio.problemi.push({ registro: r.file, problemi })
        log(`registro ${r.file}: RESTA APERTO (${problemi.join(' · ')})`)
      } else {
        await servizi.marcaPulito(r)
        bilancio.puliti++
        log(`registro ${r.file}: ripulito e chiuso (residui verificati: zero)`)
      }
    } catch (e) {
      // errore o incertezza: il registro resta RECUPERABILE
      bilancio.aperti++
      bilancio.problemi.push({ registro: r.file, problemi: [`errore: ${String(e.message ?? e)}`] })
      log(`registro ${r.file}: errore durante la pulizia — resta aperto (${String(e.message ?? e)})`)
    }
  }
  return bilancio
}
