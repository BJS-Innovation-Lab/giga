import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upewexegupymrmotzpgp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZXdleGVndXB5bXJtb3R6cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTM5MjUsImV4cCI6MjA1NzQ4OTkyNX0.IFfDCdBPKTcKNSMdA-GnnxBf3CXJlbHGXhbrK7Eevtc'

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
    .order('sede')
    .order('especialidad')
    .order('medico')

  if (error) throw new Error(error.message)
  return data as MedicalRecord[]
}
