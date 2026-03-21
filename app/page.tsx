'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { getAllRecords, MedicalRecord, getMedicos, getHorarios, Medico, Horario } from '../lib/supabase'
import DoctorCalendar from './components/DoctorCalendar'

const CITY_MAP: Record<string, { city: string }> = {
  'SEDE NORTE': { city: 'Carabobo' },
  'SEDE SUR': { city: 'Carabobo' },
  'SEDE ESTE': { city: 'Carabobo' },
  'SEDE VIÑA': { city: 'Carabobo' },
  'SEDE PUERTO CABELLO': { city: 'Carabobo' },
  'SEDE MARACAY': { city: 'Aragua' },
  'SEDE PORLAMAR': { city: 'Nueva Esparta' },
}

const CITY_ORDER = ['Carabobo', 'Aragua', 'Nueva Esparta']

export default function Home() {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSede, setSelectedSede] = useState<string | null>(null)
  const [selectedEsp, setSelectedEsp] = useState<string | null>(null)
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [allHorarios, setAllHorarios] = useState<Horario[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<{ medico: Medico; horarios: Horario[] } | null>(null)

  useEffect(() => {
    Promise.all([getAllRecords(), getMedicos(), getHorarios()])
      .then(([recs, meds, hors]) => { setRecords(recs); setMedicos(meds); setAllHorarios(hors) })
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
        <div className="w-10 h-10 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-slate-400">Cargando directorio...</p>
      </div>
    </div>
  )

  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"><p className="text-red-600 text-sm">Error: {error}</p></div>

  const clearAll = () => { setSearch(''); setSelectedSede(null); setSelectedEsp(null) }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Médicos', value: new Set(records.map(r => r.medico)).size, accent: 'border-teal-500' },
          { label: 'Especialidades', value: new Set(records.map(r => r.especialidad)).size, accent: 'border-blue-500' },
          { label: 'Sedes', value: sedes.length, accent: 'border-slate-400' },
          { label: 'Registros', value: records.length, accent: 'border-slate-300' },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-lg border-l-2 ${s.accent} px-4 py-3 shadow-sm`}>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-semibold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar médico, especialidad o sede..."
          className="w-full pl-10 pr-20 py-2.5 rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 text-sm text-slate-700 placeholder-slate-300" />
        {(search || selectedSede || selectedEsp) && (
          <button onClick={clearAll} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-red-500 font-medium">Limpiar</button>
        )}
      </div>

      {/* Active filters */}
      {(selectedSede || selectedEsp) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {selectedSede && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-200">
              {selectedSede.replace('SEDE ', '')}
              <button onClick={() => setSelectedSede(null)} className="ml-0.5 hover:text-red-600">&times;</button>
            </span>
          )}
          {selectedEsp && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
              {selectedEsp}
              <button onClick={() => setSelectedEsp(null)} className="ml-0.5 hover:text-red-600">&times;</button>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-5">
          {/* Sedes */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Sedes</h2>
            <div className="space-y-2.5">
              {CITY_ORDER.map(city => {
                const citySedes = sedes.filter(s => CITY_MAP[s.name]?.city === city)
                if (citySedes.length === 0) return null
                const totalDocs = citySedes.reduce((a, s) => a + s.dc, 0)
                return (
                  <div key={city} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-600">{city}</span>
                        <span className="text-[10px] text-slate-400">{totalDocs} médicos</span>
                      </div>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {citySedes.map(sede => (
                        <button key={sede.name} onClick={() => { setSelectedSede(selectedSede === sede.name ? null : sede.name); setSelectedEsp(null) }}
                          className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${
                            selectedSede === sede.name
                              ? 'bg-teal-600 text-white'
                              : 'hover:bg-slate-50 text-slate-600'
                          }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{sede.name.replace('SEDE ', '')}</span>
                            <span className={`text-[10px] ${selectedSede === sede.name ? 'text-teal-200' : 'text-slate-400'}`}>
                              {sede.dc} · {sede.sc}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Especialidades</h2>
            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              {especialidades.map(esp => (
                <button key={esp.name} onClick={() => setSelectedEsp(selectedEsp === esp.name ? null : esp.name)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all ${
                    selectedEsp === esp.name ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'
                  }`}>
                  <div className="flex justify-between items-center">
                    <span className="truncate">{esp.name}</span>
                    <span className={`text-[10px] font-medium ml-2 ${selectedEsp === esp.name ? 'text-blue-200' : 'text-slate-400'}`}>{esp.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">Directorio</h2>
            <span className="text-xs text-slate-400">{filtered.length} registros</span>
          </div>

          {grouped.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-400">No se encontraron resultados</p>
            </div>
          ) : grouped.map(([esp, docs]) => (
            <div key={esp} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 px-4 py-2.5">
                <h3 className="text-white text-sm font-medium flex items-center justify-between">
                  {esp}
                  <span className="text-slate-400 text-xs font-normal">{docs.length}</span>
                </h3>
              </div>
              <div className="divide-y divide-slate-50">
                {docs.map(doc => {
                  const matchedMedico = medicos.find(m => m.nombre === doc.medico)
                  return (
                    <div key={doc.id}
                      onClick={() => {
                        if (matchedMedico) {
                          const docHorarios = allHorarios.filter(h => h.medico_id === matchedMedico.id)
                          setSelectedDoctor({ medico: matchedMedico, horarios: docHorarios })
                        }
                      }}
                      className={`px-4 py-3 transition-colors ${matchedMedico ? 'hover:bg-teal-50/50 cursor-pointer group' : 'hover:bg-slate-50/50'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {doc.medico}
                            {matchedMedico && <span className="ml-2 text-[10px] text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Ver horario</span>}
                          </p>
                          <p className="text-xs text-slate-400">{doc.sede.replace('SEDE ', '')}</p>
                        </div>
                        <div className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded">{doc.horario || 'Sin horario'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDoctor && (
        <DoctorCalendar
          nombre={selectedDoctor.medico.nombre}
          especialidades={selectedDoctor.medico.especialidades}
          horarios={selectedDoctor.horarios}
          onClose={() => setSelectedDoctor(null)}
        />
      )}
    </div>
  )
}
