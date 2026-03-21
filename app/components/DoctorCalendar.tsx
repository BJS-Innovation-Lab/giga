'use client'

import { Horario } from '../../lib/supabase'

const DAYS = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const DAYS_FULL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const SEDE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'SEDE NORTE': { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
  'SEDE SUR': { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700' },
  'SEDE ESTE': { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700' },
  'SEDE VIÑA': { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700' },
  'SEDE PUERTO CABELLO': { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-700' },
  'SEDE MARACAY': { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-700' },
  'SEDE PORLAMAR': { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700' },
}

function timeToMinutes(t: string | null): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime(t: string | null): string {
  if (!t) return '?'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return m > 0 ? `${hour}:${String(m).padStart(2, '0')} ${ampm}` : `${hour} ${ampm}`
}

interface Props {
  nombre: string
  especialidades: string[]
  horarios: Horario[]
  onClose: () => void
}

export default function DoctorCalendar({ nombre, especialidades, horarios, onClose }: Props) {
  const allTimes = horarios.filter(h => h.hora_inicio && h.hora_fin)
  const minHour = allTimes.length > 0 ? Math.min(...allTimes.map(h => Math.floor(timeToMinutes(h.hora_inicio) / 60))) : 7
  const maxHour = allTimes.length > 0 ? Math.max(...allTimes.map(h => Math.ceil(timeToMinutes(h.hora_fin) / 60))) : 18
  const startHour = Math.max(6, minHour - 1)
  const endHour = Math.min(22, maxHour + 1)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  const activeDays = Array.from(new Set(horarios.map(h => h.dia_semana))).sort()
  const displayDays = activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5]

  const sedes = Array.from(new Set(horarios.map(h => h.sede)))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{nombre}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{especialidades.join(' · ')}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors">&times;</button>
          </div>
        </div>

        {/* Sede legend */}
        {sedes.length > 1 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2">
            {sedes.map(sede => {
              const c = SEDE_COLORS[sede] || { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700' }
              return (
                <span key={sede} className={`text-[10px] px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium border ${c.border}`}>
                  {sede.replace('SEDE ', '')}
                </span>
              )
            })}
          </div>
        )}

        {/* Calendar grid */}
        <div className="overflow-auto p-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="min-w-[500px]">
            {/* Day headers */}
            <div className="grid gap-px bg-slate-200 rounded-t-lg overflow-hidden" style={{ gridTemplateColumns: `60px repeat(${displayDays.length}, 1fr)` }}>
              <div className="bg-slate-50 p-2"></div>
              {displayDays.map(d => (
                <div key={d} className="bg-slate-50 p-2 text-center">
                  <div className="font-semibold text-xs text-slate-600">{DAYS[d]}</div>
                  <div className="text-[10px] text-slate-400">{DAYS_FULL[d]}</div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="relative grid gap-px bg-slate-100 rounded-b-lg overflow-hidden" style={{ gridTemplateColumns: `60px repeat(${displayDays.length}, 1fr)` }}>
              {hours.map(hour => (
                <>
                  <div key={`label-${hour}`} className="bg-white p-1 text-right pr-2 border-b border-slate-50" style={{ height: '48px' }}>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </span>
                  </div>
                  {displayDays.map(day => {
                    const dayBlocks = horarios.filter(h => h.dia_semana === day && h.hora_inicio && h.hora_fin)
                    const blockHere = dayBlocks.find(h => {
                      const start = timeToMinutes(h.hora_inicio)
                      const end = timeToMinutes(h.hora_fin)
                      const hourStart = hour * 60
                      return start <= hourStart && end > hourStart
                    })
                    const isBlockStart = blockHere && Math.floor(timeToMinutes(blockHere.hora_inicio) / 60) === hour

                    if (blockHere && isBlockStart) {
                      const startMin = timeToMinutes(blockHere.hora_inicio)
                      const endMin = timeToMinutes(blockHere.hora_fin)
                      const durationHours = (endMin - startMin) / 60
                      const c = SEDE_COLORS[blockHere.sede] || { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700' }
                      const topOffset = ((startMin % 60) / 60) * 48

                      return (
                        <div key={`${day}-${hour}`} className="bg-white border-b border-slate-50 relative" style={{ height: '48px' }}>
                          <div
                            className={`absolute left-1 right-1 ${c.bg} ${c.text} border-l-2 ${c.border} rounded px-2 py-1 z-10 overflow-hidden`}
                            style={{ top: `${topOffset}px`, height: `${Math.max(durationHours * 48 - 2, 20)}px` }}
                          >
                            <p className="text-[10px] font-semibold truncate">{blockHere.sede.replace('SEDE ', '')}</p>
                            <p className="text-[9px] opacity-75 truncate">{formatTime(blockHere.hora_inicio)} – {formatTime(blockHere.hora_fin)}</p>
                            {durationHours > 1.5 && <p className="text-[9px] opacity-60 truncate">{blockHere.especialidad}</p>}
                          </div>
                        </div>
                      )
                    } else if (blockHere) {
                      return <div key={`${day}-${hour}`} className="bg-white border-b border-slate-50" style={{ height: '48px' }}></div>
                    }

                    return <div key={`${day}-${hour}`} className="bg-white border-b border-slate-50" style={{ height: '48px' }}></div>
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between font-medium">
          <span>{horarios.length} bloques · {sedes.length} sede{sedes.length > 1 ? 's' : ''}</span>
          <span>Calendario semanal</span>
        </div>
      </div>
    </div>
  )
}
