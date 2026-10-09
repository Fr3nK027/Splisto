import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { resizeImage } from '../lib/image'
import { Thumb } from './ui'

const MAX = 10
/** Sotto questo lato lungo (px) una foto sui siti risulta sgranata (es. anteprime importate da 450x800 o 128x96). */
const SMALL = 1000
const sides = new WeakMap<Blob, number>() // lato lungo già misurato

/** Lato lungo di ogni foto (0 finché non è misurato). */
function useLongSides(photos: Blob[]): number[] {
  const [, redraw] = useState(0)
  useEffect(() => {
    let live = true
    void Promise.all(
      photos
        .filter((p) => !sides.has(p))
        .map(async (p) => {
          const b = await createImageBitmap(p).catch(() => null)
          sides.set(p, b ? Math.max(b.width, b.height) : 0)
          b?.close()
        }),
    ).then(() => live && redraw((n) => n + 1))
    return () => void (live = false)
  }, [photos])
  return photos.map((p) => sides.get(p) ?? 0)
}

export function Photos({ photos, onChange }: { photos: Blob[]; onChange: (p: Blob[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const long = useLongSides(photos)
  const small = long.filter((s) => s > 0 && s < SMALL).length

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

  /** Da tastiera: frecce sinistra/destra spostano la foto con il fuoco, che la segue nella nuova posizione. */
  function onKey(e: React.KeyboardEvent, i: number) {
    const to = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : -1
    if (to < 0 || to >= photos.length) return
    e.preventDefault()
    move(i, to)
    requestAnimationFrame(() => (grid.current?.children[to] as HTMLElement | undefined)?.focus())
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
      <div className="photo-grid" ref={grid}>
        {photos.map((p, i) => (
          <figure
            key={i}
            className={`photo ${dragFrom === i ? 'dragging' : ''}`}
            draggable
            tabIndex={0}
            aria-label={`Foto ${i + 1} di ${photos.length}${i === 0 ? ', copertina' : ''}. Frecce sinistra e destra per spostarla`}
            onKeyDown={(e) => onKey(e, i)}
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
            {long[i] > 0 && long[i] < SMALL && (
              <span className="photo-small" title={`Lato lungo ${long[i]} px: sui siti risulterà sgranata`}>
                Piccola
              </span>
            )}
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
        {photos.length}/{MAX} · trascina (o frecce ← →) per riordinare · ridimensionate in locale a 2048 px
      </p>
      {small > 0 && (
        <p className="hint warn-text">
          {small === 1 ? '1 foto è piccola' : `${small} foto sono piccole`} (meno di {SMALL} px): sui siti risultano sgranate. Caricane
          di migliori o, se l’annuncio è importato, usa “Riscarica foto dal sito”.
        </p>
      )}
    </section>
  )
}
