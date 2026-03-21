'use client'

import { useState, useEffect, useMemo } from 'react'
import { getMedicos, getHorarios, Medico, Horario } from '../../lib/supabase'
import AppointmentForm from './AppointmentForm'

interface SearchResult {
  medico: Medico
  horarios: Horario[]
  matchedHorarios: Horario[]
  sede: string
  especialidad: string
}

interface SmartSearchProps {
  onResultsChange?: (results: SearchResult[]) => void
}

export default function SmartSearch({ onResultsChange }: SmartSearchProps) {
  const [query, setQuery] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  useEffect(() => {
    Promise.all([getMedicos(), getHorarios()])
      .then(([meds, hors]) => {
        setMedicos(meds)
        setHorarios(hors)
      })
      .catch(console.error)
  }, [])

  // Natural language parsing functions
  const parseSpecialties = (text: string): string[] => {
    const specialtyMap: Record<string, string[]> = {
      'traumatólogo': ['traumatología', 'traumatólogo', 'ortopedia', 'fracturas'],
      'cardiólogo': ['cardiología', 'cardiólogo', 'corazón', 'cardiovascular'],
      'pediatra': ['pediatría', 'pediatra', 'niños', 'infantil'],
      'ginecólogo': ['ginecología', 'ginecólogo', 'mujeres', 'femenino'],
      'dermatólogo': ['dermatología', 'dermatólogo', 'piel', 'dermato'],
      'neurólogo': ['neurología', 'neurólogo', 'cerebro', 'neurológico'],
      'oftalmólogo': ['oftalmología', 'oftalmólogo', 'ojos', 'vista'],
      'otorrinolaringólogo': ['otorrinolaringología', 'otorrino', 'oido', 'nariz', 'garganta'],
      'psicólogo': ['psicología', 'psicólogo', 'mental', 'terapia'],
      'psiquiatra': ['psiquiatría', 'psiquiatra', 'psiquiátrico'],
      'urólogo': ['urología', 'urólogo', 'riñones', 'vías urinarias'],
      'endocrinólogo': ['endocrinología', 'endocrinólogo', 'hormonas', 'diabetes'],
      'gastroenterólogo': ['gastroenterología', 'gastroenterólogo', 'estómago', 'digestivo'],
      'neumólogo': ['neumología', 'neumólogo', 'pulmones', 'respiratorio'],
      'reumatólogo': ['reumatología', 'reumatólogo', 'artritis', 'reumático']
    }

    const found: string[] = []
    const normalizedText = text.toLowerCase()

    for (const [specialty, keywords] of Object.entries(specialtyMap)) {
      if (keywords.some(keyword => normalizedText.includes(keyword))) {
        found.push(specialty)
      }
    }

    return found
  }

  const parseWeekdays = (text: string): number[] => {
    const dayMap: Record<string, number> = {
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'miercoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábado': 6,
      'sabado': 6,
      'domingo': 7
    }

    const today = new Date().getDay()
    const tomorrow = today === 0 ? 1 : (today % 7) + 1

    const found: number[] = []
    const normalizedText = text.toLowerCase()

    // Check for specific days
    for (const [day, dayNum] of Object.entries(dayMap)) {
      if (normalizedText.includes(day)) {
        found.push(dayNum)
      }
    }

    // Check for relative days
    if (normalizedText.includes('hoy')) {
      found.push(today === 0 ? 7 : today) // Convert Sunday from 0 to 7
    }
    if (normalizedText.includes('mañana')) {
      found.push(tomorrow)
    }

    return found
  }

  const parseTimeOfDay = (text: string): { start?: number, end?: number } => {
    const normalizedText = text.toLowerCase()
    
    if (normalizedText.includes('mañana') || normalizedText.includes('morning')) {
      return { end: 12 }
    }
    if (normalizedText.includes('tarde') || normalizedText.includes('afternoon')) {
      return { start: 12, end: 18 }
    }
    if (normalizedText.includes('noche') || normalizedText.includes('night')) {
      return { start: 18 }
    }

    return {}
  }

  const parseLocations = (text: string): string[] => {
    const locationMap: Record<string, string[]> = {
      'SEDE NORTE': ['norte', 'north'],
      'SEDE SUR': ['sur', 'south'],
      'SEDE ESTE': ['este', 'east'],
      'SEDE VIÑA': ['viña', 'vina'],
      'SEDE MARACAY': ['maracay'],
      'SEDE PORLAMAR': ['porlamar'],
      'SEDE PUERTO CABELLO': ['puerto cabello', 'puerto', 'cabello']
    }

    const found: string[] = []
    const normalizedText = text.toLowerCase()

    for (const [sede, keywords] of Object.entries(locationMap)) {
      if (keywords.some(keyword => normalizedText.includes(keyword))) {
        found.push(sede)
      }
    }

    return found
  }

  // Time filtering helper
  const filterByTimeOfDay = (horario: Horario, timeFilter: { start?: number, end?: number }): boolean => {
    if (!horario.hora_inicio || (!timeFilter.start && !timeFilter.end)) return true
    
    const startHour = parseInt(horario.hora_inicio.split(':')[0])
    
    if (timeFilter.start && startHour < timeFilter.start) return false
    if (timeFilter.end && startHour >= timeFilter.end) return false
    
    return true
  }

  // Main search function
  const searchResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return []

    setLoading(true)
    
    // Parse the natural language query
    const specialties = parseSpecialties(query)
    const weekdays = parseWeekdays(query)
    const timeOfDay = parseTimeOfDay(query)
    const locations = parseLocations(query)

    // Filter medicos based on specialties
    let filteredMedicos = medicos
    
    if (specialties.length > 0) {
      filteredMedicos = medicos.filter(medico => 
        medico.especialidades.some(esp => 
          specialties.some(searchSpec => 
            esp.toLowerCase().includes(searchSpec) || 
            searchSpec.includes(esp.toLowerCase())
          )
        )
      )
    }

    // Build results with matching horarios
    const searchResults: SearchResult[] = []

    filteredMedicos.forEach(medico => {
      const medicoHorarios = horarios.filter(h => h.medico_id === medico.id)
      
      if (medicoHorarios.length === 0) return

      // Group by sede and especialidad
      const grouped = new Map<string, Horario[]>()
      
      medicoHorarios.forEach(horario => {
        const key = `${horario.sede}-${horario.especialidad}`
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(horario)
      })

      grouped.forEach((horariosGroup, key) => {
        const [sede, especialidad] = key.split('-')
        
        // Filter by location if specified
        if (locations.length > 0 && !locations.includes(sede)) return
        
        // Filter by weekday and time of day
        let matchedHorarios = horariosGroup
        
        if (weekdays.length > 0) {
          matchedHorarios = matchedHorarios.filter(h => weekdays.includes(h.dia_semana))
        }
        
        if (timeOfDay.start !== undefined || timeOfDay.end !== undefined) {
          matchedHorarios = matchedHorarios.filter(h => filterByTimeOfDay(h, timeOfDay))
        }

        // Only include if we have matching horarios or no specific filters
        if (matchedHorarios.length > 0 || (weekdays.length === 0 && !timeOfDay.start && !timeOfDay.end)) {
          searchResults.push({
            medico,
            horarios: horariosGroup,
            matchedHorarios,
            sede,
            especialidad
          })
        }
      })
    })

    setLoading(false)
    return searchResults
  }, [query, medicos, horarios])

  useEffect(() => {
    setResults(searchResults)
    onResultsChange?.(searchResults)
  }, [searchResults, onResultsChange])

  // Format day name
  const getDayName = (dayNum: number): string => {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    return days[dayNum] || ''
  }

  // Format time range
  const formatTimeRange = (inicio: string | null, fin: string | null): string => {
    if (!inicio) return 'Sin horario definido'
    if (!fin) return inicio
    return `${inicio} - ${fin}`
  }

  const suggestions = [
    '"Cardiólogo en sede norte"',
    '"Pediatra los viernes"',
    '"Traumatólogo en la mañana"',
    '"Dermatólogo en Maracay"',
    '"Ginecólogo mañana"'
  ]

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar con lenguaje natural: 'pediatra los viernes', 'cardiólogo en sede norte'..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-slate-200 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 text-base text-slate-700 placeholder-slate-400 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {loading && (
          <div className="absolute inset-x-0 top-full mt-2 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
              Buscando...
            </div>
          </div>
        )}
      </div>

      {/* Suggestions when empty */}
      {!query && (
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500">Prueba buscar con frases como:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(suggestion.replace(/"/g, ''))}
                className="px-3 py-1.5 text-sm text-teal-600 bg-teal-50 rounded-full hover:bg-teal-100 transition-colors border border-teal-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {query && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              Resultados de búsqueda
            </h3>
            <span className="text-sm text-slate-500">
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
              <svg className="mx-auto w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.175-5.5-3M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-slate-500 mb-2">No se encontraron médicos que coincidan con tu búsqueda</p>
              <p className="text-xs text-slate-400">Intenta con términos diferentes o más generales</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {results.map((result, idx) => (
                <div
                  key={`${result.medico.id}-${result.sede}-${result.especialidad}-${idx}`}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Doctor Header */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800">{result.medico.nombre}</h4>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-slate-600">{result.especialidad}</p>
                      <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded">
                        {result.sede.replace('SEDE ', '')}
                      </span>
                    </div>
                  </div>

                  {/* Available Times */}
                  <div className="p-4 space-y-3">
                    {result.matchedHorarios.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                          Horarios disponibles
                        </p>
                        <div className="space-y-1">
                          {result.matchedHorarios.slice(0, 3).map((horario, hIdx) => (
                            <div key={hIdx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">{getDayName(horario.dia_semana)}</span>
                              <span className="text-slate-800 font-medium">
                                {formatTimeRange(horario.hora_inicio, horario.hora_fin)}
                              </span>
                            </div>
                          ))}
                          {result.matchedHorarios.length > 3 && (
                            <p className="text-xs text-slate-400">
                              +{result.matchedHorarios.length - 3} horarios más
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Horarios generales:</p>
                        <div className="space-y-1">
                          {result.horarios.slice(0, 2).map((horario, hIdx) => (
                            <div key={hIdx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">{getDayName(horario.dia_semana)}</span>
                              <span className="text-slate-600">
                                {formatTimeRange(horario.hora_inicio, horario.hora_fin)}
                              </span>
                            </div>
                          ))}
                          {result.horarios.length > 2 && (
                            <p className="text-xs text-slate-400">
                              +{result.horarios.length - 2} días más
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={() => {
                        setSelectedResult(result)
                        setShowAppointmentForm(true)
                      }}
                      className="w-full mt-4 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                    >
                      Agendar Cita
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appointment Form */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={() => {
          setShowAppointmentForm(false)
          setSelectedResult(null)
        }}
        onSuccess={() => {
          setShowAppointmentForm(false)
          setSelectedResult(null)
          // Could add success callback here
        }}
      />
    </div>
  )
}