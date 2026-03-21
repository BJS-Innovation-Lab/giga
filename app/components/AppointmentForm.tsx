'use client'

import { useState, useEffect, useMemo } from 'react'
import { Medico, Horario, getMedicos, getHorariosByMedico, getCitasByMedicoFecha } from '../../lib/supabase'

interface TimeSlot {
  hora_inicio: string
  hora_fin: string
  available: boolean
}

interface AppointmentFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AppointmentForm({ isOpen, onClose, onSuccess }: AppointmentFormProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [medicos, setMedicos] = useState<Medico[]>([])
  
  // Form data
  const [selectedMedico, setSelectedMedico] = useState<Medico | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null)
  const [patientData, setPatientData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    notas: ''
  })
  
  // Available time slots
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [existingCitas, setExistingCitas] = useState<any[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  useEffect(() => {
    if (isOpen) {
      getMedicos().then(setMedicos)
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedMedico) {
      getHorariosByMedico(selectedMedico.id).then(setHorarios)
    }
  }, [selectedMedico])

  useEffect(() => {
    if (selectedMedico && selectedDate) {
      // Get existing appointments for this doctor on this date
      getCitasByMedicoFecha(selectedMedico.id, selectedDate).then(setExistingCitas)
    }
  }, [selectedMedico, selectedDate])

  // Generate available time slots
  useEffect(() => {
    if (horarios.length === 0 || !selectedDate) {
      setTimeSlots([])
      return
    }

    const dayOfWeek = new Date(selectedDate).getDay()
    const dayHorarios = horarios.filter(h => h.dia_semana === dayOfWeek && h.hora_inicio && h.hora_fin)
    
    if (dayHorarios.length === 0) {
      setTimeSlots([])
      return
    }

    const slots: TimeSlot[] = []
    
    dayHorarios.forEach(horario => {
      if (!horario.hora_inicio || !horario.hora_fin) return
      
      const startTime = horario.hora_inicio
      const endTime = horario.hora_fin
      
      // Generate 30-minute slots
      let current = startTime
      while (current < endTime) {
        const nextSlot = addMinutes(current, 30)
        if (nextSlot <= endTime) {
          const isOccupied = existingCitas.some(cita => 
            cita.hora_inicio <= current && cita.hora_fin > current
          )
          
          slots.push({
            hora_inicio: current,
            hora_fin: nextSlot,
            available: !isOccupied
          })
        }
        current = nextSlot
      }
    })

    setTimeSlots(slots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)))
  }, [horarios, selectedDate, existingCitas])

  const addMinutes = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + mins + minutes
    const newHours = Math.floor(totalMinutes / 60) % 24
    const newMins = totalMinutes % 60
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const handleSubmit = async () => {
    if (!selectedMedico || !selectedTimeSlot || !patientData.nombre || !patientData.telefono || !patientData.email) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_nombre: patientData.nombre,
          paciente_telefono: patientData.telefono,
          paciente_email: patientData.email,
          medico_id: selectedMedico.id,
          sede: 'SEDE NORTE', // Default sede - could be made dynamic
          especialidad: selectedMedico.especialidades[0] || 'GENERAL',
          fecha: selectedDate,
          hora_inicio: selectedTimeSlot.hora_inicio,
          hora_fin: selectedTimeSlot.hora_fin,
          notas: patientData.notas
        })
      })

      if (response.ok) {
        onSuccess()
        handleClose()
      } else {
        throw new Error('Error creating appointment')
      }
    } catch (error) {
      console.error('Error creating appointment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setSelectedMedico(null)
    setSelectedDate('')
    setSelectedTimeSlot(null)
    setPatientData({ nombre: '', telefono: '', email: '', notas: '' })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Nueva Cita</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center mt-4">
            {[1, 2, 3].map(num => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                  step >= num 
                    ? 'bg-teal-600 border-teal-600 text-white' 
                    : 'border-slate-300 text-slate-400'
                }`}>
                  {num}
                </div>
                {num < 3 && (
                  <div className={`w-12 h-0.5 mx-2 ${step > num ? 'bg-teal-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Seleccionar Médico y Fecha</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Médico</label>
                    <select
                      value={selectedMedico?.id || ''}
                      onChange={e => {
                        const medico = medicos.find(m => m.id === parseInt(e.target.value))
                        setSelectedMedico(medico || null)
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    >
                      <option value="">Seleccionar médico...</option>
                      {medicos.map(medico => (
                        <option key={medico.id} value={medico.id}>
                          {medico.nombre} - {medico.especialidades.join(', ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Fecha</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      min={getMinDate()}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedMedico || !selectedDate}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Seleccionar Horario</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {selectedMedico?.nombre} - {new Date(selectedDate).toLocaleDateString()}
                </p>

                {timeSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No hay horarios disponibles para esta fecha</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedTimeSlot(slot)}
                        disabled={!slot.available}
                        className={`p-3 text-sm rounded-md border transition-all ${
                          selectedTimeSlot === slot
                            ? 'bg-teal-600 text-white border-teal-600'
                            : slot.available
                            ? 'border-slate-300 hover:bg-slate-50 text-slate-700'
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {formatTime(slot.hora_inicio)}
                        <br />
                        <span className="text-xs opacity-75">
                          {formatTime(slot.hora_fin)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTimeSlot}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Información del Paciente</h3>
                
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{selectedMedico?.nombre}</span><br />
                    {new Date(selectedDate).toLocaleDateString()} - {selectedTimeSlot && formatTime(selectedTimeSlot.hora_inicio)} a {selectedTimeSlot && formatTime(selectedTimeSlot.hora_fin)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Nombre completo</label>
                    <input
                      type="text"
                      value={patientData.nombre}
                      onChange={e => setPatientData(prev => ({ ...prev, nombre: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="Nombre del paciente"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={patientData.telefono}
                      onChange={e => setPatientData(prev => ({ ...prev, telefono: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="Número de teléfono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Email</label>
                    <input
                      type="email"
                      value={patientData.email}
                      onChange={e => setPatientData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Notas (opcional)</label>
                    <textarea
                      value={patientData.notas}
                      onChange={e => setPatientData(prev => ({ ...prev, notas: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="Motivo de la consulta o información adicional..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !patientData.nombre || !patientData.telefono || !patientData.email}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando...' : 'Confirmar Cita'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}