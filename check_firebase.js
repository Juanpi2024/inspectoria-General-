import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function check() {
  const snapshot = await getDocs(collection(db, 'reportes'));
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.periodo.toLowerCase().includes('marzo') || data.periodo.toLowerCase().includes('abril')) {
        const alertas = data.alertas || [];
        // Muestra todos los que incluyen 'aguero' (con o sin tilde)
        const fer = alertas.filter(a => a.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("aguero"));
        console.log(`=== ${data.periodo} ===`);
        console.dir(fer, {depth: null});
    }
  }
  process.exit(0);
}
check();
