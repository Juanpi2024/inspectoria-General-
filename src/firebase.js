import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "inspectoria-ceia-2026",
  appId: "1:295448747784:web:1f1060af40f9d8e6eed6bd",
  storageBucket: "inspectoria-ceia-2026.firebasestorage.app",
  apiKey: "AIzaSyBBekyGsYaSsPNi1g0F2o-v5HwInI7dzN8",
  authDomain: "inspectoria-ceia-2026.firebaseapp.com",
  messagingSenderId: "295448747784"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
