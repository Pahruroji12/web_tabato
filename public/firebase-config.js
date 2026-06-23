// ============================================================
// KONFIGURASI FIREBASE - TABTO
// ============================================================
// 1. Buka https://console.firebase.google.com
// 2. Buat project baru (atau pakai yang sudah ada)
// 3. Tambahkan "Web App" (ikon </>) di project settings
// 4. Copy konfigurasi yang muncul ke bawah ini
// 5. Aktifkan "Cloud Firestore" di menu Build > Firestore Database
//    -> pilih "Start in test mode" untuk development awal
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBhGRwrKjP-yVO0RRuk856ehyIZBA6-uHQ",
  authDomain: "tabato-unpam.firebaseapp.com",
  projectId: "tabato-unpam",
  storageBucket: "tabato-unpam.firebasestorage.app",
  messagingSenderId: "1084795358200",
  appId: "1:1084795358200:web:3d32672f302a7dd34de40d",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
  Timestamp,
  getAggregateFromServer,
  sum,
  limit,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache(), // Menggunakan single-tab manager agar aman dan tidak freeze di browser HP
  });
} catch (e) {
  console.warn("Firestore persistent local cache tidak didukung (Brave Shields/Private Mode). Menggunakan memoryLocalCache sebagai fallback.", e);
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
}
const auth = getAuth(app);


export {
  db,
  auth,
  signInWithEmailAndPassword,
  updatePassword,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
  Timestamp,
  getAggregateFromServer,
  sum,
  limit,
  runTransaction,
};




