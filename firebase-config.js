import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Put your Firebase credentials here once
const firebaseConfig = {
  apiKey: "AIzaSyDvZ2lRf7sNJEdlLwED_SpHCHVC8T-6guY",
  authDomain: "borang-janji-iman.firebaseapp.com",
  projectId: "borang-janji-iman",
  storageBucket: "borang-janji-iman.firebasestorage.app",
  messagingSenderId: "147857124075",
  appId: "1:147857124075:web:4c4c9f30d7a6d2e650acae"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export Firestore and Auth instances for other files to use
export const db = getFirestore(app);
export const auth = getAuth(app);