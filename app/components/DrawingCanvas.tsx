'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

const PEN_COLORS = [
  { value: '#374151', label: '검정' },
  { value: '#f43f5e', label: '빨강' },
  { value: '#8b5cf6', label: '보라' },
  { value: '#0ea5e9', label: '파랑' },
  { value: '#10b981', label: '초록' },
  { value: '#f59e0b', label: '노랑' },
]

const DRAFT_KEY = (dayKey: number) => `dam-canvas-draft-${dayKey}`

type Props = {
  dayKey: string
  headerBg: string
  onSave: (dataUrl: string) => void
  onClose: () => void
}

export default function DrawingCanvas({ dayKey, headerBg, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [penColor, setPenColor] = useState('#374151')
  const [isEraser, setIsEraser] = useState(false)

  const saveDraft = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      localStorage.setItem(DRAFT_KEY(dayKey), canvas.toDataURL('image/png'))
    } catch {}
  }, [dayKey])

  const initCanvas = useCallback(() => {
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

    // 임시 저장본 복원 (저장 전 작업 내용)
    const draft = localStorage.getItem(DRAFT_KEY(dayKey))
    if (draft) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, w, h)
      img.src = draft
    }
  }, [dayKey])

  useEffect(() => {
    requestAnimationFrame(initCanvas)
  }, [initCanvas])

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
    ctx.lineWidth = isEraser ? 18 : 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    lastPos.current = null
    saveDraft()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
    saveDraft()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    // 임시 저장본 제거 후 확정본 전달
    localStorage.removeItem(DRAFT_KEY(dayKey))
    onSave(dataUrl)
  }

  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-black/10 shadow-sm">
      {/* 툴바 */}
      <div className={`${headerBg} flex items-center gap-2 px-2 py-1.5`}>
        <div className="flex items-center gap-1">
          {PEN_COLORS.map(c => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => { setPenColor(c.value); setIsEraser(false) }}
              className={`w-4 h-4 rounded-full transition-transform
                ${penColor === c.value && !isEraser
                  ? 'scale-125 ring-2 ring-offset-1 ring-white/80'
                  : 'opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="w-px h-3.5 bg-black/15 mx-0.5" />

        <button
          onClick={() => setIsEraser(v => !v)}
          className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors
            ${isEraser ? 'bg-white/80 text-slate-700' : 'text-slate-500 hover:bg-white/40'}`}
        >
          지우개
        </button>

        <button
          onClick={clearCanvas}
          className="text-[11px] px-2 py-0.5 rounded-md text-slate-500 hover:bg-white/40 transition-colors"
        >
          전체 지우기
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            className="text-[11px] font-semibold px-3 py-0.5 rounded-md bg-white/80 text-slate-700 hover:bg-white transition-colors shadow-sm"
          >
            저장
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none transition-colors px-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* 캔버스 */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '160px',
          display: 'block',
          cursor: isEraser ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
    </div>
  )
}
