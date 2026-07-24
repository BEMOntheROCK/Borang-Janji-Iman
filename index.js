import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const form = document.getElementById("registration-form");
const submitBtn = document.getElementById("submit-btn");
const alertBox = document.getElementById("alert-box");

// Alert helper function
function showAlert(message, type = "success") {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove("hidden");
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
        alertBox.classList.add("hidden");
    }, 6000);
}

// Form Submit Handler
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nama = document.getElementById("nama").value.trim();
    const telefon = document.getElementById("telefon").value.trim();
    const emel = document.getElementById("emel").value.trim();
    const statusJemaat = document.getElementById("statusJemaat").value;
    const jumlahJanjiIman = parseFloat(document.getElementById("jumlahJanjiIman").value) || 0;

    // Monthly Installment Breakdown
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