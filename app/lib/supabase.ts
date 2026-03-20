import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface MedicalRecord {
  id: number
  sede: string
  especialidad: string
  medico: string
  horario: string
  timezone: string
  created_at: string
}

export async function getAllRecords(): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('giga_directorio_medico')
    .select('*')
    .order('sede', { ascending: true })
    .order('especialidad', { ascending: true })

  if (error) {
    throw new Error(`Error fetching records: ${error.message}`)
  }

  return data as MedicalRecord[]
}

export async function getSedeData() {
  const records = await getAllRecords()
  
  const sedeStats = records.reduce((acc, record) => {
    if (!acc[record.sede]) {
      acc[record.sede] = {
        name: record.sede,
        doctorCount: 0,
        specialtyCount: 0,
        doctors: new Set<string>(),
        specialties: new Set<string>()
      }
    }
    
    acc[record.sede].doctors.add(record.medico)
    acc[record.sede].specialties.add(record.especialidad)
    
    return acc
  }, {} as any)

  // Convert sets to counts
  Object.keys(sedeStats).forEach(sede => {
    sedeStats[sede].doctorCount = sedeStats[sede].doctors.size
    sedeStats[sede].specialtyCount = sedeStats[sede].specialties.size
    delete sedeStats[sede].doctors
    delete sedeStats[sede].specialties
  })

  return sedeStats
}

export async function getSedeRecords(sede: string): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('giga_directorio_medico')
    .select('*')
    .eq('sede', sede)
    .order('especialidad', { ascending: true })
    .order('medico', { ascending: true })

  if (error) {
    throw new Error(`Error fetching sede records: ${error.message}`)
  }

  return data as MedicalRecord[]
}

export async function searchRecords(query: string): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('giga_directorio_medico')
    .select('*')
    .or(`medico.ilike.%${query}%,especialidad.ilike.%${query}%,sede.ilike.%${query}%`)
    .order('sede', { ascending: true })
    .order('especialidad', { ascending: true })

  if (error) {
    throw new Error(`Error searching records: ${error.message}`)
  }

  return data as MedicalRecord[]
}