import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "inspectoria-ceia-2026",
  appId: "1:295448747784:web:1f1060af40f9d8e6eed6bd",
  storageBucket: "inspectoria-ceia-2026.firebasestorage.app",
  apiKey: "AIzaSyBBekyGsYaSsPNi1g0F2o-v5HwInI7dzN8",
  authDomain: "inspectoria-ceia-2026.firebaseapp.com",
  messagingSenderId: "295448747784",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function cleanString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

async function run() {
  const dataRaw = fs.readFileSync('./alumnos_data.json', 'utf-8');
  const nominasData = JSON.parse(dataRaw);
  
  const reportesRef = collection(db, 'reportes');
  const snapshot = await getDocs(reportesRef);
  
  for (const docSnap of snapshot.docs) {
    const docId = docSnap.id;
    const docData = docSnap.data();
    
    if (docData.periodo.toLowerCase().includes('marzo') || docData.periodo.toLowerCase().includes('abril')) {
      console.log(`Procesando periodo: ${docData.periodo}`);
      
      let alertas = docData.alertas || [];
      let licencias = docData.licencias || [];
      
      let agregados = 0;
      let actualizados = 0;
      
      for (const cursoData of nominasData) {
        for (const alumnoObj of cursoData.alumnos) {
          const alumnoNomina = alumnoObj.nombre;
          const isRetirado = alumnoObj.retirado;
          const fechaRetiro = alumnoObj.fechaRetiro;
          
          const partsNomina = alumnoNomina.split(' ');
          const nombreNomina = partsNomina[0]; 
          const apellidoPaterno = partsNomina[1]; 
          
          // Revisar si existe en alertas (búsqueda más flexible por errores de tipeo como "FERNADO")
          const indexAlerta = alertas.findIndex(a => {
            const p = cleanString(a.nombre).split(' ');
            return p.length > 1 && 
                   p[1] === apellidoPaterno && 
                   p[0].substring(0, 3) === nombreNomina.substring(0, 3);
          });
          
          if (indexAlerta !== -1) {
            let needsUpdate = false;
            if (alertas[indexAlerta].nombre !== alumnoNomina) {
               alertas[indexAlerta].nombre = alumnoNomina; // Estandarizamos al nuevo formato
               needsUpdate = true;
            }
            if (isRetirado && !alertas[indexAlerta].retirado) {
               alertas[indexAlerta].retirado = true;
               alertas[indexAlerta].fechaRetiro = fechaRetiro;
               needsUpdate = true;
            }
            if (needsUpdate) actualizados++;
          } else {
            const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
            alertas.push({
              id: newId,
              nombre: alumnoNomina,
              curso: cursoData.curso,
              asistenciaAcum: 100,
              accion: "Sin acción",
              observaciones: "Precargado desde nómina",
              retirado: isRetirado,
              fechaRetiro: fechaRetiro
            });
            agregados++;
          }
          
          // Estandarizar también en licencias si el alumno existe ahí (misma lógica flexible)
          const indexLicencia = licencias.findIndex(l => {
            const p = cleanString(l.nombre).split(' ');
            return p.length > 1 && 
                   p[1] === apellidoPaterno && 
                   p[0].substring(0, 3) === nombreNomina.substring(0, 3);
          });
          if (indexLicencia !== -1) {
              if (licencias[indexLicencia].nombre !== alumnoNomina) {
                  licencias[indexLicencia].nombre = alumnoNomina;
              }
              if (isRetirado) {
                  licencias[indexLicencia].retirado = true;
              }
          }
        }
      }
      
      await setDoc(doc(db, 'reportes', docId), {
        ...docData,
        alertas: alertas,
        licencias: licencias
      });
      console.log(`Éxito en ${docData.periodo}. Agregados: ${agregados}, Actualizados al nuevo formato: ${actualizados}`);
    }
  }
  
  console.log("¡Proceso finalizado!");
  process.exit(0);
}

run().catch(console.error);
