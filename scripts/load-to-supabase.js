const fs = require('fs');

const SUPA_URL = 'https://upewexegupymrmotzpgp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZXdleGVndXB5bXJtb3R6cGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzM2MzcsImV4cCI6MjA4NzEwOTYzN30.4xoqbDsoLUKp95NxWwcly089ef-XoswAhHTuZDPVj44';

async function rpc(sql) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql_text: sql })
  });
  return res.json();
}

async function insertBatch(table, rows) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert ${table} failed: ${err}`);
  }
  return res.json();
}

async function main() {
  const medicos = JSON.parse(fs.readFileSync('/data/.openclaw/workspace-main/giga/scripts/medicos.json', 'utf8'));
  const horarios = JSON.parse(fs.readFileSync('/data/.openclaw/workspace-main/giga/scripts/horarios.json', 'utf8'));

  // Insert medicos (need to format especialidades as postgres array)
  console.log(`Inserting ${medicos.length} medicos...`);
  const medicoRows = medicos.map(m => ({
    nombre: m.nombre,
    especialidades: m.especialidades
  }));
  
  // Batch in groups of 50
  const idMap = new Map(); // old id -> new db id
  for (let i = 0; i < medicoRows.length; i += 50) {
    const batch = medicoRows.slice(i, i + 50);
    const inserted = await insertBatch('giga_medicos', batch);
    inserted.forEach(row => {
      const oldId = medicos.find(m => m.nombre === row.nombre)?.id;
      if (oldId) idMap.set(oldId, row.id);
    });
    console.log(`  Inserted medicos ${i + 1}-${Math.min(i + 50, medicoRows.length)}`);
  }
  console.log(`Medicos inserted: ${idMap.size}`);

  // Insert horarios with mapped ids
  console.log(`\nInserting ${horarios.length} horarios...`);
  const horarioRows = horarios.map(h => ({
    medico_id: idMap.get(h.medico_id),
    sede: h.sede,
    especialidad: h.especialidad,
    dia_semana: h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fin: h.hora_fin
  })).filter(h => h.medico_id); // skip unmapped

  for (let i = 0; i < horarioRows.length; i += 100) {
    const batch = horarioRows.slice(i, i + 100);
    await insertBatch('giga_horarios', batch);
    console.log(`  Inserted horarios ${i + 1}-${Math.min(i + 100, horarioRows.length)}`);
  }
  
  console.log(`\nDone! ${idMap.size} medicos, ${horarioRows.length} horarios loaded.`);
}

main().catch(console.error);
