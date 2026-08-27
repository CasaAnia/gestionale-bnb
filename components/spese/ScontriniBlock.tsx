'use client'
import type { Receipt } from '@/lib/spese/types'

// Blocco "📷 Scontrini": scatta/libreria/file, anteprime da salvare, foto
// in attesa che Claude le legga. (Estratto da SpeseTracker.tsx in Fase 1:
// stesse classi, testi e comportamento.)
export default function ScontriniBlock({
  receipts, receiptUrls, staged, receiptNote, uploading, showForm,
  onStagePhotos, onRemoveStaged, onSaveStaged, onReceiptNote, onToggleForm, onEditNote, onDelete,
}: {
  receipts: Receipt[]
  receiptUrls: Record<string, string>
  staged: { file: File; url: string }[]
  receiptNote: string
  uploading: boolean
  showForm: boolean
  onStagePhotos: (files: FileList) => void
  onRemoveStaged: (i: number) => void
  onSaveStaged: () => void
  onReceiptNote: (value: string) => void
  onToggleForm: () => void
  onEditNote: (r: Receipt) => void
  onDelete: (r: Receipt) => void
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-card-border mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold">📷 Scontrini</p>
        {receipts.length > 0 && (
          <span className="text-xs bg-sand text-[#7A5C1E] px-2 py-0.5 rounded-full">{receipts.length} da leggere</span>
        )}
      </div>

      {/* 1. Bottone principale: apre direttamente la fotocamera */}
      {staged.length === 0 && (
        <>
          <label className="w-full flex items-center justify-center gap-2 bg-green-mid text-white rounded-2xl py-5 text-lg font-semibold cursor-pointer transition active:scale-[0.98]">
            📷 Scatta scontrino
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files; if (f && f.length) onStagePhotos(f); e.currentTarget.value = '' }} />
          </label>
          {/* Alternative usate di rado: piccole, sotto */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button onClick={onToggleForm}
              className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 transition active:scale-[0.97]">
              {showForm ? '✕ Chiudi' : '＋ Aggiungi'}
            </button>
            <label className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 text-center cursor-pointer transition active:scale-[0.97]">
              🖼️ Libreria
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const f = e.target.files; if (f && f.length) onStagePhotos(f); e.currentTarget.value = '' }} />
            </label>
            <label className="rounded-lg py-2 text-xs bg-[#FBF9F4] border border-card-border text-gray-600 text-center cursor-pointer transition active:scale-[0.97]">
              📁 File
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const f = e.target.files; if (f && f.length) onStagePhotos(f); e.currentTarget.value = '' }} />
            </label>
          </div>
        </>
      )}

      {/* 2. Anteprima + nota + Salva */}
      {staged.length > 0 && (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {staged.map((s, i) => (
              <div key={i} className="relative">
                <img src={s.url} alt="anteprima" className="w-full h-24 object-cover rounded-lg border border-card-border" />
                <button onClick={() => onRemoveStaged(i)}
                  className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center text-[#8C3B2E] text-sm shadow-sm">✕</button>
              </div>
            ))}
            <label className="h-24 flex flex-col items-center justify-center gap-1 border border-dashed border-card-border rounded-lg text-gray-400 text-xs cursor-pointer">
              <span className="text-xl">＋</span>altra foto
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const f = e.target.files; if (f && f.length) onStagePhotos(f); e.currentTarget.value = '' }} />
            </label>
          </div>
          <textarea value={receiptNote} onChange={e => onReceiptNote(e.target.value)} rows={2}
            placeholder="Nota:"
            className="w-full border border-card-border rounded-lg p-2 text-sm mb-2 resize-none" />
          <button onClick={onSaveStaged} disabled={uploading}
            className="w-full bg-green-mid text-white rounded-xl py-2.5 font-semibold disabled:opacity-50">
            {uploading ? 'Salvataggio…' : `💾 Salva ${staged.length > 1 ? staged.length + ' scontrini' : 'scontrino'}`}
          </button>
        </div>
      )}

      {receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {receipts.map(r => (
            <div key={r.id} className="relative">
              {receiptUrls[r.id]
                ? <img src={receiptUrls[r.id]} alt="scontrino" onClick={() => window.open(receiptUrls[r.id], '_blank')}
                    className="w-full h-24 object-cover rounded-lg border border-card-border cursor-pointer" />
                : <div className="w-full h-24 rounded-lg bg-sand flex items-center justify-center text-2xl">🧾</div>}
              <button onClick={() => onEditNote(r)} className="block w-full text-left text-[10px] text-gray-500 mt-0.5 truncate">
                {r.note ? r.note : <span className="text-brass">✏️ aggiungi nota</span>}
              </button>
              <button onClick={() => onDelete(r)}
                className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center text-[#8C3B2E] text-sm shadow-sm">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
