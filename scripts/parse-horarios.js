const DIAS = {
  'LUNES': 1, 'MARTES': 2, 'MIERCOLES': 3, 'MIÉRCOLES': 3,
  'JUEVES': 4, 'VIERNES': 5, 'SABADO': 6, 'SÁBADO': 6, 'DOMINGO': 7
};

function parseTime(t) {
  if (!t) return null;
  t = t.trim().toUpperCase().replace(/\s+/g, '');
  const pm = t.includes('PM');
  const am = t.includes('AM');
  t = t.replace(/[APM]/g, '').replace(/\./g, ':');
  
  let hours, minutes = 0;
  if (t.includes(':')) {
    const parts = t.split(':');
    hours = parseInt(parts[0]); minutes = parseInt(parts[1]) || 0;
  } else if (t.length <= 2) {
    hours = parseInt(t);
  } else if (t.length === 3) {
    hours = parseInt(t[0]); minutes = parseInt(t.slice(1));
  } else if (t.length === 4) {
    hours = parseInt(t.slice(0, 2)); minutes = parseInt(t.slice(2));
  } else {
    hours = parseInt(t);
  }
  
  if (isNaN(hours)) return null;
  if (pm && hours < 12) hours += 12;
  if (am && hours === 12) hours = 0;
  
  return `${String(hours).padStart(2,'0')}:${String(minutes||0).padStart(2,'0')}`;
}

function parseHorario(raw) {
  if (!raw) return [];
  const blocks = [];
  // Split by / that separates different day-time blocks
  const segments = raw.split(/\s*\/\s*/);
  
  for (const seg of segments) {
    const upper = seg.toUpperCase().trim();
    if (!upper) continue;
    
    const foundDays = [];
    let remaining = upper;
    
    // Handle "LUNES A VIERNES" range pattern first
    const rangeMatch = remaining.match(/(\w+)\s+A\s+(\w+)/);
    if (rangeMatch && DIAS[rangeMatch[1]] && DIAS[rangeMatch[2]]) {
      const start = DIAS[rangeMatch[1]], end = DIAS[rangeMatch[2]];
      for (let d = start; d <= end; d++) foundDays.push(d);
      remaining = remaining.replace(rangeMatch[0], '');
    } else {
      // Extract individual days, longest names first to avoid partial matches
      const dayNames = Object.keys(DIAS).sort((a, b) => b.length - a.length);
      for (const name of dayNames) {
        if (remaining.includes(name)) {
          foundDays.push(DIAS[name]);
          remaining = remaining.replace(new RegExp(name, 'g'), '');
        }
      }
    }
    
    if (foundDays.length === 0) continue;
    
    remaining = remaining.replace(/[,Y]/g, ' ').trim();
    
    // Extract time range: "8AM a 2PM"
    const timeMatch = remaining.match(/(\d{1,2}[:\.]?\d{0,2}\s*[APM]{0,2})\s*[Aa]\s*(\d{1,2}[:\.]?\d{0,2}\s*[APM]{0,2})/i);
    
    let inicio = null, fin = null;
    if (timeMatch) {
      inicio = parseTime(timeMatch[1]);
      fin = parseTime(timeMatch[2]);
    } else {
      const singleMatch = remaining.match(/(\d{1,2}[:\.]?\d{0,2}\s*[APM]{2})/i);
      if (singleMatch) {
        inicio = parseTime(singleMatch[1]);
        if (inicio) {
          const h = parseInt(inicio.split(':')[0]);
          fin = `${String(Math.min(h + 3, 23)).padStart(2,'0')}:${inicio.split(':')[1]}`;
        }
      }
    }
    
    const uniqueDays = [...new Set(foundDays)];
    for (const dia of uniqueDays) {
      blocks.push({ dia_semana: dia, hora_inicio: inicio, hora_fin: fin });
    }
  }
  
  return blocks;
}

async function main() {
  const SUPA_URL = 'https://upewexegupymrmotzpgp.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZXdleGVndXB5bXJtb3R6cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzM2MzcsImV4cCI6MjA4NzEwOTYzN30.4xoqbDsoLUKp95NxWwcly089ef-XoswAhHTuZDPVj44';
  
  const res = await fetch(`${SUPA_URL}/rest/v1/giga_directorio_medico?select=id,medico,sede,especialidad,horario&order=medico&limit=500`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
  });
  const records = await res.json();
  console.log(`Fetched ${records.length} records`);
  
  // Build unique medicos
  const medicosMap = new Map();
  records.forEach(r => {
    if (!medicosMap.has(r.medico)) medicosMap.set(r.medico, { nombre: r.medico, especialidades: new Set() });
    medicosMap.get(r.medico).especialidades.add(r.especialidad);
  });
  
  const medicos = Array.from(medicosMap.values()).map((m, i) => ({
    id: i + 1,
    nombre: m.nombre,
    especialidades: Array.from(m.especialidades)
  }));
  console.log(`Unique doctors: ${medicos.length}`);
  
  // Build horarios
  const horarios = [];
  let parseErrors = 0;
  const medicoIdMap = new Map(medicos.map(m => [m.nombre, m.id]));
  
  records.forEach(r => {
    const blocks = parseHorario(r.horario);
    if (blocks.length === 0) {
      parseErrors++;
      console.log(`PARSE FAIL: "${r.horario}" | ${r.medico}`);
    }
    blocks.forEach(b => {
      horarios.push({
        medico_id: medicoIdMap.get(r.medico),
        sede: r.sede,
        especialidad: r.especialidad,
        dia_semana: b.dia_semana,
        hora_inicio: b.hora_inicio,
        hora_fin: b.hora_fin,
        horario_raw: r.horario
      });
    });
  });
  
  console.log(`\nGenerated ${horarios.length} schedule blocks from ${records.length} records`);
  console.log(`Parse errors: ${parseErrors}`);
  
  // Stats
  const days = {1:'LUN',2:'MAR',3:'MIE',4:'JUE',5:'VIE',6:'SAB',7:'DOM'};
  const dayCounts = {};
  horarios.forEach(h => { dayCounts[h.dia_semana] = (dayCounts[h.dia_semana]||0)+1; });
  console.log('\nBlocks per day:');
  Object.entries(dayCounts).sort((a,b)=>a[0]-b[0]).forEach(([d,c])=>console.log(`  ${days[d]}: ${c}`));
  
  const fs = await import('fs');
  fs.writeFileSync('/data/.openclaw/workspace-main/giga/scripts/medicos.json', JSON.stringify(medicos, null, 2));
  fs.writeFileSync('/data/.openclaw/workspace-main/giga/scripts/horarios.json', JSON.stringify(horarios, null, 2));
  console.log('\nWritten medicos.json and horarios.json');
  
  // Sample output
  console.log('\n--- Sample (first 5) ---');
  horarios.slice(0, 5).forEach(h => console.log(JSON.stringify(h)));
}

main().catch(console.error);
