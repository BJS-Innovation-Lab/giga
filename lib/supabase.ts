import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase credentials not configured')
    _client = createClient(url, key)
  }
  return _client
}

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
  const { data, error } = await getClient()
    .from('giga_directorio_medico')
    .select('*')
    .order('sede')
    .order('especialidad')
    .order('medico')

  if (error) throw new Error(error.message)
  return data as MedicalRecord[]
}
