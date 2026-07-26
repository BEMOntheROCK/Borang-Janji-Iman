import { db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Generate a random 12-digit reference number formatted as xxxx-xxxx-xxxx
function generateRefNumber() {
    let digits = "";
    for (let i = 0; i < 12; i++) {
        digits += Math.floor(Math.random() * 10);
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

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

// Tier Selection Logic
const tierRadios = document.querySelectorAll('input[name="tier"]');
const customAmountInput = document.getElementById("jumlahJanjiIman");

tierRadios.forEach(radio => {
    radio.addEventListener("change", () => {
        if (radio.value === "custom") {
            customAmountInput.disabled = false;
            customAmountInput.focus();
        } else {
            customAmountInput.disabled = true;
            customAmountInput.value = "";
        }
    });
});

function getSelectedAmount() {
    const selected = document.querySelector('input[name="tier"]:checked');
    if (!selected) return 0;
    if (selected.value === "custom") {
        return parseFloat(customAmountInput.value) || 0;
    }
    return parseFloat(selected.value) || 0;
}

// Form Submit Handler
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nama = document.getElementById("nama").value.trim();
    const telefon = document.getElementById("telefon").value.trim();
    const emel = document.getElementById("emel").value.trim();
    const statusJemaat = document.getElementById("statusJemaat").value;
    const jumlahJanjiIman = getSelectedAmount();
    const perlukanResit = document.getElementById("perlukanResit").checked;

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
        showAlert("Sila isi maklumat nama, telefon, emel, status dan pilih/isi jumlah Janji Iman yang sah.", "danger");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sedang Dihantar...";

    try {
        let refNumber;
        let saved = false;
        let lastError = null;

        // Try a few times in the extremely unlikely event of a collision.
        // Firestore's security rules only allow "create" (not "update") for
        // public writes, so setDoc on an existing refNumber is rejected
        // automatically — this enforces uniqueness without needing read access.
        for (let attempt = 0; attempt < 5 && !saved; attempt++) {
            refNumber = generateRefNumber();
            try {
                await setDoc(doc(db, "pendaftaran", refNumber), {
                    refNumber: refNumber,
                    nama: nama,
                    telefon: telefon,
                    emel: emel,
                    statusJemaat: statusJemaat,
                    jumlahJanjiIman: jumlahJanjiIman,
                    perlukanResit: perlukanResit,
                    ansuran: ansuran,
                    createdAt: serverTimestamp()
                });
                saved = true;
            } catch (err) {
                lastError = err;
                if (err.code !== "permission-denied") {
                    throw err;
                }
                // permission-denied here means the ID already exists — retry with a new number
            }
        }

        if (!saved) {
            throw lastError || new Error("Gagal menjana nombor rujukan yang unik.");
        }

        showAlert(`Borang Janji Iman anda telah berjaya dihantar! Nombor rujukan anda: ${refNumber}. Terima kasih atas sokongan anda.`, "success");
        form.reset();
        customAmountInput.disabled = true;
    } catch (error) {
        console.error("Ralat semasa menyimpan:", error);
        showAlert("Berlaku ralat semasa menghantar borang. Sila cuba lagi.", "danger");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Hantar Janji Iman";
    }
});