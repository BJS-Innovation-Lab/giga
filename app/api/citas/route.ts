import { NextRequest, NextResponse } from 'next/server'
import { getCitasByFecha, createCita, updateCitaStatus } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha')
    
    if (!fecha) {
      return NextResponse.json({ error: 'Fecha is required' }, { status: 400 })
    }

    const citas = await getCitasByFecha(fecha)
    return NextResponse.json({ data: citas })
  } catch (error) {
    console.error('Error fetching citas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      paciente_nombre,
      paciente_telefono,
      paciente_email,
      medico_id,
      sede,
      especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      notas
    } = body

    if (!paciente_nombre || !paciente_telefono || !paciente_email || !medico_id || !sede || !especialidad || !fecha || !hora_inicio || !hora_fin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newCita = await createCita({
      paciente_nombre,
      paciente_telefono,
      paciente_email,
      medico_id: parseInt(medico_id),
      sede,
      especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      status: 'scheduled',
      notas: notas || '',
      created_by: 'system'
    })

    return NextResponse.json({ data: newCita }, { status: 201 })
  } catch (error) {
    console.error('Error creating cita:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 })
    }

    if (!['scheduled', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updatedCita = await updateCitaStatus(parseInt(id), status)
    return NextResponse.json({ data: updatedCita })
  } catch (error) {
    console.error('Error updating cita status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}