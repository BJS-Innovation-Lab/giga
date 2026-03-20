'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { getAllRecords, MedicalRecord } from '../lib/supabase'

const SEDE_ICONS: Record<string, string> = {
  'SEDE NORTE': '🏥', 'SEDE SUR': '🏨', 'SEDE ESTE': '🏩',
  'SEDE VIÑA': '🍇', 'SEDE PUERTO CABELLO': '⚓',
  'SEDE MARACAY': '🌿', 'SEDE PORLAMAR': '🏝️',
}

const CITY_MAP: Record<string, { city: string; icon: string }> = {
  'SEDE NORTE': { city: 'Valencia', icon: '🏙️' },
  'SEDE SUR': { city: 'Valencia', icon: '🏙️' },
  'SEDE ESTE': { city: 'Valencia', icon: '🏙️' },
  'SEDE VIÑA': { city: 'Valencia', icon: '🏙️' },
  'SEDE PUERTO CABELLO': { city: 'Puerto Cabello', icon: '⚓' },
  'SEDE MARACAY': { city: 'Maracay', icon: '🌿' },
  'SEDE PORLAMAR': { city: 'Porlamar (Margarita)', icon: '🏝️' },
}

const CITY_ORDER = ['Valencia', 'Maracay', 'Puerto Cabello', 'Porlamar (Margarita)']

export default function Home() {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSede, setSelectedSede] = useState<string | null>(null)
  const [selectedEsp, setSelectedEsp] = useState<string | null>(null)

  useEffect(() => {
    getAllRecords()
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let r = records
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(rec => rec.medico.toLowerCase().includes(q) || rec.especialidad.toLowerCase().includes(q) || rec.sede.toLowerCase().includes(q))
    }
    if (selectedSede) r = r.filter(rec => rec.sede === selectedSede)
    if (selectedEsp) r = r.filter(rec => rec.especialidad === selectedEsp)
    return r
  }, [records, search, selectedSede, selectedEsp])

  const sedes = useMemo(() => {
    const map = new Map<string, { doctors: Set<string>; specs: Set<string> }>()
    records.forEach(r => {
      if (!map.has(r.sede)) map.set(r.sede, { doctors: new Set(), specs: new Set() })
      const s = map.get(r.sede)!
      s.doctors.add(r.medico)
      s.specs.add(r.especialidad)
    })
    return Array.from(map.entries()).map(([name, s]) => ({ name, dc: s.doctors.size, sc: s.specs.size }))
  }, [records])

  const especialidades = useMemo(() => {
    const src = selectedSede ? records.filter(r => r.sede === selectedSede) : records
    const map = new Map<string, number>()
    src.forEach(r => map.set(r.especialidad, (map.get(r.especialidad) || 0) + 1))
    return Array.from(map.entries()).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => a.name.localeCompare(b.name))
  }, [records, selectedSede])

  const grouped = useMemo(() => {
    const map = new Map<string, MedicalRecord[]>()
    filtered.forEach(r => { if (!map.has(r.especialidad)) map.set(r.especialidad, []); map.get(r.especialidad)!.push(r) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando directorio médico...</p>
      </div>
    </div>
  )

  if (error) return <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center"><p className="text-red-600">Error: {error}</p></div>

  const clearAll = () => { setSearch(''); setSelectedSede(null); setSelectedEsp(null) }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Médicos', value: new Set(records.map(r => r.medico)).size, c: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
          { label: 'Especialidades', value: new Set(records.map(r => r.especialidad)).size, c: 'bg-blue-50 border-blue-200 text-blue-900' },
          { label: 'Sedes', value: sedes.length, c: 'bg-teal-50 border-teal-200 text-teal-900' },
          { label: 'Registros', value: records.length, c: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border-l-4 p-4 ${s.c}`}>
            <p className="text-sm font-medium opacity-75">{s.label}</p>
            <p className="text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-xl mx-auto">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Buscar médico, especialidad o sede..."
          className="w-full px-5 py-3 rounded-xl border border-cyan-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-700 placeholder-gray-400" />
        {(search || selectedSede || selectedEsp) && (
          <button onClick={clearAll} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-sm font-medium">✕ Limpiar</button>
        )}
      </div>

      {(selectedSede || selectedEsp) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {selectedSede && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 text-sm font-medium">📍 {selectedSede} <button onClick={() => setSelectedSede(null)} className="ml-1 hover:text-red-600">✕</button></span>}
          {selectedEsp && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">🩺 {selectedEsp} <button onClick={() => setSelectedEsp(null)} className="ml-1 hover:text-red-600">✕</button></span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">📍 Sedes</h2>
            <div className="space-y-3">
              {CITY_ORDER.map(city => {
                const citySedes = sedes.filter(s => CITY_MAP[s.name]?.city === city)
                if (citySedes.length === 0) return null
                const cityIcon = CITY_MAP[citySedes[0].name]?.icon || '📍'
                const totalDocs = citySedes.reduce((a, s) => a + s.dc, 0)
                return (
                  <div key={city} className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                    <div className="px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-700">{cityIcon} {city}</span>
                        <span className="text-xs text-gray-400">{totalDocs} 👨‍⚕️</span>
                      </div>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {citySedes.map(sede => (
                        <button key={sede.name} onClick={() => { setSelectedSede(selectedSede === sede.name ? null : sede.name); setSelectedEsp(null) }}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all ${selectedSede === sede.name ? 'bg-cyan-600 text-white border-cyan-600 shadow-lg shadow-cyan-200' : 'bg-white border-gray-100 hover:border-cyan-300 hover:shadow-md'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{SEDE_ICONS[sede.name] || '📍'}</span>
                              <span className="font-semibold text-xs">{sede.name.replace('SEDE ', '')}</span>
                            </div>
                            <div className={`text-xs ${selectedSede === sede.name ? 'text-cyan-100' : 'text-gray-400'}`}>{sede.dc}👨‍⚕️ · {sede.sc}🩺</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">🩺 Especialidades</h2>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {especialidades.map(esp => (
                <button key={esp.name} onClick={() => setSelectedEsp(selectedEsp === esp.name ? null : esp.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedEsp === esp.name ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-blue-50 text-gray-700'}`}>
                  <div className="flex justify-between items-center">
                    <span className="truncate">{esp.name}</span>
                    <span className={`text-xs font-medium ml-2 ${selectedEsp === esp.name ? 'text-blue-100' : 'text-gray-400'}`}>{esp.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-lg font-bold text-gray-800">👨‍⚕️ Directorio ({filtered.length} registros)</h2>
          {grouped.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center"><p className="text-gray-400 text-lg">No se encontraron resultados</p></div>
          ) : grouped.map(([esp, docs]) => (
            <div key={esp} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3">
                <h3 className="text-white font-bold flex items-center gap-2">🩺 {esp} <span className="text-cyan-100 text-sm font-normal">({docs.length})</span></h3>
              </div>
              <div className="divide-y divide-gray-50">
                {docs.map(doc => (
                  <div key={doc.id} className="px-5 py-3 hover:bg-cyan-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <p className="font-semibold text-gray-800">👨‍⚕️ {doc.medico}</p>
                        <p className="text-sm text-gray-500">📍 {doc.sede}</p>
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">🕐 {doc.horario || 'Sin horario'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
