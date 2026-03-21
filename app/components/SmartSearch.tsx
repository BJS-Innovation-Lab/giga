'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { getMedicos, getHorarios, getCitasByMedicoFecha, Medico, Horario } from '../../lib/supabase'
import AppointmentForm from './AppointmentForm'

interface SearchResult {
  medico: Medico
  horarios: Horario[]
  matchedHorarios: Horario[]
  sede: string
  especialidad: string
  nextAvailable?: string
  matchScore: number
  matchReason?: string
}

interface SmartSearchProps {
  onResultsChange?: (results: SearchResult[]) => void
}

// Fuzzy match: returns a score 0-1 (1 = exact match)
function fuzzyScore(needle: string, haystack: string): number {
  const a = needle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const b = haystack.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (b.includes(a)) return 1
  if (a.includes(b)) return 0.8
  // Levenshtein-based tolerance for short words
  if (a.length >= 3 && b.length >= 3) {
    const lev = levenshtein(a, b)
    const maxLen = Math.max(a.length, b.length)
    if (lev <= 2 && maxLen <= 10) return 1 - (lev / maxLen)
  }
  // bigram overlap
  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const aBi = bigrams(a)
  const bBi = bigrams(b)
  if (aBi.size === 0 || bBi.size === 0) return 0
  let overlap = 0
  aBi.forEach(bi => { if (bBi.has(bi)) overlap++ })
  return overlap / Math.max(aBi.size, bBi.size)
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Symptom → specialty mapping (expanded)
const SYMPTOM_MAP: Record<string, string[]> = {
  'traumatólogo': ['hueso', 'huesos', 'fractura', 'fracturas', 'esguince', 'tobillo', 'rodilla', 'cadera', 'hombro', 'columna', 'espalda', 'dolor de espalda', 'lumbar', 'cervical', 'tendón', 'ligamento', 'músculo', 'muscular', 'codo', 'muñeca', 'luxación', 'dislocación', 'menisco', 'hernia discal', 'ciática', 'ciatica', 'escoliosis', 'tendinitis', 'bursitis', 'desgarre', 'desgarro', 'yeso', 'caí', 'caida', 'golpe fuerte', 'torcedura', 'me torci', 'me caí'],
  'cardiólogo': ['corazón', 'pecho', 'dolor de pecho', 'taquicardia', 'arritmia', 'hipertensión', 'presión alta', 'infarto', 'soplo', 'palpitaciones', 'angina', 'colesterol', 'triglicéridos', 'insuficiencia cardíaca', 'marcapasos', 'ecocardiograma', 'electrocardiograma', 'me duele el pecho', 'me falta el aire', 'latidos irregulares', 'tensión alta', 'soplo cardíaco', 'varices'],
  'pediatra': ['niño', 'niños', 'niña', 'bebé', 'bebe', 'hijo', 'hija', 'infantil', 'menor', 'recién nacido', 'lactante', 'adolescente', 'vacuna niño', 'fiebre niño', 'mi hijo', 'mi hija', 'mi bebé', 'mi bebe', 'control del niño sano', 'crecimiento', 'desarrollo infantil', 'neonato'],
  'ginecólogo': ['embarazo', 'embarazada', 'menstruación', 'regla', 'ovario', 'útero', 'papanicolau', 'mamografía', 'mamas', 'senos', 'mujer', 'femenino', 'menopausia', 'endometriosis', 'quiste ovárico', 'flujo vaginal', 'cólico menstrual', 'anticonceptivo', 'planificación familiar', 'parto', 'cesárea', 'prenatal', 'control prenatal', 'citología', 'sangrado vaginal', 'mioma', 'fertilidad', 'infertilidad'],
  'dermatólogo': ['piel', 'acné', 'acne', 'mancha', 'manchas', 'alergia en la piel', 'sarpullido', 'erupción', 'hongo', 'hongos', 'verruga', 'lunar', 'psoriasis', 'vitíligo', 'eczema', 'dermatitis', 'caída de cabello', 'calvicie', 'alopecia', 'urticaria', 'picazón', 'rasquiña', 'quemadura de sol', 'herpes', 'celulitis', 'rosácea', 'me pica', 'me sale', 'grano', 'granos', 'espinilla', 'espinillas'],
  'neurólogo': ['cabeza', 'dolor de cabeza', 'migraña', 'jaqueca', 'mareo', 'mareos', 'vértigo', 'convulsión', 'epilepsia', 'hormigueo', 'adormecimiento', 'memoria', 'cefalea', 'temblor', 'parkinson', 'alzheimer', 'demencia', 'esclerosis', 'neuropatía', 'tic nervioso', 'desmayo', 'pérdida de consciencia', 'se me adormece', 'dolor de cabeza fuerte', 'me duele la cabeza', 'entumecimiento', 'me tiembla'],
  'oftalmólogo': ['ojos', 'ojo', 'vista', 'visión', 'lentes', 'catarata', 'glaucoma', 'miopía', 'no veo bien', 'borroso', 'astigmatismo', 'conjuntivitis', 'ojo rojo', 'ojo seco', 'lagrimeo', 'presbicia', 'retina', 'estrabismo', 'veo borroso', 'me arden los ojos', 'me lloran los ojos', 'moscas volantes', 'pérdida de visión'],
  'otorrinolaringólogo': ['oído', 'oido', 'nariz', 'garganta', 'sinusitis', 'amígdalas', 'sordera', 'zumbido', 'ronquido', 'voz', 'afonía', 'otitis', 'rinitis', 'tabique desviado', 'laringitis', 'faringitis', 'apnea del sueño', 'acúfenos', 'tinnitus', 'sangrado nasal', 'no escucho bien', 'me duele la garganta', 'me duele el oído', 'me zumba el oído', 'ronco mucho', 'no puedo respirar por la nariz', 'congestión nasal'],
  'psicólogo': ['ansiedad', 'depresión', 'estrés', 'stress', 'insomnio', 'no puedo dormir', 'angustia', 'pánico', 'terapia', 'emocional', 'autoestima', 'duelo', 'fobia', 'trauma', 'pareja', 'terapia de pareja', 'ansiedad social', 'me siento triste', 'me siento mal', 'ataques de pánico', 'nervios', 'nervioso', 'problemas emocionales'],
  'psiquiatra': ['psiquiátrico', 'medicación mental', 'esquizofrenia', 'bipolar', 'trastorno', 'trastorno bipolar', 'trastorno obsesivo', 'TOC', 'déficit de atención', 'TDAH', 'psicosis', 'alucinaciones', 'medicamento psiquiátrico'],
  'urólogo': ['riñón', 'riñones', 'orina', 'próstata', 'prostata', 'vías urinarias', 'infección urinaria', 'cálculos renales', 'piedras en el riñón', 'impotencia', 'disfunción eréctil', 'incontinencia urinaria', 'me arde al orinar', 'sangre en la orina', 'cistitis', 'vejiga', 'testículo', 'varicocele', 'orino mucho'],
  'endocrinólogo': ['diabetes', 'tiroides', 'hormona', 'hormonas', 'peso', 'obesidad', 'metabolismo', 'azúcar en la sangre', 'insulina', 'hipotiroidismo', 'hipertiroidismo', 'nódulo tiroideo', 'glucosa alta', 'resistencia a la insulina', 'síndrome metabólico', 'bocio', 'osteoporosis', 'menopausia hormonal', 'crecimiento anormal'],
  'gastroenterólogo': ['estómago', 'estomago', 'digestivo', 'digestión', 'gastritis', 'reflujo', 'acidez', 'náusea', 'nausea', 'vómito', 'diarrea', 'estreñimiento', 'colon', 'hígado', 'higado', 'abdomen', 'abdominal', 'dolor de barriga', 'barriga', 'úlcera', 'colitis', 'enfermedad de Crohn', 'síndrome de intestino irritable', 'hemorroides', 'vesícula', 'páncreas', 'pancreatitis', 'cirrosis', 'hepatitis', 'hinchazón abdominal', 'gases', 'me duele el estómago', 'no puedo hacer del baño', 'sangre en las heces'],
  'neumólogo': ['pulmón', 'pulmones', 'respirar', 'respiratorio', 'tos', 'asma', 'bronquitis', 'neumonía', 'falta de aire', 'dificultad para respirar', 'EPOC', 'tuberculosis', 'fibrosis pulmonar', 'tos crónica', 'tos con sangre', 'flema', 'silbido al respirar', 'oxígeno', 'apnea', 'me ahogo', 'no puedo respirar'],
  'reumatólogo': ['artritis', 'articulación', 'articulaciones', 'reuma', 'lupus', 'fibromialgia', 'inflamación articular', 'gota', 'artritis reumatoide', 'esclerodermia', 'vasculitis', 'dolor articular', 'rigidez matutina', 'hinchazón articular', 'me duelen las articulaciones', 'me duelen los huesos'],
  'médico general': ['general', 'chequeo', 'consulta general', 'medicina general', 'control', 'revisión', 'examen', 'rutina', 'chequeo general', 'consulta', 'certificado médico', 'constancia médica', 'gripe', 'resfriado', 'catarro', 'fiebre', 'malestar general', 'dolor de cuerpo', 'me siento mal', 'no me siento bien'],
  'cirujano': ['cirugía', 'operación', 'operar', 'cirujano', 'hernia', 'apéndice', 'apendicitis', 'biopsia', 'tumor', 'quiste', 'vesícula biliar', 'cirugía laparoscópica'],
  'internista': ['medicina interna', 'internista', 'interno', 'diagnóstico complejo', 'enfermedad crónica', 'múltiples enfermedades'],
  'nefrólogo': ['riñón', 'diálisis', 'nefrología', 'insuficiencia renal', 'trasplante renal', 'creatinina alta', 'proteinuria'],
  'oncólogo': ['cáncer', 'tumor', 'oncología', 'quimioterapia', 'radioterapia', 'ganglio', 'metástasis', 'biopsia', 'masa', 'bulto'],
  'hematólogo': ['sangre', 'anemia', 'hematología', 'plaquetas', 'leucemia', 'linfoma', 'hemofilia', 'trombosis', 'coagulación', 'moretones sin razón'],
  'alergólogo': ['alergia', 'alergias', 'rinitis alérgica', 'alergia alimentaria', 'anafilaxia', 'urticaria', 'estornudos', 'picazón en los ojos', 'prueba de alergia', 'me da alergia'],
  'fisiatra': ['rehabilitación', 'fisioterapia', 'terapia física', 'dolor crónico', 'lesión deportiva', 'recuperación', 'movilidad'],
  'nutricionista': ['dieta', 'nutrición', 'alimentación', 'sobrepeso', 'desnutrición', 'bajar de peso', 'subir de peso', 'plan alimenticio', 'comer sano'],
  'odontólogo': ['diente', 'dientes', 'muela', 'muelas', 'encía', 'encías', 'caries', 'dolor de muela', 'ortodoncia', 'brackets', 'blanqueamiento dental', 'me duele la muela'],
}

// Specialty keyword mapping (direct terms)
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  'traumatólogo': ['traumatología', 'traumatólogo', 'traumatologo', 'ortopedia', 'ortopedista'],
  'cardiólogo': ['cardiología', 'cardiólogo', 'cardiologo', 'cardiovascular'],
  'pediatra': ['pediatría', 'pediatra'],
  'ginecólogo': ['ginecología', 'ginecólogo', 'ginecologo', 'obstetricia', 'obstetra'],
  'dermatólogo': ['dermatología', 'dermatólogo', 'dermatologo', 'dermato'],
  'neurólogo': ['neurología', 'neurólogo', 'neurologo', 'neurológico'],
  'oftalmólogo': ['oftalmología', 'oftalmólogo', 'oftalmologo', 'oculista'],
  'otorrinolaringólogo': ['otorrinolaringología', 'otorrinolaringólogo', 'otorrino'],
  'psicólogo': ['psicología', 'psicólogo', 'psicologo'],
  'psiquiatra': ['psiquiatría', 'psiquiatra'],
  'urólogo': ['urología', 'urólogo', 'urologo'],
  'endocrinólogo': ['endocrinología', 'endocrinólogo', 'endocrinologo'],
  'gastroenterólogo': ['gastroenterología', 'gastroenterólogo', 'gastroenterologo', 'gastro'],
  'neumólogo': ['neumología', 'neumólogo', 'neumologo'],
  'reumatólogo': ['reumatología', 'reumatólogo', 'reumatologo'],
  'médico general': ['medicina general', 'médico general', 'medico general', 'general'],
  'cirujano': ['cirugía', 'cirujano'],
  'internista': ['medicina interna', 'internista'],
  'alergólogo': ['alergología', 'alergólogo', 'alergologo', 'alergista'],
  'fisiatra': ['fisiatría', 'fisiatra', 'rehabilitación', 'medicina física'],
  'nutricionista': ['nutrición', 'nutricionista', 'dietista'],
  'odontólogo': ['odontología', 'odontólogo', 'odontologo', 'dentista'],
  'nefrólogo': ['nefrología', 'nefrólogo', 'nefrologo'],
  'oncólogo': ['oncología', 'oncólogo', 'oncologo'],
  'hematólogo': ['hematología', 'hematólogo', 'hematologo'],
}

// Common NL phrases that map to intent
const NL_PHRASES: Record<string, string[]> = {
  'urgente': ['urgente', 'emergencia', 'lo antes posible', 'cuanto antes', 'ya', 'ahora mismo', 'rápido'],
  'primera_vez': ['primera vez', 'primera consulta', 'nunca he ido', 'nuevo paciente'],
  'seguimiento': ['seguimiento', 'control', 'revisión', 'cita de control'],
}

const RECENT_SEARCHES_KEY = 'giga_recent_searches'

export default function SmartSearch({ onResultsChange }: SmartSearchProps) {
  const [query, setQuery] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showAutoSuggestions, setShowAutoSuggestions] = useState(false)

  useEffect(() => {
    Promise.all([getMedicos(), getHorarios()])
      .then(([meds, hors]) => {
        setMedicos(meds)
        setHorarios(hors)
      })
      .catch(console.error)
  }, [])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch {}
  }, [])

  const saveRecentSearch = (q: string) => {
    if (!q.trim()) return
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5)
    setRecentSearches(updated)
    try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)) } catch {}
  }

  // Auto-complete suggestions based on current input
  const autoSuggestions = useMemo((): string[] => {
    if (!query.trim() || query.trim().length < 2) return []
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const suggestions: string[] = []

    // Suggest specialty completions
    for (const [, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
      for (const kw of keywords) {
        const nkw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (nkw.startsWith(q) && nkw !== q) {
          suggestions.push(kw.charAt(0).toUpperCase() + kw.slice(1))
        }
      }
    }

    // Suggest symptom completions
    for (const [, symptoms] of Object.entries(SYMPTOM_MAP)) {
      for (const symptom of symptoms) {
        const ns = symptom.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (ns.startsWith(q) && ns !== q && symptom.length > 3) {
          suggestions.push(symptom.charAt(0).toUpperCase() + symptom.slice(1))
        }
      }
    }

    // Deduplicate and limit
    return Array.from(new Set(suggestions)).slice(0, 5)
  }, [query])

  // Parse specialties from both keywords and symptoms
  const parseSpecialties = (text: string): { specialties: string[], fromSymptom: boolean, matchedSymptom?: string } => {
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const found = new Set<string>()
    let fromSymptom = false
    let matchedSymptom: string | undefined

    // Check direct specialty keywords first
    for (const [specialty, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
      if (keywords.some(kw => {
        const nkw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return normalizedText.includes(nkw)
      })) {
        found.add(specialty)
      }
    }

    // If no direct match, try symptom mapping
    if (found.size === 0) {
      // Try multi-word symptom phrases first (longer = more specific)
      const allSymptoms: { specialty: string, symptom: string }[] = []
      for (const [specialty, symptoms] of Object.entries(SYMPTOM_MAP)) {
        for (const symptom of symptoms) {
          allSymptoms.push({ specialty, symptom })
        }
      }
      // Sort by symptom length descending for better phrase matching
      allSymptoms.sort((a, b) => b.symptom.length - a.symptom.length)

      for (const { specialty, symptom } of allSymptoms) {
        const ns = symptom.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (normalizedText.includes(ns)) {
          found.add(specialty)
          fromSymptom = true
          if (!matchedSymptom) matchedSymptom = symptom
        }
      }
    }

    return { specialties: Array.from(found), fromSymptom, matchedSymptom }
  }

  const parseWeekdays = (text: string): number[] => {
    const dayMap: Record<string, number> = {
      'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
      'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 7
    }

    const today = new Date().getDay()
    const todayMapped = today === 0 ? 7 : today
    const tomorrowMapped = todayMapped === 7 ? 1 : todayMapped + 1

    const found: number[] = []
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    for (const [day, dayNum] of Object.entries(dayMap)) {
      const nd = day.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normalizedText.includes(nd)) {
        found.push(dayNum)
      }
    }

    if (normalizedText.includes('hoy')) found.push(todayMapped)
    // "mañana" as day (tomorrow) — only when NOT preceded by "en la" or "por la" (which means morning)
    if (/(?<!(en la |por la |de la ))manana/.test(normalizedText)) {
      found.push(tomorrowMapped)
    }

    // "pasado mañana" → day after tomorrow
    if (normalizedText.includes('pasado manana')) {
      const dayAfter = tomorrowMapped === 7 ? 1 : tomorrowMapped + 1
      // Remove tomorrow if "pasado mañana" was matched (override)
      const idx = found.indexOf(tomorrowMapped)
      if (idx > -1) found.splice(idx, 1)
      found.push(dayAfter)
    }

    // "esta semana" → remaining days of the week
    if (normalizedText.includes('esta semana')) {
      for (let d = todayMapped; d <= 7; d++) {
        if (!found.includes(d)) found.push(d)
      }
    }

    // "próxima semana" / "proxima semana" / "la semana que viene"
    if (normalizedText.includes('proxima semana') || normalizedText.includes('semana que viene')) {
      for (let d = 1; d <= 7; d++) {
        if (!found.includes(d)) found.push(d)
      }
    }

    // "fin de semana"
    if (normalizedText.includes('fin de semana')) {
      if (!found.includes(6)) found.push(6)
      if (!found.includes(7)) found.push(7)
    }

    // "entre semana" → weekdays only
    if (normalizedText.includes('entre semana')) {
      for (let d = 1; d <= 5; d++) {
        if (!found.includes(d)) found.push(d)
      }
    }

    return found
  }

  const parseTimeOfDay = (text: string): { start?: number, end?: number, label?: string } => {
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    // "en la mañana" / "por la mañana" / "de la mañana" → morning
    if (/(?:en|por|de) la manana/.test(normalizedText) || normalizedText.includes('temprano') || normalizedText.includes('amanecer')) {
      return { end: 12, label: 'en la mañana' }
    }
    if (normalizedText.includes('mediodia') || normalizedText.includes('medio dia')) {
      return { start: 11, end: 14, label: 'al mediodía' }
    }
    if (normalizedText.includes('tarde') || normalizedText.includes('afternoon')) {
      return { start: 12, end: 18, label: 'en la tarde' }
    }
    if (normalizedText.includes('noche') || normalizedText.includes('night')) {
      return { start: 18, label: 'en la noche' }
    }
    // "a la 1", "a las 2", specific hour
    const hourMatch = normalizedText.match(/a las? (\d{1,2})/)
    if (hourMatch) {
      const h = parseInt(hourMatch[1])
      return { start: h, end: h + 1, label: `a las ${h}` }
    }
    // "después de las 3" / "despues de las 3"
    const afterMatch = normalizedText.match(/despues de las? (\d{1,2})/)
    if (afterMatch) {
      const h = parseInt(afterMatch[1])
      return { start: h, label: `después de las ${h}` }
    }
    // "antes de las 3"
    const beforeMatch = normalizedText.match(/antes de las? (\d{1,2})/)
    if (beforeMatch) {
      const h = parseInt(beforeMatch[1])
      return { end: h, label: `antes de las ${h}` }
    }

    return {}
  }

  const parseLocations = (text: string): string[] => {
    const locationMap: Record<string, string[]> = {
      'SEDE NORTE': ['norte', 'north', 'sede norte'],
      'SEDE SUR': ['sur', 'south', 'sede sur'],
      'SEDE ESTE': ['sede este'],
      'SEDE VIÑA': ['viña', 'vina', 'sede viña'],
      'SEDE MARACAY': ['maracay'],
      'SEDE PORLAMAR': ['porlamar', 'margarita'],
      'SEDE PUERTO CABELLO': ['puerto cabello', 'cabello']
    }

    const found: string[] = []
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    for (const [sede, keywords] of Object.entries(locationMap)) {
      if (keywords.some(kw => normalizedText.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
        found.push(sede)
      }
    }

    return found
  }

  // Search for doctor names with fuzzy matching
  const parseDoctorName = (text: string): { medico: Medico, score: number }[] => {
    const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remove common filler words
    const cleaned = normalizedText.replace(/(?:necesito|busco|quiero|doctor|doctora|dr|dra|médico|medico|ver|con|un|una|el|la|de|para|que|me|atienda|cita|consulta|turno)\s*/g, '').trim()

    if (cleaned.length < 3) return []

    const matches: { medico: Medico, score: number }[] = []

    for (const medico of medicos) {
      const score = fuzzyScore(cleaned, medico.nombre)
      if (score >= 0.35) {
        matches.push({ medico, score })
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  const filterByTimeOfDay = (horario: Horario, timeFilter: { start?: number, end?: number }): boolean => {
    if (!horario.hora_inicio || (!timeFilter.start && !timeFilter.end)) return true
    const startHour = parseInt(horario.hora_inicio.split(':')[0])
    if (timeFilter.start && startHour < timeFilter.start) return false
    if (timeFilter.end && startHour >= timeFilter.end) return false
    return true
  }

  // Compute next available slot for a doctor/sede combo
  const computeNextAvailable = useCallback((medico: Medico, sede: string, medicoHorarios: Horario[]): string => {
    const now = new Date()
    const currentDay = now.getDay() === 0 ? 7 : now.getDay()
    const currentHour = now.getHours()
    const dayNames = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    // Check today and next 7 days
    for (let offset = 0; offset < 7; offset++) {
      const checkDay = ((currentDay - 1 + offset) % 7) + 1
      const dayHorarios = medicoHorarios.filter(h =>
        h.dia_semana === checkDay && h.sede === sede && h.hora_inicio
      )

      for (const h of dayHorarios) {
        if (!h.hora_inicio) continue
        const startHour = parseInt(h.hora_inicio.split(':')[0])

        // If today, only future slots
        if (offset === 0 && startHour <= currentHour) continue

        const date = new Date(now)
        date.setDate(date.getDate() + offset)
        const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

        if (offset === 0) return `Hoy ${h.hora_inicio}`
        if (offset === 1) return `Mañana ${h.hora_inicio}`
        return `${dayNames[checkDay]} ${dateStr} ${h.hora_inicio}`
      }
    }
    return ''
  }, [])

  // Build match reason string
  const buildMatchReason = (
    specialties: string[],
    fromSymptom: boolean,
    matchedSymptom: string | undefined,
    weekdays: number[],
    timeOfDay: { start?: number, end?: number, label?: string },
    locations: string[]
  ): string => {
    const parts: string[] = []
    if (fromSymptom && matchedSymptom) {
      parts.push(`"${matchedSymptom}" → ${specialties.join(', ')}`)
    } else if (specialties.length > 0) {
      parts.push(specialties.join(', '))
    }
    if (timeOfDay.label) parts.push(timeOfDay.label)
    if (locations.length > 0) parts.push(locations.map(l => l.replace('SEDE ', '')).join(', '))
    return parts.join(' · ')
  }

  // Main search
  const searchResults = useMemo((): SearchResult[] => {
    if (!query.trim() || query.trim().length < 2) return []

    const { specialties, fromSymptom, matchedSymptom } = parseSpecialties(query)
    const weekdays = parseWeekdays(query)
    const timeOfDay = parseTimeOfDay(query)
    const locations = parseLocations(query)
    const doctorMatches = parseDoctorName(query)
    const matchReason = buildMatchReason(specialties, fromSymptom, matchedSymptom, weekdays, timeOfDay, locations)

    let filteredMedicos: { medico: Medico, nameScore: number }[] = []

    // If doctor name matches found, prioritize those
    if (doctorMatches.length > 0) {
      filteredMedicos = doctorMatches.map(dm => ({ medico: dm.medico, nameScore: dm.score }))
    }

    // Also match by specialty (keywords + symptoms + fuzzy)
    if (specialties.length > 0) {
      const specMatches = medicos.filter(medico =>
        medico.especialidades.some(esp => {
          const espNorm = esp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          return specialties.some(searchSpec => {
            const ssNorm = searchSpec.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            return espNorm.includes(ssNorm) || ssNorm.includes(espNorm) || fuzzyScore(ssNorm, espNorm) > 0.5
          })
        })
      )
      specMatches.forEach(m => {
        if (!filteredMedicos.some(fm => fm.medico.id === m.id)) {
          filteredMedicos.push({ medico: m, nameScore: 0 })
        }
      })
    }

    // If nothing matched yet, try fuzzy on specialties in horarios
    if (filteredMedicos.length === 0 && !specialties.length && !doctorMatches.length) {
      const queryNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const matchedSpecialties = new Set<string>()
      horarios.forEach(h => {
        if (fuzzyScore(queryNorm, h.especialidad) > 0.4) {
          matchedSpecialties.add(h.especialidad)
        }
      })
      if (matchedSpecialties.size > 0) {
        const specMedicoIds = new Set(
          horarios.filter(h => matchedSpecialties.has(h.especialidad)).map(h => h.medico_id)
        )
        medicos.filter(m => specMedicoIds.has(m.id)).forEach(m => {
          filteredMedicos.push({ medico: m, nameScore: 0 })
        })
      }
    }

    // If still nothing, do a broad fuzzy search on doctor names
    if (filteredMedicos.length === 0) {
      const broad = medicos
        .map(m => ({ medico: m, nameScore: fuzzyScore(query, m.nombre) }))
        .filter(m => m.nameScore > 0.3)
        .sort((a, b) => b.nameScore - a.nameScore)
        .slice(0, 10)
      filteredMedicos = broad
    }

    // Build results
    const searchResults: SearchResult[] = []

    filteredMedicos.forEach(({ medico, nameScore }) => {
      const medicoHorarios = horarios.filter(h => h.medico_id === medico.id)
      if (medicoHorarios.length === 0) return

      const grouped = new Map<string, Horario[]>()
      medicoHorarios.forEach(horario => {
        const key = `${horario.sede}|||${horario.especialidad}`
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(horario)
      })

      grouped.forEach((horariosGroup, key) => {
        const [sede, especialidad] = key.split('|||')

        if (locations.length > 0 && !locations.includes(sede)) return

        let matchedHorarios = horariosGroup

        if (weekdays.length > 0) {
          matchedHorarios = matchedHorarios.filter(h => weekdays.includes(h.dia_semana))
        }

        if (timeOfDay.start !== undefined || timeOfDay.end !== undefined) {
          matchedHorarios = matchedHorarios.filter(h => filterByTimeOfDay(h, timeOfDay))
        }

        if (matchedHorarios.length > 0 || (weekdays.length === 0 && !timeOfDay.start && !timeOfDay.end)) {
          let score = nameScore * 2
          if (specialties.length > 0) score += 1
          if (matchedHorarios.length > 0) score += 0.5
          if (locations.length > 0) score += 0.5

          const nextAvailable = computeNextAvailable(medico, sede, horariosGroup)

          searchResults.push({
            medico,
            horarios: horariosGroup,
            matchedHorarios,
            sede,
            especialidad,
            nextAvailable,
            matchScore: score,
            matchReason
          })
        }
      })
    })

    searchResults.sort((a, b) => b.matchScore - a.matchScore)

    return searchResults
  }, [query, medicos, horarios, computeNextAvailable])

  useEffect(() => {
    setResults(searchResults)
    onResultsChange?.(searchResults)
  }, [searchResults, onResultsChange])

  // Save search when results are shown
  useEffect(() => {
    if (query.trim().length >= 3 && results.length > 0) {
      const timer = setTimeout(() => saveRecentSearch(query.trim()), 2000)
      return () => clearTimeout(timer)
    }
  }, [query, results.length])

  const getDayName = (dayNum: number): string => {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    return days[dayNum] || ''
  }

  const formatTimeRange = (inicio: string | null, fin: string | null): string => {
    if (!inicio) return 'Sin horario definido'
    if (!fin) return inicio
    return `${inicio} - ${fin}`
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    try { localStorage.removeItem(RECENT_SEARCHES_KEY) } catch {}
  }

  const suggestions = [
    'Cardiólogo en sede norte',
    'Pediatra los viernes',
    'Dolor de cabeza mañana en la tarde',
    'Dermatólogo en Maracay',
    'Doctor para dolor de estómago',
    'Ginecólogo esta semana',
    'Necesito un traumatólogo temprano',
    'Me duele la muela',
    'Alergia en la piel',
    'No puedo dormir, necesito ayuda',
    'Chequeo general entre semana',
    'Oftalmólogo después de las 2',
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
            onChange={(e) => { setQuery(e.target.value); setShowAutoSuggestions(true) }}
            onFocus={() => setShowAutoSuggestions(true)}
            onBlur={() => setTimeout(() => setShowAutoSuggestions(false), 200)}
            placeholder="Buscar: 'dolor de cabeza', 'pediatra viernes', 'Dr. García', 'me duele la muela'..."
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

        {/* Auto-complete dropdown */}
        {showAutoSuggestions && autoSuggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {autoSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onMouseDown={() => { setQuery(suggestion); setShowAutoSuggestions(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-teal-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions + Recent Searches when empty */}
      {!query && (
        <div className="text-center space-y-4">
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-sm text-slate-500">Búsquedas recientes</p>
                <button onClick={clearRecentSearches} className="text-xs text-slate-400 hover:text-red-500">Limpiar</button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(search)}
                    className="px-3 py-1.5 text-sm text-slate-600 bg-white rounded-full hover:bg-slate-100 transition-colors border border-slate-200"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm text-slate-500 mb-2">Prueba buscar con frases como:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(suggestion)}
                  className="px-3 py-1.5 text-sm text-teal-600 bg-teal-50 rounded-full hover:bg-teal-100 transition-colors border border-teal-200"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {query && query.trim().length >= 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Resultados de búsqueda
              </h3>
              {results.length > 0 && results[0].matchReason && (
                <p className="text-xs text-teal-600 mt-0.5">
                  Interpretación: {results[0].matchReason}
                </p>
              )}
            </div>
            <span className="text-sm text-slate-500">
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
              <svg className="mx-auto w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-slate-500 mb-2">No se encontraron resultados para &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mb-4">Intenta describir tus síntomas, buscar una especialidad, o el nombre del doctor</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Médico general', 'Cardiólogo', 'Pediatra', 'Dolor de cabeza'].map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(alt)}
                    className="px-3 py-1.5 text-xs text-teal-600 bg-teal-50 rounded-full hover:bg-teal-100 transition-colors border border-teal-200"
                  >
                    {alt}
                  </button>
                ))}
              </div>
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
                    {/* Next available slot */}
                    {result.nextAvailable && (
                      <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md border border-green-200">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Próximo disponible: {result.nextAvailable}
                      </div>
                    )}

                    {result.matchedHorarios.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                          Horarios disponibles
                        </p>
                        <div className="space-y-1">
                          {result.matchedHorarios.slice(0, 4).map((horario, hIdx) => (
                            <div key={hIdx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">{getDayName(horario.dia_semana)}</span>
                              <span className="text-slate-800 font-medium">
                                {formatTimeRange(horario.hora_inicio, horario.hora_fin)}
                              </span>
                            </div>
                          ))}
                          {result.matchedHorarios.length > 4 && (
                            <p className="text-xs text-slate-400">
                              +{result.matchedHorarios.length - 4} horarios más
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Horarios generales:</p>
                        <div className="space-y-1">
                          {result.horarios.slice(0, 3).map((horario, hIdx) => (
                            <div key={hIdx} className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">{getDayName(horario.dia_semana)}</span>
                              <span className="text-slate-600">
                                {formatTimeRange(horario.hora_inicio, horario.hora_fin)}
                              </span>
                            </div>
                          ))}
                          {result.horarios.length > 3 && (
                            <p className="text-xs text-slate-400">
                              +{result.horarios.length - 3} días más
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
        }}
      />
    </div>
  )
}
