import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDVYy2WZkXfBkShGDuYhjy6eNZ_1--vEGE",
  authDomain: "apk-saver-89b42.firebaseapp.com",
  projectId: "apk-saver-89b42",
  storageBucket: "apk-saver-89b42.firebasestorage.app",
  messagingSenderId: "1077860662704",
  appId: "1:1077860662704:web:fb05516aee1b6c2aee6a75",
  measurementId: "G-0FM79DC8ZK",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export const ALLOWED_EMAIL = "mdromjan9522@gmail.com";
export const DEFAULT_PASSWORD = "kgfstar11";
