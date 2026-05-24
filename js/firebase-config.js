import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpXHcYGge1DlBFVwSVfbva2NbrqsmvV8Y",
  authDomain: "pwa-fixfif.firebaseapp.com",
  projectId: "pwa-fixfif",
  storageBucket: "pwa-fixfif.firebasestorage.app",
  messagingSenderId: "633040068818",
  appId: "1:633040068818:web:ab3c45f7a2d2b92f3c0d0b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);