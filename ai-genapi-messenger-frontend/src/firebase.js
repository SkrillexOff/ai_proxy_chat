// Инициализация Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCDzl8mR94_b5CdpcfkfbyrYghsKW5uJIo",
  authDomain: "neurohub-4fd7c.firebaseapp.com",
  projectId: "neurohub-4fd7c",
  storageBucket: "neurohub-4fd7c.firebasestorage.app",
  messagingSenderId: "510763530281",
  appId: "1:510763530281:web:93a498a606638aca7c4438",
  measurementId: "G-CQBB467C70"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 