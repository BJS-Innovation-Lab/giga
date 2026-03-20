'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSedeRecords, MedicalRecord } from '../../lib/supabase'

export default function SedePage() {
  const params = useParams()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const sede = decodeURIComponent(params.sede as string)

  useEffect(() => {
    loadSedeRecords()
  }, [sede])

  const loadSedeRecords = async () => {
    try {
      setLoading(true)
      const data = await getSedeRecords(sede)
      setRecords(data)
      setFilteredRecords(data)
    } catch (error) {
      console.error('Error loading sede records:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    
    if (!query.trim()) {
      setFilteredRecords(records)
      return
    }

    const filtered = records.filter(record =>
      record.medico.toLowerCase().includes(query.toLowerCase()) ||
      record.especialidad.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredRecords(filtered)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    handleSearch(value)
  }

  // Group records by specialty
  const groupedBySpecialty = filteredRecords.reduce((acc, record) => {
    if (!acc[record.especialidad]) {
      acc[record.especialidad] = []
    }
    acc[record.especialidad].push(record)
    return acc
  }, {} as Record<string, MedicalRecord[]>)

  const specialties = Object.keys(groupedBySpecialty).sort()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-cyan-100">
        <div className="max-w-7xl container py-6">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/" 
              className="flex items-center space-x-2 text-cyan-600"
              style={{
                textDecoration: 'none',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0e7490'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#0891b2'}
            >
              <span style={{ fontSize: '1.25rem' }}>←</span>
              <span>Volver al inicio</span>
            </Link>
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center space-x-3">
              <span style={{ fontSize: '2.5rem' }}>📍</span>
              <span>{sede}</span>
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              {records.length} médicos en {specialties.length} especialidades
            </p>
          </div>
          
          <div className="mt-6 flex justify-center">
            <form onSubmit={handleSearchSubmit} className="w-full max-w-md">
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '1rem',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  fontSize: '1.2rem'
                }}>
                  🔍
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="search-input"
                  style={{ paddingLeft: '3rem' }}
                  placeholder="Buscar médico o especialidad en esta sede..."
                />
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl container py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-spinner"></div>
            <p className="mt-4 text-gray-600">Cargando directorio médico...</p>
          </div>
        ) : filteredRecords.length === 0 && searchQuery ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No se encontraron resultados para "{searchQuery}" en {sede}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {specialties.map((specialty) => (
              <div key={specialty} className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <span style={{ fontSize: '1.5rem' }}>🩺</span>
                  <span>{specialty}</span>
                  <span style={{
                    backgroundColor: '#cffafe',
                    color: '#155e75',
                    fontSize: '0.875rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px'
                  }}>
                    {groupedBySpecialty[specialty].length} médicos
                  </span>
                </h2>
                
                <div className="grid grid-cols-1 grid-cols-2-md grid-cols-3-lg">
                  {groupedBySpecialty[specialty].map((doctor) => (
                    <div key={doctor.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4" 
                         style={{
                           backgroundColor: 'white',
                           borderRadius: '0.5rem',
                           boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                           border: '1px solid #e5e7eb',
                           padding: '1rem',
                           transition: 'box-shadow 0.15s ease-in-out'
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                         }}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div style={{
                              padding: '0.5rem',
                              backgroundColor: '#ecfeff',
                              borderRadius: '0.5rem'
                            }}>
                              <span style={{ fontSize: '1.25rem' }}>👨‍⚕️</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{doctor.medico}</h4>
                              <div className="flex items-center space-x-1 text-sm mt-1" style={{ color: '#0891b2' }}>
                                <span>🩺</span>
                                <span>{doctor.especialidad}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <span>⏰</span>
                            <span>{doctor.horario}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span>📍</span>
                            <span>{doctor.sede}</span>
                          </div>
                          
                          {doctor.timezone && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              marginTop: '0.5rem'
                            }}>
                              Zona horaria: {doctor.timezone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-cyan-100 mt-16">
        <div className="max-w-7xl container py-6">
          <p className="text-center text-gray-600">
            Sistema GIGA v3.0 — Directorio médico conectado a base de datos en tiempo real
          </p>
        </div>
      </footer>
    </div>
  )
}