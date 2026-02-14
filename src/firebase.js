import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// AICI lipesti ce ai copiat din consola:
const firebaseConfig = {
  apiKey: "AIzaSyAurWcuIMeqKXEAAOYKdubaZnQ04FF_GCQ",
  authDomain: "prezenta-la-serviciu.firebaseapp.com",
  projectId: "prezenta-la-serviciu",
  storageBucket: "prezenta-la-serviciu.firebasestorage.app",
  messagingSenderId: "1050021574580",
  appId: "1:1050021574580:web:a2c5cb025aefb82b9024e1"
};

// Pornim Firebase
const app = initializeApp(firebaseConfig);

// Exportam baza de date pentru a o folosi in App.jsx
export const db = getFirestore(app);