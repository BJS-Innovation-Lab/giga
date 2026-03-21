'use client'

import { useState, useEffect, useMemo } from 'react'
import { Cita, getCitasHoy, getCitasByFecha } from '../../lib/supabase'

interface TodayAppointmentsProps {
  refreshTrigger: number
}

type ViewMode = 'today' | 'week'

export default function TodayAppointments({ refreshTrigger }: TodayAppointmentsProps) {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('today')
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekCitas, setWeekCitas] = useState<Record<string, Cita[]>>({})
  const [confirmAction, setConfirmAction] = useState<{ citaId: number, action: Cita['status'] } | null>(null)

  const loadCitas = async () => {
    try {
      setLoading(true)
      const data = await getCitasHoy()
      setCitas(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCitas()
  }, [refreshTrigger])

  // Load week view data
  const weekDays = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    const dayOfWeek = today.getDay()
    startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (weekOffset * 7))

    const days: { date: Date, dateStr: string, label: string, isToday: boolean }[] = []
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        label: `${dayLabels[i]} ${d.getDate()}`,
        isToday: d.toDateString() === today.toDateString()
      })
    }
    return days
  }, [weekOffset])

  useEffect(() => {
    if (viewMode !== 'week') return
    const loadWeek = async () => {
      const result: Record<string, Cita[]> = {}
      await Promise.all(
        weekDays.map(async (day) => {
          try {
            const data = await getCitasByFecha(day.dateStr)
            result[day.dateStr] = data
          } catch {
            result[day.dateStr] = []
          }
        })
      )
      setWeekCitas(result)
    }
    loadWeek()
  }, [viewMode, weekDays, refreshTrigger])

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getStatusColor = (status: Cita['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'completed':
        return 'bg-slate-100 text-slate-600 border-slate-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getStatusIcon = (status: Cita['status']) => {
    switch (status) {
      case 'scheduled':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'confirmed':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusText = (status: Cita['status']) => {
    switch (status) {
      case 'scheduled':
        return 'Programada'
      case 'confirmed':
        return 'Confirmada'
      case 'completed':
        return 'Completada'
      case 'cancelled':
        return 'Cancelada'
      default:
        return status
    }
  }

  const handleStatusChange = async (citaId: number, newStatus: Cita['status']) => {
    setConfirmAction(null)
    try {
      const response = await fetch('/api/citas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: citaId, status: newStatus })
      })

      if (response.ok) {
        loadCitas()
        // Refresh week view too
        if (viewMode === 'week') {
          setWeekCitas({})
        }
      } else {
        throw new Error('Error updating appointment status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const todayDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Status summary counts
  const statusCounts = useMemo(() => {
    const counts = { scheduled: 0, confirmed: 0, completed: 0, cancelled: 0 }
    citas.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++ })
    return counts
  }, [citas])

  const renderCitaCard = (cita: Cita) => (
    <div key={cita.id} className="p-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-sm font-medium text-slate-800">
              {formatTime(cita.hora_inicio)} - {formatTime(cita.hora_fin)}
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(cita.status)}`}>
              {getStatusIcon(cita.status)}
              {getStatusText(cita.status)}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">{cita.paciente_nombre}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-slate-500">
              <span>{cita.paciente_telefono}</span>
              <span className="hidden sm:inline">&middot;</span>
              <span>{cita.paciente_email}</span>
            </div>
            <p className="text-xs text-slate-500">
              {cita.especialidad} - {cita.sede.replace('SEDE ', '')}
            </p>
            {cita.notas && (
              <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 mt-2">
                {cita.notas}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 ml-4">
          {/* Confirm action dialog */}
          {confirmAction && confirmAction.citaId === cita.id && (
            <div className="absolute right-4 mt-8 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10">
              <p className="text-xs text-slate-600 mb-2">
                {confirmAction.action === 'cancelled' ? 'Cancelar esta cita?' : `Marcar como ${getStatusText(confirmAction.action)}?`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange(confirmAction.citaId, confirmAction.action)}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {cita.status === 'scheduled' && (
            <>
              <button
                onClick={() => setConfirmAction({ citaId: cita.id, action: 'confirmed' })}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                title="Confirmar cita"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmAction({ citaId: cita.id, action: 'cancelled' })}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="Cancelar cita"
              >
                Cancelar
              </button>
            </>
          )}

          {cita.status === 'confirmed' && (
            <>
              <button
                onClick={() => setConfirmAction({ citaId: cita.id, action: 'completed' })}
                className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                title="Marcar como completada"
              >
                Completar
              </button>
              <button
                onClick={() => setConfirmAction({ citaId: cita.id, action: 'scheduled' })}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Reagendar cita"
              >
                Reagendar
              </button>
              <button
                onClick={() => setConfirmAction({ citaId: cita.id, action: 'cancelled' })}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="Cancelar cita"
              >
                Cancelar
              </button>
            </>
          )}

          {cita.status === 'cancelled' && (
            <button
              onClick={() => setConfirmAction({ citaId: cita.id, action: 'scheduled' })}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Reagendar cita"
            >
              Reagendar
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Citas de Hoy</h3>
          <p className="text-xs text-slate-500 capitalize">{todayDate}</p>
        </div>
        <div className="p-6 text-center">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-slate-400">Cargando citas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Citas de Hoy</h3>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              {viewMode === 'today' ? 'Citas de Hoy' : 'Vista Semanal'}
            </h3>
            <p className="text-xs text-slate-500 capitalize">{todayDate}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status summary badges */}
            {viewMode === 'today' && citas.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                {statusCounts.scheduled > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
                    {statusCounts.scheduled} prog.
                  </span>
                )}
                {statusCounts.confirmed > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700">
                    {statusCounts.confirmed} conf.
                  </span>
                )}
                {statusCounts.completed > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600">
                    {statusCounts.completed} comp.
                  </span>
                )}
              </div>
            )}

            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('today')}
                className={`px-2 py-1 text-xs rounded ${viewMode === 'today' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}
              >
                Hoy
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2 py-1 text-xs rounded ${viewMode === 'week' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}
              >
                Semana
              </button>
            </div>

            <div className="text-xs text-slate-400">
              {citas.length} {citas.length === 1 ? 'cita' : 'citas'}
            </div>
          </div>
        </div>
      </div>

      {/* Today View */}
      {viewMode === 'today' && (
        <div className="divide-y divide-slate-50">
          {citas.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">No hay citas programadas para hoy</p>
            </div>
          ) : (
            citas.map(renderCitaCard)
          )}
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div>
          {/* Week navigation */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-1 text-slate-500 hover:text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-teal-600 hover:text-teal-700"
            >
              Esta semana
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-1 text-slate-500 hover:text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {weekDays.map(day => {
              const dayCitas = weekCitas[day.dateStr] || []
              return (
                <div key={day.dateStr} className={`${day.isToday ? 'bg-teal-50/30' : ''}`}>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className={`text-xs font-medium ${day.isToday ? 'text-teal-700' : 'text-slate-600'}`}>
                      {day.label}
                      {day.isToday && <span className="ml-1 text-[10px] text-teal-500">(hoy)</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {dayCitas.length > 0 ? `${dayCitas.length} cita${dayCitas.length > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                  {dayCitas.length > 0 && (
                    <div className="px-4 pb-2 space-y-1">
                      {dayCitas.map(cita => (
                        <div key={cita.id} className="flex items-center gap-2 text-xs py-1">
                          <span className="text-slate-500 w-20 flex-shrink-0">{formatTime(cita.hora_inicio)}</span>
                          <span className="font-medium text-slate-700 truncate">{cita.paciente_nombre}</span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border flex-shrink-0 ${getStatusColor(cita.status)}`}>
                            {getStatusIcon(cita.status)}
                            {getStatusText(cita.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
