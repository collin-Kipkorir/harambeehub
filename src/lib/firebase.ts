import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDmGufiUjWMEejwx_PQ0VPPgof8EIR9yCk",
  authDomain: "harambeehub.firebaseapp.com",
  databaseURL: "https://harambeehub-default-rtdb.firebaseio.com",
  projectId: "harambeehub",
  storageBucket: "harambeehub.firebasestorage.app",
  messagingSenderId: "535430476286",
  appId: "1:535430476286:web:78429317bfcf05e6e6d0af",
  measurementId: "G-H7TBN6RQNF",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
