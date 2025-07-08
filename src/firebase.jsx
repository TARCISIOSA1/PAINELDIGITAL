// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Firestore
import { getStorage } from "firebase/storage";      // Storage

const firebaseConfig = {
  apiKey: "AIzaSyBng0-cT_YgFL_E0nUOJzprxv0ijkhIedk",
  authDomain: "camaravotacao.firebaseapp.com",
  projectId: "camaravotacao",
  storageBucket: "camaravotacao.firebasestorage.app", // <-- CORRIGIDO AQUI!
  messagingSenderId: "54469108444",
  appId: "1:54469108444:web:2448b08bb7c9c723f60a19"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta Firestore e Storage
export const db = getFirestore(app);
export const storage = getStorage(app);
