'use client'

import { useState, useEffect } from 'react'
import { Cita, getCitasHoy } from '../../lib/supabase'

interface TodayAppointmentsProps {
  refreshTrigger: number
}

export default function TodayAppointments({ refreshTrigger }: TodayAppointmentsProps) {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    try {
      const response = await fetch('/api/citas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: citaId, status: newStatus })
      })

      if (response.ok) {
        // Refresh the appointments list
        loadCitas()
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
            <h3 className="text-sm font-semibold text-slate-700">Citas de Hoy</h3>
            <p className="text-xs text-slate-500 capitalize">{todayDate}</p>
          </div>
          <div className="text-xs text-slate-400">
            {citas.length} {citas.length === 1 ? 'cita' : 'citas'}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {citas.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-400">No hay citas programadas para hoy</p>
          </div>
        ) : (
          citas.map((cita) => (
            <div key={cita.id} className="p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-sm font-medium text-slate-800">
                      {formatTime(cita.hora_inicio)} - {formatTime(cita.hora_fin)}
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(cita.status)}`}>
                      {getStatusText(cita.status)}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{cita.paciente_nombre}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-slate-500">
                      <span>{cita.paciente_telefono}</span>
                      <span className="hidden sm:inline">•</span>
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

                {cita.status === 'scheduled' && (
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => handleStatusChange(cita.id, 'confirmed')}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      title="Confirmar cita"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleStatusChange(cita.id, 'cancelled')}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      title="Cancelar cita"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {cita.status === 'confirmed' && (
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => handleStatusChange(cita.id, 'completed')}
                      className="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                      title="Marcar como completada"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => handleStatusChange(cita.id, 'cancelled')}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      title="Cancelar cita"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}