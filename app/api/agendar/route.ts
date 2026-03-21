import { NextRequest, NextResponse } from 'next/server'
import { getMedicos, getHorarios, getCitasByMedicoFecha, createCita, Medico, Horario } from '../../../lib/supabase'

// NL date parsing for Spanish
function parseNLDate(text: string): { fecha?: string, hora?: string } {
  const now = new Date()
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let targetDate: Date | null = null
  let hora: string | undefined

  // Relative days
  if (normalized.includes('hoy')) {
    targetDate = new Date(now)
  } else if (normalized.includes('pasado manana')) {
    targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + 2)
  } else if (/(?<!(en la |por la |de la ))manana/.test(normalized)) {
    targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + 1)
  }

  // Day names
  const dayMap: Record<string, number> = {
    'lunes': 1, 'martes': 2, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sabado': 6, 'domingo': 0
  }
  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (normalized.includes(dayName)) {
      targetDate = new Date(now)
      const currentDay = now.getDay()
      let diff = dayNum - currentDay
      if (diff <= 0) diff += 7
      targetDate.setDate(targetDate.getDate() + diff)
      break
    }
  }

  // "próxima semana"
  if (normalized.includes('proxima semana') || normalized.includes('semana que viene')) {
    targetDate = new Date(now)
    const currentDay = now.getDay()
    const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay
    targetDate.setDate(targetDate.getDate() + daysUntilMonday)
  }

  // Explicit date formats: "20 de marzo", "20/03", "2026-03-20"
  const dateMatch1 = normalized.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/)
  if (dateMatch1) {
    const months: Record<string, number> = {
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
      'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    }
    targetDate = new Date(now.getFullYear(), months[dateMatch1[2]], parseInt(dateMatch1[1]))
    if (targetDate < now) targetDate.setFullYear(targetDate.getFullYear() + 1)
  }

  const dateMatch2 = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (dateMatch2) {
    const day = parseInt(dateMatch2[1])
    const month = parseInt(dateMatch2[2]) - 1
    const year = dateMatch2[3] ? (dateMatch2[3].length === 2 ? 2000 + parseInt(dateMatch2[3]) : parseInt(dateMatch2[3])) : now.getFullYear()
    targetDate = new Date(year, month, day)
    if (targetDate < now && !dateMatch2[3]) targetDate.setFullYear(targetDate.getFullYear() + 1)
  }

  const isoMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    targetDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
  }

  // Time parsing
  // "en la mañana" / "por la mañana" → prefer morning slots
  if (/(?:en|por|de) la manana/.test(normalized) || normalized.includes('temprano')) {
    hora = '08:00'
  } else if (normalized.includes('tarde')) {
    hora = '14:00'
  } else if (normalized.includes('noche')) {
    hora = '18:00'
  }

  // "a las 3", "a la 1"
  const hourMatch = normalized.match(/a las? (\d{1,2})(?::(\d{2}))?/)
  if (hourMatch) {
    const h = parseInt(hourMatch[1])
    const m = hourMatch[2] || '00'
    hora = `${h.toString().padStart(2, '0')}:${m}`
  }

  // Explicit HH:MM format
  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch && !hourMatch) {
    hora = `${parseInt(timeMatch[1]).toString().padStart(2, '0')}:${timeMatch[2]}`
  }

  const fecha = targetDate ? targetDate.toISOString().split('T')[0] : undefined

  return { fecha, hora }
}

function fuzzyScore(needle: string, haystack: string): number {
  const a = needle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const b = haystack.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (b.includes(a)) return 1
  if (a.includes(b)) return 0.8
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

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`
}

interface AgendarRequest {
  paciente: string
  telefono: string
  especialidad: string
  sede?: string
  fecha?: string
  hora?: string
  medico_id?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: AgendarRequest = await request.json()

    const { paciente, telefono, especialidad, sede, fecha, hora, medico_id } = body

    if (!paciente || !telefono || !especialidad) {
      return NextResponse.json({
        ok: false,
        error: 'Campos requeridos: paciente, telefono, especialidad'
      }, { status: 400 })
    }

    const [medicos, horarios] = await Promise.all([getMedicos(), getHorarios()])

    // Parse NL dates from fecha field if present
    const nlParsed = fecha ? parseNLDate(fecha) : { fecha: undefined, hora: undefined }
    const resolvedFecha = nlParsed.fecha || fecha
    const resolvedHora = hora || nlParsed.hora

    // Auto-match doctor by specialty (and optionally by medico_id)
    let matchedMedicos: Medico[]
    if (medico_id) {
      matchedMedicos = medicos.filter(m => m.id === medico_id)
    } else {
      // Match specialty against doctor specialties and horarios
      const espNorm = especialidad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      matchedMedicos = medicos.filter(medico => {
        // Check medico.especialidades
        const directMatch = medico.especialidades.some(esp => {
          const norm = esp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          return norm.includes(espNorm) || espNorm.includes(norm) || fuzzyScore(espNorm, norm) > 0.5
        })
        if (directMatch) return true

        // Check horario specialties
        const medicoHorarios = horarios.filter(h => h.medico_id === medico.id)
        return medicoHorarios.some(h => {
          const norm = h.especialidad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          return norm.includes(espNorm) || espNorm.includes(norm) || fuzzyScore(espNorm, norm) > 0.5
        })
      })
    }

    if (matchedMedicos.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No se encontraron médicos para la especialidad: ${especialidad}`,
        sugerencias: Array.from(new Set(medicos.flatMap(m => m.especialidades))).sort()
      }, { status: 404 })
    }

    // Filter by sede if provided
    let candidateHorarios = horarios.filter(h => matchedMedicos.some(m => m.id === h.medico_id))
    if (sede) {
      const sedeNorm = sede.toUpperCase()
      const sedeMatch = sedeNorm.startsWith('SEDE') ? sedeNorm : `SEDE ${sedeNorm}`
      candidateHorarios = candidateHorarios.filter(h => h.sede.toUpperCase() === sedeMatch)
    }

    if (candidateHorarios.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No se encontraron horarios disponibles${sede ? ` en ${sede}` : ''} para ${especialidad}`,
        medicos_encontrados: matchedMedicos.map(m => ({ id: m.id, nombre: m.nombre, especialidades: m.especialidades }))
      }, { status: 404 })
    }

    // If no date, return available slots for the next 7 days
    if (!resolvedFecha) {
      const availableSlots: any[] = []
      const now = new Date()

      for (let offset = 0; offset < 7; offset++) {
        const checkDate = new Date(now)
        checkDate.setDate(checkDate.getDate() + offset)
        const dayOfWeek = checkDate.getDay()
        const dateStr = checkDate.toISOString().split('T')[0]

        const dayHorarios = candidateHorarios.filter(h => h.dia_semana === dayOfWeek && h.hora_inicio && h.hora_fin)

        for (const h of dayHorarios) {
          if (!h.hora_inicio || !h.hora_fin) continue
          const medico = matchedMedicos.find(m => m.id === h.medico_id)
          if (!medico) continue

          // Check existing appointments
          const existing = await getCitasByMedicoFecha(h.medico_id, dateStr)

          // Generate 30-min slots
          let current = h.hora_inicio
          while (current < h.hora_fin) {
            const nextSlot = addMinutes(current, 30)
            if (nextSlot <= h.hora_fin) {
              const isOccupied = existing.some(c => c.hora_inicio <= current && c.hora_fin > current)
              if (!isOccupied) {
                // If hora preference, only include matching slots
                if (resolvedHora) {
                  const slotHour = parseInt(current.split(':')[0])
                  const prefHour = parseInt(resolvedHora.split(':')[0])
                  if (Math.abs(slotHour - prefHour) > 2) {
                    current = nextSlot
                    continue
                  }
                }
                availableSlots.push({
                  medico_id: medico.id,
                  medico_nombre: medico.nombre,
                  especialidad: h.especialidad,
                  sede: h.sede,
                  fecha: dateStr,
                  hora_inicio: current,
                  hora_fin: nextSlot
                })
              }
            }
            current = nextSlot
          }
        }

        // Limit results
        if (availableSlots.length >= 20) break
      }

      return NextResponse.json({
        ok: true,
        message: 'Selecciona un horario disponible para agendar la cita',
        slots_disponibles: availableSlots.slice(0, 20),
        total_encontrados: availableSlots.length
      })
    }

    // Validate date format (must be YYYY-MM-DD after NL parsing)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(resolvedFecha)) {
      return NextResponse.json({
        ok: false,
        error: `No se pudo interpretar la fecha: "${fecha}". Usa formato YYYY-MM-DD o frases como "mañana", "lunes", "20 de marzo".`
      }, { status: 400 })
    }

    // Find available slot for the resolved date
    const targetDate = new Date(resolvedFecha + 'T12:00:00')
    const dayOfWeek = targetDate.getDay()

    const dayHorarios = candidateHorarios.filter(h => h.dia_semana === dayOfWeek && h.hora_inicio && h.hora_fin)

    if (dayHorarios.length === 0) {
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      return NextResponse.json({
        ok: false,
        error: `No hay disponibilidad para ${especialidad} el ${dayNames[dayOfWeek]} ${resolvedFecha}`,
        sugerencia: 'Intenta con otra fecha o sin especificar fecha para ver todas las opciones disponibles'
      }, { status: 404 })
    }

    // Find best slot
    let bestSlot: { medico: Medico, horario: Horario, hora_inicio: string, hora_fin: string } | null = null

    for (const h of dayHorarios) {
      if (!h.hora_inicio || !h.hora_fin) continue
      const medico = matchedMedicos.find(m => m.id === h.medico_id)
      if (!medico) continue

      const existing = await getCitasByMedicoFecha(h.medico_id, resolvedFecha)

      let current = h.hora_inicio
      while (current < h.hora_fin) {
        const nextSlot = addMinutes(current, 30)
        if (nextSlot <= h.hora_fin) {
          const isOccupied = existing.some(c => c.hora_inicio <= current && c.hora_fin > current)
          if (!isOccupied) {
            if (resolvedHora) {
              const slotHour = parseInt(current.split(':')[0])
              const prefHour = parseInt(resolvedHora.split(':')[0])
              if (Math.abs(slotHour - prefHour) <= 1) {
                bestSlot = { medico, horario: h, hora_inicio: current, hora_fin: nextSlot }
                break
              }
            } else {
              bestSlot = { medico, horario: h, hora_inicio: current, hora_fin: nextSlot }
              break
            }
          }
        }
        current = nextSlot
      }
      if (bestSlot) break
    }

    // If hora preference didn't match exactly, try without it
    if (!bestSlot && resolvedHora) {
      for (const h of dayHorarios) {
        if (!h.hora_inicio || !h.hora_fin) continue
        const medico = matchedMedicos.find(m => m.id === h.medico_id)
        if (!medico) continue
        const existing = await getCitasByMedicoFecha(h.medico_id, resolvedFecha)
        let current = h.hora_inicio
        while (current < h.hora_fin) {
          const nextSlot = addMinutes(current, 30)
          if (nextSlot <= h.hora_fin) {
            const isOccupied = existing.some(c => c.hora_inicio <= current && c.hora_fin > current)
            if (!isOccupied) {
              bestSlot = { medico, horario: h, hora_inicio: current, hora_fin: nextSlot }
              break
            }
          }
          current = nextSlot
        }
        if (bestSlot) break
      }
    }

    if (!bestSlot) {
      return NextResponse.json({
        ok: false,
        error: `No hay horarios disponibles para ${resolvedFecha}. Todos los cupos están ocupados.`,
        sugerencia: 'Intenta con otra fecha o sin especificar fecha para ver opciones'
      }, { status: 409 })
    }

    // Create the appointment
    const newCita = await createCita({
      paciente_nombre: paciente,
      paciente_telefono: telefono,
      paciente_email: '',
      medico_id: bestSlot.medico.id,
      sede: bestSlot.horario.sede,
      especialidad: bestSlot.horario.especialidad,
      fecha: resolvedFecha,
      hora_inicio: bestSlot.hora_inicio,
      hora_fin: bestSlot.hora_fin,
      status: 'scheduled',
      notas: '',
      created_by: 'api-agendar'
    })

    return NextResponse.json({
      ok: true,
      message: 'Cita agendada exitosamente',
      cita: {
        id: newCita.id,
        paciente: newCita.paciente_nombre,
        medico: bestSlot.medico.nombre,
        especialidad: newCita.especialidad,
        sede: newCita.sede,
        fecha: newCita.fecha,
        hora_inicio: newCita.hora_inicio,
        hora_fin: newCita.hora_fin,
        status: newCita.status
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error in /api/agendar:', error)
    return NextResponse.json({
      ok: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}
