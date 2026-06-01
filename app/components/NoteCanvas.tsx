'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { upsertNoteBody, loadNoteBody } from '@/lib/db'

const PEN_COLORS = [
  { value: '#374151' }, { value: '#f43f5e' }, { value: '#8b5cf6' },
  { value: '#0ea5e9' }, { value: '#10b981' }, { value: '#f59e0b' },
]

type Props = { noteId: string }

export default function NoteCanvas({ noteId }: Props) {
  const STORAGE_KEY = `dam-note-canvas-${noteId}`
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [penColor, setPenColor] = useState('#374151')
  const [isEraser, setIsEraser] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [canvasHeight, setCanvasHeight] = useState(320)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isResizing = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartH = useRef(0)

  const save = useCallback((showFeedback = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    try { localStorage.setItem(STORAGE_KEY, dataUrl) } catch {}
    upsertNoteBody(noteId, '', dataUrl).catch(err =>
      console.error('[NoteCanvas] 저장 실패:', err)
    )
    if (showFeedback) {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setSavedAt(`${hh}:${mm}`)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSavedAt(null), 2500)
    }
  }, [STORAGE_KEY, noteId])

  const initCanvas = useCallback((dataUrl?: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    if (w === 0 || h === 0) return
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    const src = dataUrl ?? localStorage.getItem(STORAGE_KEY)
    if (src) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, w, h)
      img.src = src
    }
  }, [STORAGE_KEY])

  useEffect(() => {
    loadNoteBody(noteId).then(data => {
      if (data?.canvas_data) {
        requestAnimationFrame(() => initCanvas(data.canvas_data))
      } else {
        requestAnimationFrame(() => initCanvas())
      }
    })
  }, [noteId, initCanvas])

  // 높이 바뀔 때 캔버스 재초기화
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const snapshot = canvas.toDataURL('image/png')
    requestAnimationFrame(() => initCanvas(snapshot))
  }, [canvasHeight, initCanvas])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    lastPos.current = getPos(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor
    ctx.lineWidth = isEraser ? 20 : 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    lastPos.current = null
    save()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
    save()
  }

  // ── 리사이즈 핸들 ─────────────────────────────────────
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = true
    resizeStartY.current = e.clientY
    resizeStartH.current = canvasHeight
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return
    const delta = e.clientY - resizeStartY.current
    const newH = Math.max(160, Math.min(1200, resizeStartH.current + delta))
    setCanvasHeight(newH)
  }

  const endResize = () => {
    isResizing.current = false
  }

  return (
    <div ref={containerRef} className="rounded-2xl overflow-hidden ring-1 ring-black/10 shadow-sm">
      {/* 툴바 */}
      <div className="bg-slate-100 flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {PEN_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => { setPenColor(c.value); setIsEraser(false) }}
              className={`w-5 h-5 rounded-full transition-transform
                ${penColor === c.value && !isEraser
                  ? 'scale-125 ring-2 ring-offset-1 ring-slate-400'
                  : 'opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
        <div className="w-px h-4 bg-black/15 mx-0.5" />
        <button
          onClick={() => setIsEraser(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
            ${isEraser ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}
        >
          지우개
        </button>
        <button
          onClick={clearCanvas}
          className="text-xs px-2.5 py-1 rounded-lg text-slate-500 hover:bg-white/60 transition-colors"
        >
          전체 지우기
        </button>
        <div className="ml-auto flex items-center gap-2">
          {savedAt && (
            <span className="text-[11px] text-slate-400">{savedAt} 저장됨 ✓</span>
          )}
          <button
            onClick={() => save(true)}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-colors ring-1 ring-black/10"
          >
            저장
          </button>
        </div>
      </div>

      {/* 캔버스 */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${canvasHeight}px`,
          display: 'block',
          cursor: isEraser ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />

      {/* 리사이즈 핸들 */}
      <div
        onPointerDown={startResize}
        onPointerMove={onResize}
        onPointerUp={endResize}
        onPointerLeave={endResize}
        className="h-3 bg-slate-100 flex items-center justify-center cursor-ns-resize hover:bg-slate-200 transition-colors select-none"
      >
        <div className="w-8 h-1 rounded-full bg-slate-300" />
      </div>
    </div>
  )
}