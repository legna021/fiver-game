import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBdi98dvLjP2hmx3YfHEP4dcshFagvHiHg",
  authDomain: "fiver-game.firebaseapp.com",
  projectId: "fiver-game",
  storageBucket: "fiver-game.firebasestorage.app",
  messagingSenderId: "188743479774",
  appId: "1:188743479774:web:50a7842ce677865f60ad4f",
  measurementId: "G-8Y346JRB4E"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios que usaremos
export const db = getFirestore(app);
export const auth = getAuth(app);