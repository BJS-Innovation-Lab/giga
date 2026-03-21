import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upewexegupymrmotzpgp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZXdleGVndXB5bXJtb3R6cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzM2MzcsImV4cCI6MjA4NzEwOTYzN30.4xoqbDsoLUKp95NxWwcly089ef-XoswAhHTuZDPVj44'

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

export interface Medico {
  id: number
  nombre: string
  especialidades: string[]
}

export interface Horario {
  id: number
  medico_id: number
  sede: string
  especialidad: string
  dia_semana: number
  hora_inicio: string | null
  hora_fin: string | null
}

export interface Cita {
  id: number
  paciente_nombre: string
  paciente_telefono: string
  paciente_email: string
  medico_id: number
  sede: string
  especialidad: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notas?: string
  created_by: string
  created_at: string
}

export async function getAllRecords(): Promise<MedicalRecord[]> {
  const { data, error } = await supabase
    .from('giga_directorio_medico')
    .select('*')
    .order('sede')
    .order('especialidad')
    .order('medico')

  if (error) throw new Error(error.message)
  return data as MedicalRecord[]
}

export async function getMedicos(): Promise<Medico[]> {
  const { data, error } = await supabase
    .from('giga_medicos')
    .select('*')
    .order('nombre')
  if (error) throw new Error(error.message)
  return data as Medico[]
}

export async function getHorarios(): Promise<Horario[]> {
  const { data, error } = await supabase
    .from('giga_horarios')
    .select('*')
  if (error) throw new Error(error.message)
  return data as Horario[]
}

export async function getHorariosByMedico(medicoId: number): Promise<Horario[]> {
  const { data, error } = await supabase
    .from('giga_horarios')
    .select('*')
    .eq('medico_id', medicoId)
    .order('dia_semana')
    .order('hora_inicio')
  if (error) throw new Error(error.message)
  return data as Horario[]
}

export async function getCitasHoy(): Promise<Cita[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('giga_citas')
    .select('*')
    .eq('fecha', today)
    .order('hora_inicio')
  if (error) throw new Error(error.message)
  return data as Cita[]
}

export async function getCitasByFecha(fecha: string): Promise<Cita[]> {
  const { data, error } = await supabase
    .from('giga_citas')
    .select('*')
    .eq('fecha', fecha)
    .order('hora_inicio')
  if (error) throw new Error(error.message)
  return data as Cita[]
}

export async function getCitasByMedicoFecha(medicoId: number, fecha: string): Promise<Cita[]> {
  const { data, error } = await supabase
    .from('giga_citas')
    .select('*')
    .eq('medico_id', medicoId)
    .eq('fecha', fecha)
    .order('hora_inicio')
  if (error) throw new Error(error.message)
  return data as Cita[]
}

export async function createCita(cita: Omit<Cita, 'id' | 'created_at'>): Promise<Cita> {
  const { data, error } = await supabase
    .from('giga_citas')
    .insert([cita])
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Cita
}

export async function updateCitaStatus(id: number, status: Cita['status']): Promise<Cita> {
  const { data, error } = await supabase
    .from('giga_citas')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Cita
}
