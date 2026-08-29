// ============================================================================
// ADATTATORE (Fase 3.2A) — costruisce DatiSpese dallo schema REALE (0020),
// in SOLA LETTURA: funzione pura, nessuna chiamata di rete, nessuna
// scrittura. Chi la usa le passa le righe già lette (dal browser autenticato
// nella prova, o dai fixture nei test).
//
// Regole rispettate:
//  · una spesa storica = contata UNA volta sola (o dentro il suo documento,
//    o come movimento manuale se senza documento);
//  · documento misto = UNA voce con quote per ambito (somma = totale);
//  · fatture approvate ma NON pagate = "da pagare", fuori dallo Speso
//    (l'invariante economico: in family_expenses c'è solo denaro uscito);
//  · foto multiple e documenti senza fotografia gestiti;
//  · più categorie/persone/camere per documento: insiemi veri per i filtri.
// ============================================================================
import type {
  Contesto, DatiSpese, DocumentoVista, MovimentoVista, OpzioniFiltri,
  PanoramicaAniaVista, PanoramicaMiaVista, PeriodoVista, RigaMovimentoVista,
  StatoDocumento, StatoMovimento,
} from './vista'

// ---- righe grezze (solo i campi che servono qui) ----
export type GrezzoGruppo = { id: string; name: string; ambito: string | null }
export type GrezzaCategoria = { id: string; name: string }
export type GrezzaSottocategoria = { category_name: string; name: string }
export type GrezzaCamera = { id: string; name: string }
export type GrezzaSpesa = {
  id: string; amount: number; expense_date: string; group_id: string | null
  category_id: string | null; subcategory: string | null; description: string | null
  store: string | null; product: string | null; receipt_id: string | null
  payment_method?: string | null; paid_at?: string | null; room_id?: string | null
}
export type GrezzaRiga = {
  id: string; expense_id: string; name: string; amount: number
  category_id: string | null; subcategory: string | null
}
export type GrezzoDocumento = {
  id: string; kind: string; status: string; doc_total: number | null
  supplier: string | null; document_date: string | null; due_date: string | null
  upload_ambito: string; error_message: string | null; note: string | null
  created_at: string
}
export type GrezzoPonte = { expense_id: string; document_id: string }
export type GrezzaRicevuta = { id: string; document_id: string | null }
export type GrezzaBozza = { id: string; document_id: string; status: string; confidence?: unknown }

export type GrezzoBudget = { ambito: string; category_name: string; monthly_amount: number }

export type TabelleGrezze = {
  documenti: GrezzoDocumento[]
  ponte: GrezzoPonte[]
  spese: GrezzaSpesa[]
  righe: GrezzaRiga[]
  ricevute: GrezzaRicevuta[]
  bozze: GrezzaBozza[]
  gruppi: GrezzoGruppo[]
  categorie: GrezzaCategoria[]
  camere: GrezzaCamera[]
  budget?: GrezzoBudget[]
}

const cent = (n: number) => Math.round(Number(n) * 100)
const daCent = (c: number) => c / 100

// etichette delle persone: il gruppo "Matteo" si mostra come "Teo",
// "Matteo e Ania" come "M e A" (decisioni approvate; il dato non cambia)
export function etichettaPersona(nomeGruppo: string): string {
  if (nomeGruppo === 'Matteo') return 'Teo'
  if (nomeGruppo === 'Matteo e Ania') return 'M e A'
  return nomeGruppo
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export function etichettaGiorno(iso: string, oggi: string): string {
  if (iso === oggi) return 'Oggi'
  const [a, m, g] = iso.split('-').map(Number)
  const [ao] = oggi.split('-').map(Number)
  return `${g} ${MESI_BREVI[m - 1]}${a !== ao ? ` ${a}` : ''}`
}

const ultimoGiornoDelMese = (anno: number, mese1a12: number) =>
  new Date(Date.UTC(anno, mese1a12, 0)).getUTCDate()
const iso = (d: Date) => d.toISOString().slice(0, 10)

// periodi con id stabile: mese corrente, mese scorso, questa settimana
// (lun–dom), ogni anno presente nei dati, e il Dal–al libero
export function costruisciPeriodi(oggi: string, anniPresenti: number[]): PeriodoVista[] {
  const [anno, mese] = oggi.split('-').map(Number)
  const meseId = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`
  const mesePeriodo = (a: number, m: number): PeriodoVista => ({
    id: meseId(a, m), tipo: 'mese',
    etichetta: `${MESI[m - 1][0].toUpperCase()}${MESI[m - 1].slice(1)} ${a}`,
    dal: `${meseId(a, m)}-01`, al: `${meseId(a, m)}-${String(ultimoGiornoDelMese(a, m)).padStart(2, '0')}`,
  })
  const scorso = mese === 1 ? mesePeriodo(anno - 1, 12) : mesePeriodo(anno, mese - 1)
  const d = new Date(`${oggi}T00:00:00Z`)
  const daLunedi = (d.getUTCDay() + 6) % 7
  const lunedi = new Date(d); lunedi.setUTCDate(d.getUTCDate() - daLunedi)
  const domenica = new Date(lunedi); domenica.setUTCDate(lunedi.getUTCDate() + 6)
  const anni = [...new Set([anno, ...anniPresenti])].sort((x, y) => y - x)
  return [
    mesePeriodo(anno, mese),
    scorso,
    { id: `${oggi}-settimana`, etichetta: 'Questa settimana', tipo: 'settimana', dal: iso(lunedi), al: iso(domenica) },
    ...anni.map(a => ({ id: String(a), etichetta: `Anno ${a}`, tipo: 'anno' as const, dal: `${a}-01-01`, al: `${a}-12-31` })),
    { id: 'intervallo', etichetta: 'Dal–al…', tipo: 'intervallo', dal: '', al: '' },
  ]
}

// ---------------------------------------------------------------------------
export function costruisciDatiSpese(t: TabelleGrezze, oggi: string): DatiSpese {
  const gruppoDi = new Map(t.gruppi.map(g => [g.id, g]))
  const categoriaDi = new Map(t.categorie.map(c => [c.id, c.name]))
  const cameraDi = new Map(t.camere.map(c => [c.id, c.name]))
  const righeDiSpesa = new Map<string, GrezzaRiga[]>()
  for (const r of t.righe) {
    if (!righeDiSpesa.has(r.expense_id)) righeDiSpesa.set(r.expense_id, [])
    righeDiSpesa.get(r.expense_id)!.push(r)
  }
  const fotoDiDocumento = new Map<string, number>()
  for (const r of t.ricevute) {
    if (r.document_id) fotoDiDocumento.set(r.document_id, (fotoDiDocumento.get(r.document_id) ?? 0) + 1)
  }
  const bozzeDiDocumento = new Map<string, GrezzaBozza[]>()
  for (const b of t.bozze) {
    if (!bozzeDiDocumento.has(b.document_id)) bozzeDiDocumento.set(b.document_id, [])
    bozzeDiDocumento.get(b.document_id)!.push(b)
  }
  const speseDiDocumento = new Map<string, GrezzaSpesa[]>()
  const documentoDiSpesa = new Map<string, string>()
  const spesaDi = new Map(t.spese.map(s => [s.id, s]))
  for (const p of t.ponte) {
    const s = spesaDi.get(p.expense_id)
    if (!s) continue
    if (documentoDiSpesa.has(p.expense_id)) continue // mai contare due volte
    documentoDiSpesa.set(p.expense_id, p.document_id)
    if (!speseDiDocumento.has(p.document_id)) speseDiDocumento.set(p.document_id, [])
    speseDiDocumento.get(p.document_id)!.push(s)
  }

  const ambitoDiSpesa = (s: GrezzaSpesa): Contesto =>
    (s.group_id ? gruppoDi.get(s.group_id)?.ambito : 'personale') === 'azienda' ? 'ania' : 'mia'
  const personaDiSpesa = (s: GrezzaSpesa): string | undefined => {
    const g = s.group_id ? gruppoDi.get(s.group_id) : undefined
    return g && g.ambito !== 'azienda' ? etichettaPersona(g.name) : undefined
  }
  const cameraDiSpesa = (s: GrezzaSpesa): string | undefined =>
    ambitoDiSpesa(s) === 'ania' ? (s.room_id ? cameraDi.get(s.room_id) ?? 'Generale' : 'Generale') : undefined

  const principale = (valori: (string | undefined)[]): string | undefined => {
    const conta = new Map<string, number>()
    for (const v of valori) if (v) conta.set(v, (conta.get(v) ?? 0) + 1)
    return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }

  // una spesa → le sue righe di vista (se non ha righe, la spesa stessa)
  const righeVista = (s: GrezzaSpesa): RigaMovimentoVista[] => {
    const base = {
      contesto: ambitoDiSpesa(s), persona: personaDiSpesa(s), camera: cameraDiSpesa(s),
    }
    const righe = righeDiSpesa.get(s.id) ?? []
    if (righe.length === 0) {
      return [{
        nome: s.product || s.description || 'Spesa', importo: Number(s.amount),
        categoria: s.category_id ? categoriaDi.get(s.category_id) : undefined,
        sottocategoria: s.subcategory ?? undefined, ...base,
      }]
    }
    return righe.map(r => ({
      nome: r.name, importo: Number(r.amount),
      categoria: (r.category_id ? categoriaDi.get(r.category_id) : undefined)
        ?? (s.category_id ? categoriaDi.get(s.category_id) : undefined),
      sottocategoria: r.subcategory ?? s.subcategory ?? undefined, ...base,
    }))
  }

  const statoDocumento = (d: GrezzoDocumento): StatoDocumento =>
    d.status === 'da_elaborare' ? 'da_elaborare'
      : d.status === 'in_revisione' ? 'da_controllare'
        : d.status === 'approvata_da_pagare' ? 'da_pagare'
          : d.status === 'confermato' ? (d.kind === 'fattura' ? 'pagata' : 'confermato')
            : d.status === 'errore' ? 'errore' : 'scartato'

  // ---- MOVIMENTI: una voce per documento con spese ----
  const movimenti: MovimentoVista[] = []
  for (const d of t.documenti) {
    const spese = speseDiDocumento.get(d.id) ?? []
    if (spese.length === 0) {
      // fattura approvata ma non pagata: compare come movimento "da pagare"
      // (denaro NON ancora uscito: nessuna spesa esiste, resta fuori dallo Speso)
      if (d.status === 'approvata_da_pagare') {
        const contesto: Contesto = d.upload_ambito === 'azienda' ? 'ania' : 'mia'
        movimenti.push({
          id: `doc-${d.id}`, titolo: d.supplier ? `Fattura ${d.supplier}` : 'Fattura da pagare',
          data: d.document_date ?? d.created_at.slice(0, 10),
          giorno: etichettaGiorno(d.document_date ?? d.created_at.slice(0, 10), oggi),
          importo: Number(d.doc_total ?? 0), categoria: 'Fatture', contesto,
          persona: contesto === 'ania' ? 'Casa Ania' : 'Casa', stato: 'da_pagare',
          categorie: ['Fatture'], sottocategorie: [], persone: [], metodi: [],
          camere: contesto === 'ania' ? ['Generale'] : [],
          senzaFoto: !fotoDiDocumento.get(d.id),
        })
      }
      continue
    }
    const ambiti = new Set(spese.map(ambitoDiSpesa))
    const contesto: MovimentoVista['contesto'] = ambiti.size > 1 ? 'misto' : [...ambiti][0]
    const totaleCent = spese.reduce((sum, s) => sum + cent(s.amount), 0)
    const righe = spese.flatMap(righeVista)
    const data = spese.map(s => s.expense_date).sort().at(-1)!
    const metodi = [...new Set(spese.map(s => s.payment_method).filter((x): x is string => !!x))]
    const stato: StatoMovimento = statoDocumento(d) === 'pagata' ? 'pagata'
      : statoDocumento(d) === 'da_controllare' ? 'da_controllare' : 'confermato'
    movimenti.push({
      id: `doc-${d.id}`,
      titolo: d.supplier || principale(spese.map(s => s.store ?? undefined))
        || principale(spese.map(s => s.description ?? undefined)) || 'Documento',
      negozio: principale(spese.map(s => s.store ?? undefined)),
      data, giorno: etichettaGiorno(data, oggi),
      importo: d.doc_total != null ? Number(d.doc_total) : daCent(totaleCent),
      categoria: principale(righe.map(r => r.categoria)) ?? 'Altro',
      contesto,
      persona: principale(spese.map(personaDiSpesa)) ?? 'Casa',
      metodo: metodi.length === 1 ? metodi[0] : undefined,
      stato,
      categorie: [...new Set(righe.map(r => r.categoria).filter((x): x is string => !!x))],
      sottocategorie: [...new Set(righe.map(r => r.sottocategoria).filter((x): x is string => !!x))],
      persone: [...new Set(spese.map(personaDiSpesa).filter((x): x is string => !!x))],
      camere: [...new Set(spese.map(cameraDiSpesa).filter((x): x is string => !!x))],
      metodi,
      sorelle: contesto === 'misto'
        ? (['mia', 'ania'] as const).map(c => ({
            contesto: c,
            importo: daCent(spese.filter(s => ambitoDiSpesa(s) === c).reduce((sum, s) => sum + cent(s.amount), 0)),
          })).filter(q => q.importo > 0)
        : undefined,
      righe,
      senzaFoto: !fotoDiDocumento.get(d.id),
    })
  }

  // ---- spese manuali senza documento: una voce ciascuna ----
  for (const s of t.spese) {
    if (documentoDiSpesa.has(s.id)) continue     // già dentro un documento
    if (s.receipt_id) continue                    // collegata a un file legacy non migrato: non duplicare
    const righe = righeVista(s)
    movimenti.push({
      id: `spesa-${s.id}`,
      titolo: s.description || s.product || s.store || 'Spesa manuale',
      negozio: s.store ?? undefined,
      data: s.expense_date, giorno: etichettaGiorno(s.expense_date, oggi),
      importo: Number(s.amount),
      categoria: righe[0]?.categoria ?? 'Altro',
      contesto: ambitoDiSpesa(s),
      persona: personaDiSpesa(s) ?? (ambitoDiSpesa(s) === 'ania' ? 'Casa Ania' : 'Casa'),
      metodo: s.payment_method ?? undefined,
      stato: 'senza_documento',
      categorie: [...new Set(righe.map(r => r.categoria).filter((x): x is string => !!x))],
      sottocategorie: [...new Set(righe.map(r => r.sottocategoria).filter((x): x is string => !!x))],
      persone: personaDiSpesa(s) ? [personaDiSpesa(s)!] : [],
      camere: cameraDiSpesa(s) ? [cameraDiSpesa(s)!] : [],
      metodi: s.payment_method ? [s.payment_method] : [],
      righe: righe.length > 1 ? righe : undefined,
      senzaFoto: true,
    })
  }
  movimenti.sort((a, b) => b.data.localeCompare(a.data))

  // ---- DOCUMENTI ----
  const documenti: DocumentoVista[] = t.documenti.map(d => {
    const spese = speseDiDocumento.get(d.id) ?? []
    const ambiti = new Set(spese.map(ambitoDiSpesa))
    const contesto: DocumentoVista['contesto'] = ambiti.size > 1 ? 'misto'
      : ambiti.size === 1 ? [...ambiti][0]
        : d.upload_ambito === 'azienda' ? 'ania' : 'mia'
    const pagine = fotoDiDocumento.get(d.id) ?? 0
    const dataDoc = d.document_date ?? spese.map(s => s.expense_date).sort().at(-1) ?? d.created_at.slice(0, 10)
    return {
      id: d.id,
      titolo: d.supplier ? `${d.kind === 'fattura' ? 'Fattura' : 'Scontrino'} ${d.supplier}`
        : `${d.kind === 'fattura' ? 'Fattura' : 'Scontrino'}${spese[0]?.store ? ` ${spese[0].store}` : ''}`,
      tipo: d.kind === 'fattura' ? 'fattura' : 'scontrino',
      contesto,
      stato: statoDocumento(d),
      importo: d.doc_total != null ? Number(d.doc_total) : (spese.length ? daCent(spese.reduce((x, s) => x + cent(s.amount), 0)) : undefined),
      giorno: etichettaGiorno(dataDoc, oggi),
      scade: d.due_date && d.status === 'approvata_da_pagare' ? etichettaGiorno(d.due_date, oggi) : undefined,
      pagine: pagine || undefined,
      senzaFoto: pagine === 0,
      motivo: d.error_message ?? undefined,
      dubbi: undefined,
    }
  })

  // ---- PANORAMICHE (mese di "oggi"; Speso = solo denaro uscito) ----
  const [annoOggi, meseOggi] = oggi.split('-').map(Number)
  const idMese = `${annoOggi}-${String(meseOggi).padStart(2, '0')}`
  const idMeseScorso = meseOggi === 1 ? `${annoOggi - 1}-12` : `${annoOggi}-${String(meseOggi - 1).padStart(2, '0')}`
  const nelMeseCorrente = (s: GrezzaSpesa) => s.expense_date.startsWith(idMese)
  const personali = t.spese.filter(s => ambitoDiSpesa(s) === 'mia')
  const aziendali = t.spese.filter(s => ambitoDiSpesa(s) === 'ania')
  const sommaCent = (liste: GrezzaSpesa[]) => liste.reduce((x, s) => x + cent(s.amount), 0)

  const mesePers = personali.filter(nelMeseCorrente)
  const scorsoPers = sommaCent(personali.filter(s => s.expense_date.startsWith(idMeseScorso)))
  const speseTeo = mesePers.filter(s => personaDiSpesa(s) === 'Teo')
  const categorieMese = new Map<string, number>()
  for (const s of mesePers) {
    const nome = (s.category_id ? categoriaDi.get(s.category_id) : undefined) ?? 'Altro'
    categorieMese.set(nome, (categorieMese.get(nome) ?? 0) + cent(s.amount))
  }
  const piccole = mesePers.filter(s => cent(s.amount) < 500)
  const docDaControllare = documenti.filter(x => x.stato === 'da_controllare')
  const mia: PanoramicaMiaVista = {
    mese: `${MESI[meseOggi - 1][0].toUpperCase()}${MESI[meseOggi - 1].slice(1)}`,
    speso: daCent(sommaCent(mesePers)),
    confrontoPct: scorsoPers > 0 ? Math.round((sommaCent(mesePers) - scorsoPers) / scorsoPers * 100) : null,
    daControllare: {
      n: docDaControllare.filter(x => x.contesto !== 'ania').length,
      tot: daCent(docDaControllare.filter(x => x.contesto !== 'ania').reduce((x, dd) => x + cent(dd.importo ?? 0), 0)),
    },
    budget: (t.budget ?? []).filter(b => b.ambito !== 'azienda').map(b => ({
      nome: b.category_name,
      speso: daCent(categorieMese.get(b.category_name) ?? 0),
      tetto: Number(b.monthly_amount),
    })),
    ripetute: piccole.length >= 3 ? {
      frase: `${piccole.length} piccole spese sotto i 5 €`,
      tot: daCent(sommaCent(piccole)),
      esempio: [...new Set(piccole.map(s => (s.product || s.description || '').toLowerCase()).filter(Boolean))].slice(0, 3).join(', ') || 'piccoli acquisti',
    } : null,
    categorie: [...categorieMese.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nome, tot]) => ({ nome, tot: daCent(tot) })),
    teo: speseTeo.length ? {
      tot: daCent(sommaCent(speseTeo)),
      voci: (() => {
        const perCat = new Map<string, number>()
        for (const s of speseTeo) {
          const nome = (s.category_id ? categoriaDi.get(s.category_id) : undefined) ?? 'Altro'
          perCat.set(nome, (perCat.get(nome) ?? 0) + cent(s.amount))
        }
        return [...perCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([n, v]) => [n, daCent(v)] as [string, number])
      })(),
    } : null,
  }

  const meseAz = aziendali.filter(nelMeseCorrente)
  const daPagare = t.documenti.filter(d => d.status === 'approvata_da_pagare')
  const giorniA = (isoData: string) => Math.round((Date.parse(isoData) - Date.parse(oggi)) / 86400000)
  const metodiMese = new Map<string, number>()
  for (const s of meseAz) metodiMese.set(s.payment_method || 'Non indicato', (metodiMese.get(s.payment_method || 'Non indicato') ?? 0) + cent(s.amount))
  const totMeseAz = sommaCent(meseAz)
  const perCamera = new Map<string, number>()
  for (const s of meseAz) perCamera.set(cameraDiSpesa(s) ?? 'Generale', (perCamera.get(cameraDiSpesa(s) ?? 'Generale') ?? 0) + cent(s.amount))
  const andamento: number[] = []
  for (let i = 5; i >= 0; i--) {
    const dRif = new Date(Date.UTC(annoOggi, meseOggi - 1 - i, 1))
    const id = `${dRif.getUTCFullYear()}-${String(dRif.getUTCMonth() + 1).padStart(2, '0')}`
    andamento.push(daCent(sommaCent(aziendali.filter(s => s.expense_date.startsWith(id)))))
  }
  const ania: PanoramicaAniaVista = {
    mese: mia.mese,
    speso: daCent(totMeseAz),
    impegnato: { tot: daCent(daPagare.reduce((x, d) => x + cent(d.doc_total ?? 0), 0)), n: daPagare.length },
    scadenze: daPagare.filter(d => d.due_date)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
      .slice(0, 5)
      .map(d => ({
        fornitore: d.supplier ?? 'Fattura', importo: Number(d.doc_total ?? 0),
        scade: etichettaGiorno(d.due_date!, oggi), giorni: giorniA(d.due_date!),
      })),
    fattureDaControllare: t.documenti.filter(d => d.kind === 'fattura' && d.status === 'in_revisione').length,
    metodi: totMeseAz > 0
      ? [...metodiMese.entries()].sort((a, b) => b[1] - a[1])
        .map(([nome, v]) => ({ nome, quota: Math.round(v / totMeseAz * 100) }))
      : [],
    costiCamere: [...perCamera.entries()].sort((a, b) => b[1] - a[1])
      .map(([nome, v]) => ({ nome, tot: daCent(v) })),
    andamento,
  }

  // ---- OPZIONI dei filtri, dai dati ----
  const anniPresenti = [...new Set(t.spese.map(s => Number(s.expense_date.slice(0, 4))))]
  const periodi = costruisciPeriodi(oggi, anniPresenti)
  const perAmbito = (c: Contesto): OpzioniFiltri => {
    const mov = movimenti.filter(m => m.contesto === c || m.contesto === 'misto')
    return {
      periodi,
      ...(c === 'mia' ? { persone: [...new Set(mov.flatMap(m => m.persone))].sort() } : {}),
      ...(c === 'ania' ? { camere: ['Generale', ...t.camere.map(x => x.name).filter(n => n !== 'Generale')] } : {}),
      categorie: [...new Set(mov.flatMap(m => m.categorie))].sort(),
      metodi: [...new Set(mov.flatMap(m => m.metodi))].sort(),
    }
  }

  return { mia, ania, movimenti, documenti, opzioni: { mia: perAmbito('mia'), ania: perAmbito('ania') } }
}
