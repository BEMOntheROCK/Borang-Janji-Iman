import { db, auth } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";
import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";

// DOM Elements
const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("login-form");
const loginAlert = document.getElementById("login-alert");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const adminEmailDisplay = document.getElementById("admin-email-display");
const pendaftaranList = document.getElementById("pendaftaran-list");
const searchInput = document.getElementById("search-input");

// Statistic Elements
const statTotalAmount = document.getElementById("stat-total-amount");
const statTotalCount = document.getElementById("stat-total-count");
const statJemaat = document.getElementById("stat-jemaat");
const statPelawat = document.getElementById("stat-pelawat");

let allRecords = [];

// Each month in "ansuran" is stored as { jumlah, dahBayar }. These helpers
// read that shape safely (older records are migrated via the migration
// script, but we guard here too in case a record is ever missing a field).
function getJumlah(month) {
    if (month && typeof month === "object") return Number(month.jumlah || 0);
    return Number(month || 0);
}
function isPaid(month) {
    return !!(month && typeof month === "object" && month.dahBayar);
}
function isPledged(month) {
    return getJumlah(month) > 0;
}

function showLoginAlert(message, type = "danger") {
    loginAlert.textContent = message;
    loginAlert.className = `alert alert-${type}`;
    loginAlert.classList.remove("hidden");
}

// Check Admin Authentication Status
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginSection.classList.add("hidden");
        dashboardSection.classList.remove("hidden");
        adminEmailDisplay.textContent = user.email;
        loadRegistrationData();
    } else {
        loginSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");
    }
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Sedang Log Masuk...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Ralat log masuk:", error);
        showLoginAlert("Log masuk gagal. Sila semak e-mel dan kata laluan anda.", "danger");
        loginBtn.disabled = false;
        loginBtn.textContent = "Log Masuk";
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Ralat log keluar:", error);
    }
});

async function loadRegistrationData() {
    pendaftaranList.innerHTML = `<tr><td colspan="10" class="text-center">Sedang memuatkan data...</td></tr>`;

    try {
        const q = query(collection(db, "pendaftaran"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allRecords = [];
        querySnapshot.forEach((docSnap) => {
            allRecords.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        updateStatistics(allRecords);
        renderTable(allRecords);
    } catch (error) {
        console.error("Ralat memuatkan data:", error);
        pendaftaranList.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Gagal memuatkan data.</td></tr>`;
    }
}

function updateStatistics(records) {
    const totalCount = records.length;
    let totalSum = 0;
    let jemaatCount = 0;
    let pelawatCount = 0;

    records.forEach(r => {
        totalSum += Number(r.jumlahJanjiIman || 0);
        if (r.statusJemaat === "Jemaat") jemaatCount++;
        else pelawatCount++;
    });

    statTotalAmount.textContent = `RM ${totalSum.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`;
    statTotalCount.textContent = totalCount;
    statJemaat.textContent = jemaatCount;
    statPelawat.textContent = pelawatCount;
}

function renderTable(records) {
    if (records.length === 0) {
        pendaftaranList.innerHTML = `<tr><td colspan="10" class="text-center">Tiada rekod ditemui.</td></tr>`;
        return;
    }

    pendaftaranList.innerHTML = "";
    records.forEach((data, index) => {
        const tr = document.createElement("tr");

        let dateFormatted = "N/A";
        if (data.createdAt && data.createdAt.toDate) {
            dateFormatted = data.createdAt.toDate().toLocaleDateString("ms-MY", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        }

        const isJemaat = data.statusJemaat === "Jemaat";
        const badgeClass = isJemaat ? "badge-success" : "badge-secondary";
        const totalRM = Number(data.jumlahJanjiIman || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 });

        const ans = data.ansuran || {};
        const ansuranSummary = `Jul: ${getJumlah(ans.jul2026)} | Ogos: ${getJumlah(ans.ogos2026)} | Sept: ${getJumlah(ans.sept2026)} | Okt: ${getJumlah(ans.okt2026)} | Nov: ${getJumlah(ans.nov2026)} | Dis: ${getJumlah(ans.dis2026)}`;
        const resitBadge = data.perlukanResit
            ? `<span class="badge badge-warning">Perlu</span>`
            : `<span class="badge badge-secondary">Tidak</span>`;

        const monthKeys = ["jul2026", "ogos2026", "sept2026", "okt2026", "nov2026", "dis2026"];
        const pledgedMonths = monthKeys.filter(k => isPledged(ans[k]));
        const paidCount = pledgedMonths.filter(k => isPaid(ans[k])).length;
        const totalPledgedMonths = pledgedMonths.length;
        const isFullyPaid = totalPledgedMonths > 0 && paidCount === totalPledgedMonths;
        const bayaranBadgeClass = totalPledgedMonths === 0
            ? "badge-secondary"
            : (paidCount === 0 ? "badge-secondary" : (isFullyPaid ? "badge-success" : "badge-warning"));
        const bayaranBadge = isFullyPaid
            ? `<span class="badge ${bayaranBadgeClass}">Selesai</span>`
            : `<span class="badge ${bayaranBadgeClass}">${paidCount}/${totalPledgedMonths} Dibayar</span>`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml((data.nama || "-").toUpperCase())}</strong></td>
            <td>${escapeHtml(data.telefon || "-")}<br><small>${escapeHtml(data.emel || "-")}</small></td>
            <td><span class="badge ${badgeClass}">${escapeHtml(data.statusJemaat || "-")}</span></td>
            <td><strong>RM ${totalRM}</strong></td>
            <td><small>${ansuranSummary}</small></td>
            <td>${bayaranBadge}</td>
            <td>${resitBadge}</td>
            <td>${dateFormatted}</td>
            <td>
                <button class="btn-icon-view" data-id="${data.id}" title="Lihat Butiran" aria-label="Lihat Butiran">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </td>
        `;

        pendaftaranList.appendChild(tr);
    });

    document.querySelectorAll(".btn-icon-view").forEach(button => {
        button.addEventListener("click", (e) => {
            const docId = e.currentTarget.getAttribute("data-id");
            openViewModal(docId);
        });
    });
}

searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allRecords.filter(r => 
        (r.nama && r.nama.toLowerCase().includes(term)) ||
        (r.emel && r.emel.toLowerCase().includes(term)) ||
        (r.telefon && r.telefon.includes(term))
    );
    renderTable(filtered);
});

// --- Edit Modal Logic ---
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editAlert = document.getElementById("edit-alert");
const editCancelBtn = document.getElementById("edit-cancel-btn");
const editSaveBtn = document.getElementById("edit-save-btn");

function showEditAlert(message, type = "danger") {
    editAlert.textContent = message;
    editAlert.className = `alert alert-${type}`;
    editAlert.classList.remove("hidden");
}

function openEditModal(docId) {
    const record = allRecords.find(r => r.id === docId);
    if (!record) return;

    editAlert.classList.add("hidden");
    document.getElementById("edit-id").value = record.id;
    document.getElementById("edit-refnumber").value = record.refNumber || record.id;
    document.getElementById("edit-nama").value = (record.nama || "").toUpperCase();
    document.getElementById("edit-telefon").value = record.telefon || "";
    document.getElementById("edit-status").value = record.statusJemaat || "Jemaat";
    document.getElementById("edit-emel").value = record.emel || "";
    document.getElementById("edit-jumlah").value = record.jumlahJanjiIman || 0;
    document.getElementById("edit-perlukanResit").checked = !!record.perlukanResit;

    const ans = record.ansuran || {};
    document.getElementById("edit-jul2026").value = getJumlah(ans.jul2026) || "";
    document.getElementById("edit-ogos2026").value = getJumlah(ans.ogos2026) || "";
    document.getElementById("edit-sept2026").value = getJumlah(ans.sept2026) || "";
    document.getElementById("edit-okt2026").value = getJumlah(ans.okt2026) || "";
    document.getElementById("edit-nov2026").value = getJumlah(ans.nov2026) || "";
    document.getElementById("edit-dis2026").value = getJumlah(ans.dis2026) || "";

    editModal.classList.remove("hidden");
}

function closeEditModal() {
    editModal.classList.add("hidden");
}

// "Kembali" — go back to the view modal for the same record instead of
// closing everything, since edit is usually opened from within view.
editCancelBtn.addEventListener("click", () => {
    const docId = document.getElementById("edit-id").value;
    closeEditModal();
    if (docId) {
        openViewModal(docId);
    }
});
editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
});

// --- View Modal Logic ---
const viewModal = document.getElementById("view-modal");
const viewCloseBtn = document.getElementById("view-close-btn");
const viewEditBtn = document.getElementById("view-edit-btn");
const viewResitBtn = document.getElementById("view-resit-btn");
const viewDeleteBtn = document.getElementById("view-delete-btn");
const bayaranSaveBtn = document.getElementById("bayaran-save-btn");
const bayaranAlert = document.getElementById("bayaran-alert");

let currentViewDocId = null;

function openViewModal(docId) {
    const record = allRecords.find(r => r.id === docId);
    if (!record) return;

    currentViewDocId = docId;

    let dateFormatted = "N/A";
    if (record.createdAt && record.createdAt.toDate) {
        dateFormatted = record.createdAt.toDate().toLocaleDateString("ms-MY", {
            day: "2-digit", month: "2-digit", year: "numeric"
        });
    }

    const totalRM = Number(record.jumlahJanjiIman || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 });
    const ans = record.ansuran || {};

    document.getElementById("view-refnumber").textContent = record.refNumber || record.id;
    document.getElementById("view-nama").textContent = (record.nama || "-").toUpperCase();
    document.getElementById("view-telefon").textContent = record.telefon || "-";
    document.getElementById("view-emel").textContent = record.emel || "-";
    document.getElementById("view-status").textContent = record.statusJemaat || "-";
    document.getElementById("view-jumlah").textContent = `RM ${totalRM}`;
    document.getElementById("view-resit").textContent = record.perlukanResit ? "Perlu" : "Tidak";
    document.getElementById("view-tarikh").textContent = dateFormatted;
    document.getElementById("view-jul2026").textContent = `RM ${getJumlah(ans.jul2026).toFixed(2)}`;
    document.getElementById("view-ogos2026").textContent = `RM ${getJumlah(ans.ogos2026).toFixed(2)}`;
    document.getElementById("view-sept2026").textContent = `RM ${getJumlah(ans.sept2026).toFixed(2)}`;
    document.getElementById("view-okt2026").textContent = `RM ${getJumlah(ans.okt2026).toFixed(2)}`;
    document.getElementById("view-nov2026").textContent = `RM ${getJumlah(ans.nov2026).toFixed(2)}`;
    document.getElementById("view-dis2026").textContent = `RM ${getJumlah(ans.dis2026).toFixed(2)}`;

    // Payment-status checkboxes — ticked if that month has been marked paid.
    // Months the donor didn't actually pledge anything for (RM 0) are
    // disabled/greyed out since there's nothing to mark as paid.
    const monthCheckboxKeys = ["jul2026", "ogos2026", "sept2026", "okt2026", "nov2026", "dis2026"];
    monthCheckboxKeys.forEach(key => {
        const checkbox = document.getElementById(`bayar-${key}`);
        const pledged = isPledged(ans[key]);
        checkbox.checked = pledged && isPaid(ans[key]);
        checkbox.disabled = !pledged;
        checkbox.closest(".checkbox-label").classList.toggle("month-input-disabled", !pledged);
    });
    bayaranAlert.classList.add("hidden");

    viewModal.classList.remove("hidden");
}

function closeViewModal() {
    viewModal.classList.add("hidden");
    currentViewDocId = null;
}

viewCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeViewModal();
});
viewModal.addEventListener("click", (e) => {
    if (e.target === viewModal) closeViewModal();
});

// "Kemas Kini" inside the view modal — switch to the edit modal for the same record
viewEditBtn.addEventListener("click", () => {
    if (!currentViewDocId) return;
    const docId = currentViewDocId;
    closeViewModal();
    openEditModal(docId);
});

// "Padam" inside the view modal — confirm and delete
viewDeleteBtn.addEventListener("click", async () => {
    if (!currentViewDocId) return;
    if (confirm("Adakah anda pasti ingin memadam rekod ini?")) {
        try {
            await deleteDoc(doc(db, "pendaftaran", currentViewDocId));
            closeViewModal();
            loadRegistrationData();
        } catch (err) {
            console.error("Ralat memadam:", err);
            alert("Ralat semasa memadam.");
        }
    }
});

// Shared save logic used by both "Simpan Status Bayaran" (saves whatever
// the checkboxes currently show) and "Tandakan Bayaran Selesai" (which
// first ticks every pledged month, then calls this to save).
async function saveBayaranStatus(triggerBtn, triggerBtnDefaultLabel) {
    if (!currentViewDocId) return;
    const record = allRecords.find(r => r.id === currentViewDocId);
    if (!record) return;

    const ans = record.ansuran || {};
    const monthKeys = ["jul2026", "ogos2026", "sept2026", "okt2026", "nov2026", "dis2026"];
    const updatedAnsuran = {};
    monthKeys.forEach(key => {
        updatedAnsuran[key] = {
            jumlah: getJumlah(ans[key]),
            dahBayar: document.getElementById(`bayar-${key}`).checked
        };
    });

    triggerBtn.disabled = true;
    triggerBtn.textContent = "Menyimpan...";

    try {
        await updateDoc(doc(db, "pendaftaran", currentViewDocId), { ansuran: updatedAnsuran });
        record.ansuran = updatedAnsuran;
        bayaranAlert.textContent = "Status bayaran berjaya disimpan.";
        bayaranAlert.className = "alert alert-success";
        bayaranAlert.classList.remove("hidden");
        renderTable(allRecords);
    } catch (err) {
        console.error("Ralat menyimpan status bayaran:", err);
        bayaranAlert.textContent = "Ralat semasa menyimpan status bayaran.";
        bayaranAlert.className = "alert alert-danger";
        bayaranAlert.classList.remove("hidden");
    } finally {
        triggerBtn.disabled = false;
        triggerBtn.textContent = triggerBtnDefaultLabel;
    }
}

// "Simpan Status Bayaran" inside the view modal — save the paid/unpaid
// checkboxes for each month, keeping the planned "jumlah" amount unchanged.
bayaranSaveBtn.addEventListener("click", () => {
    saveBayaranStatus(bayaranSaveBtn, "Simpan Status Bayaran");
});

// "Resit" inside the view modal — export the donor's details as a PDF receipt
viewResitBtn.addEventListener("click", () => {
    if (!currentViewDocId) return;
    const record = allRecords.find(r => r.id === currentViewDocId);
    if (!record) return;
    generateResitPdf(record);
});

function generateResitPdf(record) {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const refNumber = record.refNumber || record.id;
    const totalRM = Number(record.jumlahJanjiIman || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 });
    const ans = record.ansuran || {};

    let dateFormatted = "N/A";
    if (record.createdAt && record.createdAt.toDate) {
        dateFormatted = record.createdAt.toDate().toLocaleDateString("ms-MY", {
            day: "2-digit", month: "2-digit", year: "numeric"
        });
    }

    const marginX = 50;
    let y = 60;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("BEM On The ROCK", marginX, y);

    y += 22;
    pdf.setFontSize(14);
    pdf.text("Resit Janji Iman - Projek Bangunan Baharu", marginX, y);

    y += 30;
    pdf.setDrawColor(200);
    pdf.line(marginX, y, 545, y);

    y += 30;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    const row = (label, value) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(label, marginX, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(value), marginX + 160, y);
        y += 22;
    };

    row("No. Rujukan:", refNumber);
    row("Nama Penuh:", (record.nama || "-").toUpperCase());
    row("No. Telefon:", record.telefon || "-");
    row("Alamat E-mel:", record.emel || "-");
    row("Status Keahlian:", record.statusJemaat || "-");
    row("Tarikh Daftar:", dateFormatted);

    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`Jumlah Janji Iman: RM ${totalRM}`, marginX, y);

    y += 30;
    pdf.setFontSize(11);
    pdf.text("Pecahan Ansuran Bulanan (Julai - Disember 2026)", marginX, y);
    y += 10;
    pdf.line(marginX, y, 545, y);
    y += 22;

    const months = [
        ["Julai 2026", ans.jul2026],
        ["Ogos 2026", ans.ogos2026],
        ["September 2026", ans.sept2026],
        ["Oktober 2026", ans.okt2026],
        ["November 2026", ans.nov2026],
        ["Disember 2026", ans.dis2026],
    ];

    pdf.setFont("helvetica", "normal");
    months.forEach(([label, month]) => {
        pdf.text(label, marginX, y);
        pdf.text(`RM ${getJumlah(month).toFixed(2)}`, marginX + 200, y);
        pdf.text(isPaid(month) ? "Dibayar" : "Belum Dibayar", marginX + 320, y);
        y += 20;
    });

    y += 30;
    pdf.setDrawColor(200);
    pdf.line(marginX, y, 545, y);
    y += 20;
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(`Resit ini dijana secara automatik pada ${new Date().toLocaleDateString("ms-MY")}.`, marginX, y);

    pdf.save(`Resit_${refNumber}.pdf`);
}

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const docId = document.getElementById("edit-id").value;
    const nama = document.getElementById("edit-nama").value.trim();
    const telefon = document.getElementById("edit-telefon").value.trim();
    const statusJemaat = document.getElementById("edit-status").value;
    const emel = document.getElementById("edit-emel").value.trim();
    const jumlahJanjiIman = parseFloat(document.getElementById("edit-jumlah").value) || 0;
    const perlukanResit = document.getElementById("edit-perlukanResit").checked;

    // Keep each month's existing "dahBayar" status untouched — this form only
    // edits the planned amounts, not payment status (that's done from the
    // view modal's payment checkboxes instead).
    const existingRecord = allRecords.find(r => r.id === docId);
    const existingAns = (existingRecord && existingRecord.ansuran) || {};
    const ansuran = {
        jul2026: { jumlah: parseFloat(document.getElementById("edit-jul2026").value) || 0, dahBayar: isPaid(existingAns.jul2026) },
        ogos2026: { jumlah: parseFloat(document.getElementById("edit-ogos2026").value) || 0, dahBayar: isPaid(existingAns.ogos2026) },
        sept2026: { jumlah: parseFloat(document.getElementById("edit-sept2026").value) || 0, dahBayar: isPaid(existingAns.sept2026) },
        okt2026: { jumlah: parseFloat(document.getElementById("edit-okt2026").value) || 0, dahBayar: isPaid(existingAns.okt2026) },
        nov2026: { jumlah: parseFloat(document.getElementById("edit-nov2026").value) || 0, dahBayar: isPaid(existingAns.nov2026) },
        dis2026: { jumlah: parseFloat(document.getElementById("edit-dis2026").value) || 0, dahBayar: isPaid(existingAns.dis2026) },
    };

    if (!nama || !telefon || !emel || !statusJemaat || jumlahJanjiIman <= 0) {
        showEditAlert("Sila lengkapkan semua maklumat wajib dengan betul.", "danger");
        return;
    }

    editSaveBtn.disabled = true;
    editSaveBtn.textContent = "Menyimpan...";

    try {
        await updateDoc(doc(db, "pendaftaran", docId), {
            nama, telefon, emel, statusJemaat, jumlahJanjiIman, perlukanResit, ansuran
        });
        closeEditModal();
        loadRegistrationData();
    } catch (err) {
        console.error("Ralat mengemaskini rekod:", err);
        showEditAlert("Ralat semasa menyimpan perubahan. Sila cuba lagi.", "danger");
    } finally {
        editSaveBtn.disabled = false;
        editSaveBtn.textContent = "Simpan Perubahan";
    }
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
// --- Eksport Data (PDF / XLSX) ---
const exportBtn = document.getElementById("export-btn");
const exportModal = document.getElementById("export-modal");
const exportCloseBtn = document.getElementById("export-close-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const exportXlsxBtn = document.getElementById("export-xlsx-btn");

// Full column set (used for XLSX — one amount + one paid-status column per installment month)
const EXPORT_COLUMNS_XLSX = [
    "Bil.", "No. Rujukan", "Nama Penuh", "No. Telefon", "Alamat E-mel", "Status",
    "Jumlah Janji Iman (RM)",
    "Jul 2026", "Jul Dibayar?", "Ogos 2026", "Ogos Dibayar?", "Sept 2026", "Sept Dibayar?",
    "Okt 2026", "Okt Dibayar?", "Nov 2026", "Nov Dibayar?", "Dis 2026", "Dis Dibayar?",
    "Perlukan Resit", "Tarikh Daftar"
];

// Condensed column set (used for PDF — installments combined into one column so it fits the page)
const EXPORT_COLUMNS_PDF = [
    "Bil.", "No. Rujukan", "Nama Penuh", "No. Telefon", "Alamat E-mel", "Status",
    "Jumlah (RM)", "Pecahan Ansuran (Jul - Dis 2026)", "Resit", "Tarikh"
];

function formatDate(record) {
    if (record.createdAt && record.createdAt.toDate) {
        return record.createdAt.toDate().toLocaleDateString("ms-MY", {
            day: "2-digit", month: "2-digit", year: "numeric"
        });
    }
    return "N/A";
}

function buildExportRowsXlsx() {
    return allRecords.map((record, index) => {
        const ans = record.ansuran || {};
        const dibayarLabel = (month) => isPaid(month) ? "Ya" : "Tidak";
        return [
            index + 1,
            record.refNumber || record.id,
            (record.nama || "-").toUpperCase(),
            record.telefon || "-",
            record.emel || "-",
            record.statusJemaat || "-",
            Number(record.jumlahJanjiIman || 0).toFixed(2),
            getJumlah(ans.jul2026).toFixed(2), dibayarLabel(ans.jul2026),
            getJumlah(ans.ogos2026).toFixed(2), dibayarLabel(ans.ogos2026),
            getJumlah(ans.sept2026).toFixed(2), dibayarLabel(ans.sept2026),
            getJumlah(ans.okt2026).toFixed(2), dibayarLabel(ans.okt2026),
            getJumlah(ans.nov2026).toFixed(2), dibayarLabel(ans.nov2026),
            getJumlah(ans.dis2026).toFixed(2), dibayarLabel(ans.dis2026),
            record.perlukanResit ? "Perlu" : "Tidak",
            formatDate(record)
        ];
    });
}

function buildExportRowsPdf() {
    return allRecords.map((record, index) => {
        const ans = record.ansuran || {};
        // "*" marks a month as already paid, e.g. "Jul:500*"
        const m = (month) => `${getJumlah(month).toFixed(0)}${isPaid(month) ? "*" : ""}`;
        const ansuranSummary =
            `Jul:${m(ans.jul2026)} | Ogos:${m(ans.ogos2026)} | ` +
            `Sept:${m(ans.sept2026)} | Okt:${m(ans.okt2026)} | ` +
            `Nov:${m(ans.nov2026)} | Dis:${m(ans.dis2026)}`;

        return [
            String(index + 1),
            String(record.refNumber || record.id),
            (record.nama || "-").toUpperCase(),
            record.telefon || "-",
            record.emel || "-",
            record.statusJemaat || "-",
            Number(record.jumlahJanjiIman || 0).toFixed(2),
            ansuranSummary,
            record.perlukanResit ? "Perlu" : "Tidak",
            formatDate(record)
        ];
    });
}

function openExportModal() {
    exportModal.classList.remove("hidden");
}

function closeExportModal() {
    exportModal.classList.add("hidden");
}

exportBtn.addEventListener("click", openExportModal);
exportCloseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeExportModal();
});
exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) closeExportModal();
});

exportXlsxBtn.addEventListener("click", () => {
    if (!allRecords.length) {
        alert("Tiada rekod untuk dieksport.");
        return;
    }

    const rows = buildExportRowsXlsx();
    const worksheetData = [EXPORT_COLUMNS_XLSX, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Janji Iman");

    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Senarai_Janji_Iman_${todayStr}.xlsx`);

    closeExportModal();
});

// Hand-rolled PDF table (no external plugin — jspdf-autotable's CDN build
// proved unreliable, so this draws rows/columns directly with jsPDF's own
// text + line primitives, including pagination and header repeat).
function drawPdfTable(pdf, columns, rows) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 30;
    const marginBottom = 40;
    const usableWidth = pageWidth - marginX * 2;

    // Column width ratios (must sum to 1) — tuned for the 10 PDF columns
    const ratios = [0.03, 0.10, 0.14, 0.09, 0.15, 0.07, 0.08, 0.22, 0.06, 0.06];
    const colWidths = ratios.map(r => usableWidth * r);

    const fontSize = 7;
    const cellPaddingX = 4;
    const lineHeight = 10;
    const headerRowHeight = 20;

    pdf.setFontSize(fontSize);

    function wrapText(text, width) {
        const maxWidth = width - cellPaddingX * 2;
        return pdf.splitTextToSize(String(text), maxWidth);
    }

    function drawHeader(y) {
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(17, 17, 132);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(marginX, y, usableWidth, headerRowHeight, "F");

        let x = marginX;
        columns.forEach((col, i) => {
            pdf.text(col, x + cellPaddingX, y + 13, { maxWidth: colWidths[i] - cellPaddingX * 2 });
            x += colWidths[i];
        });

        pdf.setTextColor(30, 41, 59);
        pdf.setFont("helvetica", "normal");
        return y + headerRowHeight;
    }

    let y = drawHeader(60);
    let rowIndex = 0;

    rows.forEach((row) => {
        // Pre-compute wrapped lines per cell to know this row's height
        const wrappedCells = row.map((cell, i) => wrapText(cell, colWidths[i]));
        const rowLines = Math.max(...wrappedCells.map(lines => lines.length));
        const rowHeight = Math.max(16, rowLines * lineHeight + 6);

        // Page break if this row won't fit
        if (y + rowHeight > pageHeight - marginBottom) {
            pdf.addPage();
            y = drawHeader(40);
        }

        // Alternating row background
        if (rowIndex % 2 === 1) {
            pdf.setFillColor(245, 247, 250);
            pdf.rect(marginX, y, usableWidth, rowHeight, "F");
        }

        let x = marginX;
        wrappedCells.forEach((lines, i) => {
            pdf.text(lines, x + cellPaddingX, y + 11);
            x += colWidths[i];
        });

        // Row divider line
        pdf.setDrawColor(226, 232, 240);
        pdf.line(marginX, y + rowHeight, marginX + usableWidth, y + rowHeight);

        y += rowHeight;
        rowIndex++;
    });
}

exportPdfBtn.addEventListener("click", () => {
    if (!allRecords.length) {
        alert("Tiada rekod untuk dieksport.");
        return;
    }

    const rows = buildExportRowsPdf();
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(17, 17, 132);
    pdf.text("BEM On The ROCK - Senarai Rekod Janji Iman", 30, 30);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Dijana pada: ${new Date().toLocaleDateString("ms-MY")}  |  Jumlah Rekod: ${allRecords.length}  |  * = Sudah Dibayar`, 30, 44);

    drawPdfTable(pdf, EXPORT_COLUMNS_PDF, rows);

    const todayStr = new Date().toISOString().slice(0, 10);
    pdf.save(`Senarai_Janji_Iman_${todayStr}.pdf`);

    closeExportModal();
});