'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSedeData, searchRecords, MedicalRecord } from './lib/supabase'

interface SedeData {
  [key: string]: {
    name: string
    doctorCount: number
    specialtyCount: number
  }
}

export default function Home() {
  const [sedeData, setSedeData] = useState<SedeData>({})
  const [searchResults, setSearchResults] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSedeData()
  }, [])

  const loadSedeData = async () => {
    try {
      setLoading(true)
      const data = await getSedeData()
      setSedeData(data)
    } catch (error) {
      console.error('Error loading sede data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    try {
      setSearching(true)
      const results = await searchRecords(query)
      setSearchResults(results)
    } catch (error) {
      console.error('Error searching:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    handleSearch(value)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-cyan-100">
        <div className="max-w-7xl container py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center space-x-3">
              <span style={{ fontSize: '2.5rem' }}>🏥</span>
              <span>GIGA Dashboard - Prevaler</span>
            </h1>
            <p className="mt-2 text-lg text-gray-600">Directorio Médico</p>
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
                  placeholder="Buscar médico, especialidad o sede..."
                />
              </div>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl container py-8">
        {/* Search Results */}
        {searchQuery && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Resultados de búsqueda: "{searchQuery}"
            </h2>
            
            {searching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="loading-spinner"></div>
                <p className="mt-4 text-gray-600">Buscando...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 grid-cols-2-md grid-cols-3-lg">
                {searchResults.map((doctor) => (
                  <div key={doctor.id} className="card">
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
                            <div className="flex items-center space-x-1 text-sm mt-1 text-cyan-600">
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
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            Zona horaria: {doctor.timezone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No se encontraron resultados para "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}

        {/* Sedes Grid (only show when not searching) */}
        {!searchQuery && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sedes Disponibles</h2>
              <p className="text-gray-600">Selecciona una sede para ver el directorio médico completo</p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="loading-spinner"></div>
                <p className="mt-4 text-gray-600">Cargando sedes...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 grid-cols-2-md grid-cols-3-lg">
                {Object.values(sedeData).map((sede) => (
                  <Link key={sede.name} href={`/sede/${encodeURIComponent(sede.name)}`}>
                    <div className="card cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#cffafe',
                            borderRadius: '0.5rem'
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>📍</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {sede.name}
                            </h3>
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <span style={{ color: '#0891b2' }}>👨‍⚕️</span>
                                <span>{sede.doctorCount} médicos</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <span style={{ color: '#0891b2' }}>🩺</span>
                                <span>{sede.specialtyCount} especialidades</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '1.5rem',
                          color: '#9ca3af'
                        }}>
                          →
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
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