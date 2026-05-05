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

async function run() {
  const reportesRef = collection(db, 'reportes');
  const snapshot = await getDocs(reportesRef);
  
  for (const docSnap of snapshot.docs) {
    const docId = docSnap.id;
    const docData = docSnap.data();
    
    if (docData.periodo.toLowerCase().includes('marzo') || docData.periodo.toLowerCase().includes('abril')) {
      let alertas = docData.alertas || [];
      const originalLength = alertas.length;
      
      // Filtrar los que fueron precargados en el paso anterior
      alertas = alertas.filter(a => a.observaciones !== "Precargado desde nómina");
      
      const removed = originalLength - alertas.length;
      
      await setDoc(doc(db, 'reportes', docId), {
        ...docData,
        alertas: alertas
      });
      console.log(`Se eliminaron ${removed} precargas de ${docData.periodo}`);
    }
  }
  
  console.log("Limpieza completada!");
  process.exit(0);
}

run().catch(console.error);
