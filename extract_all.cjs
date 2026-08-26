// ============================================================================
//  OBSOLETO — NO EJECUTAR
//
//  Este script generaba alumnos_data.json leyendo los .docx de NOMINAS/.
//  Desde agosto 2026 la nomina se construye desde SAAT (Reporte de Matricula
//  + Reporte de Alumnos Retirados), que trae el RUN de cada alumno y las
//  fechas de matricula y retiro reales.
//
//  Ejecutarlo SOBREESCRIBE alumnos_data.json y hace perder los RUN, las
//  fechas y los 55 retiros vigentes, dejando la nomina como estaba en marzo.
//
//  Se conserva solo como referencia historica.
// ============================================================================

const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const fileMap = {
  '7Y8': '3er Nivel Básico.docx',
  '1Y2 HC': '1ero y 2do Medio HC.docx',
  '3Y4 HC': '3ero y 4to HC.docx',
  '1Y2 ELE': '1ero y 2do Medio Electrico.docx',
  '3 ELEC': '3ero Medio Electrico.docx',
  '4 ELEC': '4to Medio Electrico.docx',
  '1Y2 PAR': '1ero y 2do Medio Parvulos.docx',
  '3 PAR': '3ero Medio Parvulos.docx',
  '4 PAR': '4to Medio Parvulos.docx'
};

const nominasDir = path.join(__dirname, "NOMINAS");

function isRut(str) {
  return /^[0-9]{7,8}-[0-9Kk]$/.test(str);
}

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function normalizeName(fullName) {
  const cleanName = removeAccents(fullName.trim());
  const words = cleanName.split(/\s+/);
  
  if (words.length < 3) return words.reverse().join(" ");

  let skip = 0;
  let apellidoPaterno = words[0];
  if (["DE", "DEL", "LA", "LAS", "LOS", "SAN"].includes(words[0])) {
    apellidoPaterno = words[0] + " " + words[1];
    skip = 1;
    if (["DE", "DEL", "LA", "LAS", "LOS"].includes(words[1])) {
      apellidoPaterno += " " + words[2];
      skip = 2;
    }
  }

  let skipMat = skip + 1;
  let apellidoMaterno = words[skipMat];
  if (["DE", "DEL", "LA", "LAS", "LOS"].includes(words[skipMat])) {
     apellidoMaterno = words[skipMat] + " " + words[skipMat+1];
     skipMat++;
     if (["DE", "DEL", "LA", "LAS", "LOS"].includes(words[skipMat])) {
         apellidoMaterno += " " + words[skipMat+1];
         skipMat++;
     }
  }

  let primerNombre = words[skipMat + 1] || words[words.length - 1];

  return `${primerNombre} ${apellidoPaterno} ${apellidoMaterno}`.toUpperCase().trim();
}

async function processAll() {
  const result = [];
  
  for (const [curso, filename] of Object.entries(fileMap)) {
    const filePath = path.join(nominasDir, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }
    
    const { value: text } = await mammoth.extractRawText({ path: filePath });
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    
    const alumnos = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (isRut(lines[i])) {
        if (i + 1 < lines.length) {
          const rawName = lines[i+1];
          if (isNaN(rawName) && rawName.length > 5) {
            
            let retirado = false;
            let fechaRetiro = null;
            
            // Check next 6 lines for "Ret:"
            for(let j = 1; j <= 6; j++) {
               if (i + j < lines.length && lines[i+j].toLowerCase().startsWith('ret:')) {
                   retirado = true;
                   fechaRetiro = lines[i+j].substring(4).trim();
                   break;
               }
            }
            
            alumnos.push({
               nombre: normalizeName(rawName),
               retirado,
               fechaRetiro
            });
          }
        }
      }
    }
    
    result.push({ curso, alumnos });
  }
  
  fs.writeFileSync(path.join(__dirname, "alumnos_data.json"), JSON.stringify(result, null, 2));
  console.log("JSON generated at alumnos_data.json");
}

processAll().catch(console.error);
