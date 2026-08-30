'use client'
// ============================================================================
// INSERIMENTO MANUALE (3.2B) — il ＋ → "Spesa manuale" apre questo foglio.
// Scrive nello schema attuale (spesa senza documento) rispettando le
// decisioni approvate: gruppo/categoria/sottocategoria separate, metodo di
// pagamento OBBLIGATORIO per Casa Ania, camera facoltativa, expense_nature
// (il vecchio recurring resta sola lettura storica). Le regole-prodotto
// del vecchio modulo continuano a proporre il gruppo giusto.
// Un errore NON chiude il foglio e NON cancella quello che hai scritto.
// ============================================================================
import { useMemo, useState } from 'react'
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import type { Ambito, Category, Group, Rule, Subcat } from '@/lib/spese/types'
import { strip } from '@/lib/spese/costanti'
import {
  SPESA_MANUALE_VUOTA, validaSpesaManuale,
  type EsitoScrittura, type SpesaManualeInput,
} from '@/lib/spese/scrittura'

const METODI: [string, string][] = [
  ['contanti', 'Contanti'], ['carta_personale', 'Carta personale'],
  ['carta_attivita', 'Carta attività'], ['bonifico', 'Bonifico'], ['altro', 'Altro'],
]
const NATURE: [string, string][] = [
  ['', 'Normale'], ['ricorrente', 'Ricorrente'], ['straordinaria', 'Straordinaria'],
]

function Campo({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <Etichetta>{nome}</Etichetta>
      {children}
    </div>
  )
}
const stileCampo = {
  background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro,
}

export function ModuloSpesa({ ambito, oggi, groups, cats, subcats, camere, negozi, regole, salva, chiudi }: {
  ambito: Ambito
  oggi: string
  groups: Group[]                 // già filtrati per ambito
  cats: Category[]                // idem
  subcats: Subcat[]
  camere: { id: string; name: string }[]   // solo attive
  negozi: string[]
  regole: Rule[]
  salva: (input: SpesaManualeInput) => Promise<EsitoScrittura>
  chiudi: () => void
}) {
  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const [form, setForm] = useState<SpesaManualeInput>({
    ...SPESA_MANUALE_VUOTA(oggi),
    // un solo gruppo (caso azienda): assegnato da subito
    group_id: groups.length === 1 ? groups[0].id : '',
  })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [fatto, setFatto] = useState(false)
  const [gruppoProposto, setGruppoProposto] = useState<string | null>(null)

  const su = (k: keyof SpesaManualeInput) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const catsDelGruppo = useMemo(() => cats.filter(c => c.group_id === form.group_id), [cats, form.group_id])
  const nomeCat = cats.find(c => c.id === form.category_id)?.name
  const sottoDellaCat = useMemo(() => subcats.filter(sc => sc.category_name === nomeCat), [subcats, nomeCat])

  // le regole-prodotto del vecchio modulo: propongono il gruppo giusto
  const applicaRegole = (testo: string) => {
    const puliti = strip(testo)
    for (const r of regole) {
      if (r.group_id && puliti.includes(strip(r.keyword))) {
        setForm(f => ({ ...f, group_id: r.group_id!, category_id: '' }))
        setGruppoProposto(groups.find(g => g.id === r.group_id)?.name ?? null)
        return
      }
    }
    setGruppoProposto(null)
  }

  const invia = async () => {
    if (salvando) return                      // doppio clic: il secondo non parte
    setErrore(null)
    const problemi = validaSpesaManuale(form, ambito)
    if (problemi.length) { setErrore(problemi.join(' · ')); return }
    setSalvando(true)
    const esito = await salva(form)
    setSalvando(false)
    if (!esito.ok) { setErrore(esito.errore); return }   // il foglio resta aperto, i valori intatti
    setFatto(true)
    setTimeout(chiudi, 900)
  }

  return (
    <Foglio aria="Spesa manuale" chiudi={chiudi} scorrevole
      piede={
        <button onClick={invia} disabled={salvando || fatto}
          className="w-full min-h-12 text-[15px] font-bold text-white disabled:opacity-60"
          style={{ background: fatto ? t.verde : accento, borderRadius: t.rPill }}>
          {fatto ? '✓ Salvata' : salvando ? 'Salvo…' : `Salva la spesa ${ambito === 'azienda' ? 'di Casa Ania' : ''}`}
        </button>
      }>
      <p className={`${DISPLAY} text-[19px] mb-3`} style={{ color: t.inchiostro }}>
        Spesa manuale <span className="font-semibold text-[13px]" style={{ color: t.sub }}>
          · senza documento</span>
      </p>

      {errore && (
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>
          {errore}
        </div>
      )}

      <div className="flex gap-2">
        <Campo nome="Data">
          <input type="date" value={form.expense_date} onChange={e => su('expense_date')(e.target.value)}
            className="min-h-11 px-3 text-[14px] outline-none w-full" style={stileCampo} />
        </Campo>
        <Campo nome="Importo (€)">
          <input inputMode="decimal" placeholder="0,00" value={form.importo}
            onChange={e => su('importo')(e.target.value)}
            className="min-h-11 px-3 text-[15px] font-bold outline-none w-full tabular-nums" style={stileCampo} />
        </Campo>
      </div>

      {groups.length > 1 && (
        <Campo nome="Di chi">
          <div className="flex gap-1.5 flex-wrap">
            {groups.map(g => (
              <Chip key={g.id} attivo={form.group_id === g.id} colore={accento}
                onClick={() => setForm(f => ({ ...f, group_id: g.id, category_id: '', subcategory: '' }))}>
                {g.name === 'Matteo' ? 'Teo' : g.name === 'Matteo e Ania' ? 'M e A' : g.name}
              </Chip>
            ))}
          </div>
          {gruppoProposto && <p className="text-[11.5px] mt-1" style={{ color: t.sub }}>proposto dalla regola prodotto: {gruppoProposto}</p>}
        </Campo>
      )}

      <Campo nome="Categoria">
        <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value, subcategory: '' }))}
          className="min-h-11 px-3 text-[14px] outline-none w-full" style={stileCampo}>
          <option value="">— nessuna —</option>
          {catsDelGruppo.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Campo>
      {sottoDellaCat.length > 0 && (
        <Campo nome="Sottocategoria">
          <select value={form.subcategory} onChange={e => su('subcategory')(e.target.value)}
            className="min-h-11 px-3 text-[14px] outline-none w-full" style={stileCampo}>
            <option value="">— nessuna —</option>
            {sottoDellaCat.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
          </select>
        </Campo>
      )}

      <Campo nome="Negozio">
        <input list="negozi-noti" value={form.store} onChange={e => su('store')(e.target.value)}
          placeholder="Esselunga, Iper…" className="min-h-11 px-3 text-[14px] outline-none w-full" style={stileCampo} />
        <datalist id="negozi-noti">{negozi.map(n => <option key={n} value={n} />)}</datalist>
      </Campo>
      <Campo nome="Prodotto / descrizione">
        <input value={form.description}
          onChange={e => { su('description')(e.target.value); applicaRegole(e.target.value) }}
          placeholder="cosa avete comprato" className="min-h-11 px-3 text-[14px] outline-none w-full" style={stileCampo} />
      </Campo>

      <Campo nome={ambito === 'azienda' ? 'Metodo di pagamento (obbligatorio)' : 'Metodo di pagamento'}>
        <div className="flex gap-1.5 flex-wrap">
          {METODI.map(([valore, nome]) => (
            <Chip key={valore} attivo={form.payment_method === valore} colore={accento}
              onClick={() => su('payment_method')(form.payment_method === valore && ambito !== 'azienda' ? '' : valore)}>
              {nome}
            </Chip>
          ))}
        </div>
      </Campo>

      {ambito === 'azienda' && camere.length > 0 && (
        <Campo nome="Camera (facoltativa)">
          <div className="flex gap-1.5 flex-wrap">
            <Chip attivo={!form.room_id} colore={accento} onClick={() => su('room_id')('')}>Generale</Chip>
            {camere.map(c => (
              <Chip key={c.id} attivo={form.room_id === c.id} colore={accento} onClick={() => su('room_id')(c.id)}>{c.name}</Chip>
            ))}
          </div>
        </Campo>
      )}

      <Campo nome="Natura della spesa">
        <div className="flex gap-1.5 flex-wrap">
          {NATURE.map(([valore, nome]) => (
            <Chip key={nome} attivo={form.expense_nature === valore} colore={accento}
              onClick={() => su('expense_nature')(valore)}>{nome}</Chip>
          ))}
        </div>
      </Campo>
    </Foglio>
  )
}
