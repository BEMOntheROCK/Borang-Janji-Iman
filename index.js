import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Konfigurasi Firebase Anda
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
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
        alertBox.classList.add("hidden");
    }, 6000);
}

// Pengendali Hantar Borang
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nama = document.getElementById("nama").value.trim();
    const telefon = document.getElementById("telefon").value.trim();
    const emel = document.getElementById("emel").value.trim();
    const statusJemaat = document.getElementById("statusJemaat").value;
    const jumlahJanjiIman = parseFloat(document.getElementById("jumlahJanjiIman").value) || 0;

    // Ambil Pecahan Bulanan
    const ansuran = {
        jul2026: parseFloat(document.getElementById("jul2026").value) || 0,
        ogos2026: parseFloat(document.getElementById("ogos2026").value) || 0,
        sept2026: parseFloat(document.getElementById("sept2026").value) || 0,
        okt2026: parseFloat(document.getElementById("okt2026").value) || 0,
        nov2026: parseFloat(document.getElementById("nov2026").value) || 0,
        dis2026: parseFloat(document.getElementById("dis2026").value) || 0,
    };

    if (!nama || !telefon || !emel || !statusJemaat || jumlahJanjiIman <= 0) {
        showAlert("Sila isi maklumat nama, telefon, emel, status dan jumlah Janji Iman yang sah.", "danger");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sedang Dihantar...";

    try {
        await addDoc(collection(db, "pendaftaran"), {
            nama: nama,
            telefon: telefon,
            emel: emel,
            statusJemaat: statusJemaat,
            jumlahJanjiIman: jumlahJanjiIman,
            ansuran: ansuran,
            createdAt: serverTimestamp()
        });

        showAlert("Borang Janji Iman anda telah berjaya dihantar! Terima kasih atas sokongan anda.", "success");
        form.reset();
    } catch (error) {
        console.error("Ralat semasa menyimpan:", error);
        showAlert("Berlaku ralat semasa menghantar borang. Sila cuba lagi.", "danger");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Hantar Janji Iman";
    }
});