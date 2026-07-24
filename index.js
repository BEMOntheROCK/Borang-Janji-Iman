import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvZ2lRf7sNJEdlLwED_SpHCHVC8T-6guY",
  authDomain: "borang-janji-iman.firebaseapp.com",
  projectId: "borang-janji-iman",
  storageBucket: "borang-janji-iman.firebasestorage.app",
  messagingSenderId: "147857124075",
  appId: "1:147857124075:web:4c4c9f30d7a6d2e650acae"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elemen DOM
const form = document.getElementById("registration-form");
const submitBtn = document.getElementById("submit-btn");
const alertBox = document.getElementById("alert-box");

// Fungsi Mesej Amaran
function showAlert(message, type = "success") {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove("hidden");
    
    // Sembunyikan selepas 5 saat
    setTimeout(() => {
        alertBox.classList.add("hidden");
    }, 5000);
}

// Pengendali Hantar Borang
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nama = document.getElementById("nama").value.trim();
    const telefon = document.getElementById("telefon").value.trim();
    const emel = document.getElementById("emel").value.trim();
    const statusJemaat = document.getElementById("statusJemaat").value;

    if (!nama || !telefon || !emel || !statusJemaat) {
        showAlert("Sila lengkapkan semua medan ruangan di atas.", "danger");
        return;
    }

    // Tukar status butang semasa proses menyimpan
    submitBtn.disabled = true;
    submitBtn.textContent = "Sedang Dihantar...";

    try {
        await addDoc(collection(db, "pendaftaran"), {
            nama: nama,
            telefon: telefon,
            emel: emel,
            statusJemaat: statusJemaat,
            createdAt: serverTimestamp()
        });

        showAlert("Borang Janji Iman anda telah berjaya disimpan! Terima kasih.", "success");
        form.reset();
    } catch (error) {
        console.error("Ralat semasa menyimpan pendaftaran:", error);
        showAlert("Ralat berlaku semasa menghantar borang. Sila cuba lagi.", "danger");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Hantar Janji Iman";
    }
});