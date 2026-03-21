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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

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

  // Week view state
  const [weekViewDate, setWeekViewDate] = useState<Date | null>(null)

  useEffect(() => {
    if (isOpen) {
      getMedicos().then(setMedicos)
      setSubmitError(null)
      setSubmitSuccess(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedMedico) {
      getHorariosByMedico(selectedMedico.id).then(setHorarios)
    }
  }, [selectedMedico])

  useEffect(() => {
    if (selectedMedico && selectedDate) {
      getCitasByMedicoFecha(selectedMedico.id, selectedDate).then(setExistingCitas)
    }
  }, [selectedMedico, selectedDate])

  // Generate available time slots
  useEffect(() => {
    if (horarios.length === 0 || !selectedDate) {
      setTimeSlots([])
      return
    }

    const dateObj = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = dateObj.getDay()
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

  // Week view data
  const weekViewData = useMemo(() => {
    if (!selectedMedico || !weekViewDate) return null

    const startOfWeek = new Date(weekViewDate)
    const dayOfWeek = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    const days: { date: Date, dayNum: number, label: string, hasSchedule: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      const dn = d.getDay()
      const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const hasSchedule = horarios.some(h => h.dia_semana === dn)
      days.push({
        date: d,
        dayNum: dn,
        label: `${dayLabels[dn]} ${d.getDate()}/${d.getMonth() + 1}`,
        hasSchedule
      })
    }
    return days
  }, [selectedMedico, weekViewDate, horarios])

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

  const formatDateLong = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const handleSubmit = async () => {
    if (!selectedMedico || !selectedTimeSlot || !patientData.nombre || !patientData.telefono || !patientData.email) {
      return
    }

    setLoading(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_nombre: patientData.nombre,
          paciente_telefono: patientData.telefono,
          paciente_email: patientData.email,
          medico_id: selectedMedico.id,
          sede: 'SEDE NORTE',
          especialidad: selectedMedico.especialidades[0] || 'GENERAL',
          fecha: selectedDate,
          hora_inicio: selectedTimeSlot.hora_inicio,
          hora_fin: selectedTimeSlot.hora_fin,
          notas: patientData.notas
        })
      })

      if (response.ok) {
        setSubmitSuccess(true)
        onSuccess()
      } else {
        throw new Error('Error creating appointment')
      }
    } catch (error) {
      setSubmitError('No se pudo crear la cita. Por favor intente de nuevo.')
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
    setSubmitError(null)
    setSubmitSuccess(false)
    setWeekViewDate(null)
    onClose()
  }

  if (!isOpen) return null

  const totalSteps = 4

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              {submitSuccess ? 'Cita Creada' : 'Nueva Cita'}
            </h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress indicator */}
          {!submitSuccess && (
            <div className="flex items-center mt-4">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                    step >= num
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'border-slate-300 text-slate-400'
                  }`}>
                    {num}
                  </div>
                  {num < totalSteps && (
                    <div className={`w-8 h-0.5 mx-1 ${step > num ? 'bg-teal-600' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
              <span className="ml-3 text-xs text-slate-400">
                {step === 1 && 'Médico y fecha'}
                {step === 2 && 'Horario'}
                {step === 3 && 'Datos del paciente'}
                {step === 4 && 'Confirmación'}
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Success State */}
          {submitSuccess && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Cita agendada exitosamente</h3>
              <div className="bg-slate-50 rounded-lg p-4 text-left max-w-sm mx-auto space-y-2">
                <p className="text-sm text-slate-600"><span className="font-medium">Paciente:</span> {patientData.nombre}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Médico:</span> {selectedMedico?.nombre}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Fecha:</span> {formatDateLong(selectedDate)}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Hora:</span> {selectedTimeSlot && formatTime(selectedTimeSlot.hora_inicio)} - {selectedTimeSlot && formatTime(selectedTimeSlot.hora_fin)}</p>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Step 1: Doctor + Date */}
          {!submitSuccess && step === 1 && (
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
                        if (medico) setWeekViewDate(new Date())
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

                  {/* Week View Calendar */}
                  {selectedMedico && weekViewDate && weekViewData && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => {
                            const d = new Date(weekViewDate)
                            d.setDate(d.getDate() - 7)
                            setWeekViewDate(d)
                          }}
                          className="p-1 text-slate-500 hover:text-slate-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-sm font-medium text-slate-700">Disponibilidad semanal</span>
                        <button
                          onClick={() => {
                            const d = new Date(weekViewDate)
                            d.setDate(d.getDate() + 7)
                            setWeekViewDate(d)
                          }}
                          className="p-1 text-slate-500 hover:text-slate-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {weekViewData.map((day, idx) => {
                          const dateStr = day.date.toISOString().split('T')[0]
                          const isSelected = selectedDate === dateStr
                          const isPast = day.date < new Date(new Date().setHours(0, 0, 0, 0))
                          const isToday = day.date.toDateString() === new Date().toDateString()
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!isPast && day.hasSchedule) setSelectedDate(dateStr)
                              }}
                              disabled={isPast || !day.hasSchedule}
                              className={`p-2 rounded text-center text-xs transition-all ${
                                isSelected
                                  ? 'bg-teal-600 text-white'
                                  : isPast || !day.hasSchedule
                                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : isToday
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              <div className="font-medium">{day.label.split(' ')[0]}</div>
                              <div className="text-[10px] mt-0.5">{day.label.split(' ')[1]}</div>
                              {day.hasSchedule && !isPast && (
                                <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isSelected ? 'bg-white' : 'bg-green-400'}`} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

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

          {/* Step 2: Time Slot */}
          {!submitSuccess && step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Seleccionar Horario</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {selectedMedico?.nombre} - {formatDateLong(selectedDate)}
                </p>

                {timeSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500">No hay horarios disponibles para esta fecha</p>
                    <button
                      onClick={() => setStep(1)}
                      className="mt-3 text-sm text-teal-600 hover:text-teal-700 underline"
                    >
                      Elegir otra fecha
                    </button>
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
                            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed line-through'
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

          {/* Step 3: Patient Info */}
          {!submitSuccess && step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Información del Paciente</h3>

                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{selectedMedico?.nombre}</span><br />
                    {formatDateLong(selectedDate)} - {selectedTimeSlot && formatTime(selectedTimeSlot.hora_inicio)} a {selectedTimeSlot && formatTime(selectedTimeSlot.hora_fin)}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Nombre completo *</label>
                    <input
                      type="text"
                      value={patientData.nombre}
                      onChange={e => setPatientData(prev => ({ ...prev, nombre: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="Nombre del paciente"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Teléfono *</label>
                    <input
                      type="tel"
                      value={patientData.telefono}
                      onChange={e => setPatientData(prev => ({ ...prev, telefono: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      placeholder="Número de teléfono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Email *</label>
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
                  onClick={() => setStep(4)}
                  disabled={!patientData.nombre || !patientData.telefono || !patientData.email}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Revisar y Confirmar
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation Summary */}
          {!submitSuccess && step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-4">Confirmar Cita</h3>
                <p className="text-xs text-slate-500 mb-4">Revisa los datos antes de confirmar la cita</p>

                <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                  {/* Doctor & Schedule */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Médico</span>
                      <button onClick={() => setStep(1)} className="text-xs text-teal-600 hover:text-teal-700">Cambiar</button>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{selectedMedico?.nombre}</p>
                    <p className="text-sm text-slate-600">{selectedMedico?.especialidades.join(', ')}</p>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha y Hora</span>
                      <button onClick={() => setStep(2)} className="text-xs text-teal-600 hover:text-teal-700">Cambiar</button>
                    </div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{formatDateLong(selectedDate)}</p>
                    <p className="text-sm text-slate-600">
                      {selectedTimeSlot && formatTime(selectedTimeSlot.hora_inicio)} - {selectedTimeSlot && formatTime(selectedTimeSlot.hora_fin)}
                    </p>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Paciente</span>
                      <button onClick={() => setStep(3)} className="text-xs text-teal-600 hover:text-teal-700">Cambiar</button>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{patientData.nombre}</p>
                    <p className="text-sm text-slate-600">{patientData.telefono}</p>
                    <p className="text-sm text-slate-600">{patientData.email}</p>
                    {patientData.notas && (
                      <p className="text-sm text-slate-500 italic">Notas: {patientData.notas}</p>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{submitError}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
