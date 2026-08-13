import { db } from "./firebase-config.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Reference number format: OTR-JI-MMDD-YY-XX
// MM/DD/YY come from today's date, XX is a sequential number (01, 02, 03...)
// that resets to 01 at the start of each new day. The sequence is tracked
// in a "refCounters" document (one per day, e.g. "081326" for 13 Aug 2026)
// and incremented atomically inside a Firestore transaction together with
// the record write, so two people submitting at the same moment can never
// end up with the same reference number.

function pad2(n) {
    return String(n).padStart(2, "0");
}

// Malaysia is a fixed UTC+8 offset (no daylight saving), so this stays
// correct regardless of the visitor's own device timezone/clock settings.
function getMalaysiaDateParts() {
    const nowUtcMs = Date.now();
    const myTime = new Date(nowUtcMs + 8 * 60 * 60 * 1000);
    const MM = pad2(myTime.getUTCMonth() + 1);
    const DD = pad2(myTime.getUTCDate());
    const YY = pad2(myTime.getUTCFullYear() % 100);
    return { MM, DD, YY, dayKey: `${MM}${DD}${YY}` };
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
    // Each month stores the planned amount ("jumlah") plus a payment status
    // flag ("dahBayar") that the admin panel toggles once that month is paid.
    const ansuran = {
        jul2026: { jumlah: parseFloat(document.getElementById("jul2026").value) || 0, dahBayar: false },
        ogos2026: { jumlah: parseFloat(document.getElementById("ogos2026").value) || 0, dahBayar: false },
        sept2026: { jumlah: parseFloat(document.getElementById("sept2026").value) || 0, dahBayar: false },
        okt2026: { jumlah: parseFloat(document.getElementById("okt2026").value) || 0, dahBayar: false },
        nov2026: { jumlah: parseFloat(document.getElementById("nov2026").value) || 0, dahBayar: false },
        dis2026: { jumlah: parseFloat(document.getElementById("dis2026").value) || 0, dahBayar: false },
    };

    if (!nama || !telefon || !emel || !statusJemaat || jumlahJanjiIman <= 0) {
        showAlert("Sila isi maklumat nama, telefon, emel, status dan pilih/isi jumlah Janji Iman yang sah.", "danger");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sedang Dihantar...";

    try {
        const { MM, DD, YY, dayKey } = getMalaysiaDateParts();
        const counterRef = doc(db, "refCounters", dayKey);
        let refNumber;

        // Atomically read-then-increment today's counter and create the
        // record in one transaction, so two simultaneous submissions can
        // never end up with the same sequence number / reference number.
        await runTransaction(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            const nextSeq = counterSnap.exists() ? counterSnap.data().seq + 1 : 1;
            refNumber = `OTR-JI-${MM}${DD}-${YY}-${pad2(nextSeq)}`;

            const pendaftaranRef = doc(db, "pendaftaran", refNumber);

            transaction.set(counterRef, { seq: nextSeq });
            transaction.set(pendaftaranRef, {
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
        });

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