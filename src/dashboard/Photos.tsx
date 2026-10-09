import { ImagePlus, X } from 'lucide-react'
import { useState } from 'react'
import { resizeImage } from '../lib/image'
import { Thumb } from './ui'

const MAX = 10

export function Photos({ photos, onChange }: { photos: Blob[]; onChange: (p: Blob[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState(false)

  async function add(files: FileList | File[]) {
    const imgs = [...files].filter((f) => f.type.startsWith('image/')).slice(0, MAX - photos.length)
    if (!imgs.length) return
    setBusy(true)
    try {
      onChange([...photos, ...(await Promise.all(imgs.map((f) => resizeImage(f))))])
    } finally {
      setBusy(false)
    }
  }

  function move(from: number, to: number) {
    const next = [...photos]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }

  const isFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  return (
    <section
      className={`photos ${over ? 'drop-over' : ''}`}
      onDragOver={(e) => {
        if (!isFiles(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!isFiles(e)) return
        e.preventDefault()
        setOver(false)
        void add(e.dataTransfer.files)
      }}
    >
      <div className="photo-grid">
        {photos.map((p, i) => (
          <figure
            key={i}
            className={`photo ${dragFrom === i ? 'dragging' : ''}`}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => dragFrom !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragFrom === null) return
              e.preventDefault()
              e.stopPropagation()
              move(dragFrom, i)
              setDragFrom(null)
            }}
          >
            <Thumb blob={p} className="photo-img" />
            {i === 0 && <figcaption>Copertina</figcaption>}
            <button
              className="photo-remove"
              aria-label={`Rimuovi foto ${i + 1}`}
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
            >
              <X size={14} />
            </button>
          </figure>
        ))}
        {photos.length < MAX && (
          <label className="photo-add">
            <ImagePlus size={20} aria-hidden="true" />
            <span>{busy ? 'Elaboro…' : photos.length ? 'Aggiungi' : 'Trascina qui le foto o clicca'}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) void add(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      <p className="hint">
        {photos.length}/{MAX} · trascina per riordinare · ridimensionate in locale a 1600 px
      </p>
    </section>
  )
}
