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
    pendaftaranList.innerHTML = `<tr><td colspan="8" class="text-center">Sedang memuatkan data...</td></tr>`;

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
        pendaftaranList.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuatkan data.</td></tr>`;
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
        pendaftaranList.innerHTML = `<tr><td colspan="8" class="text-center">Tiada rekod ditemui.</td></tr>`;
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
        const ansuranSummary = `Jul: ${ans.jul2026||0} | Ogos: ${ans.ogos2026||0} | Sept: ${ans.sept2026||0} | Okt: ${ans.okt2026||0} | Nov: ${ans.nov2026||0} | Dis: ${ans.dis2026||0}`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(data.nama || "-")}</strong></td>
            <td>${escapeHtml(data.telefon || "-")}<br><small>${escapeHtml(data.emel || "-")}</small></td>
            <td><span class="badge ${badgeClass}">${escapeHtml(data.statusJemaat || "-")}</span></td>
            <td><strong>RM ${totalRM}</strong></td>
            <td><small>${ansuranSummary}</small></td>
            <td>${dateFormatted}</td>
            <td>
                <button class="btn btn-edit btn-sm" data-id="${data.id}">Kemaskini</button>
                <button class="btn btn-delete btn-sm" data-id="${data.id}">Padam</button>
            </td>
        `;

        pendaftaranList.appendChild(tr);
    });

    document.querySelectorAll(".btn-delete").forEach(button => {
        button.addEventListener("click", async (e) => {
            const docId = e.target.getAttribute("data-id");
            if (confirm("Adakah anda pasti ingin memadam rekod ini?")) {
                try {
                    await deleteDoc(doc(db, "pendaftaran", docId));
                    loadRegistrationData();
                } catch (err) {
                    alert("Ralat semasa memadam.");
                }
            }
        });
    });

    document.querySelectorAll(".btn-edit").forEach(button => {
        button.addEventListener("click", (e) => {
            const docId = e.target.getAttribute("data-id");
            openEditModal(docId);
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
    document.getElementById("edit-nama").value = record.nama || "";
    document.getElementById("edit-telefon").value = record.telefon || "";
    document.getElementById("edit-status").value = record.statusJemaat || "Jemaat";
    document.getElementById("edit-emel").value = record.emel || "";
    document.getElementById("edit-jumlah").value = record.jumlahJanjiIman || 0;

    const ans = record.ansuran || {};
    document.getElementById("edit-jul2026").value = ans.jul2026 || "";
    document.getElementById("edit-ogos2026").value = ans.ogos2026 || "";
    document.getElementById("edit-sept2026").value = ans.sept2026 || "";
    document.getElementById("edit-okt2026").value = ans.okt2026 || "";
    document.getElementById("edit-nov2026").value = ans.nov2026 || "";
    document.getElementById("edit-dis2026").value = ans.dis2026 || "";

    editModal.classList.remove("hidden");
}

function closeEditModal() {
    editModal.classList.add("hidden");
}

editCancelBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
});

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const docId = document.getElementById("edit-id").value;
    const nama = document.getElementById("edit-nama").value.trim();
    const telefon = document.getElementById("edit-telefon").value.trim();
    const statusJemaat = document.getElementById("edit-status").value;
    const emel = document.getElementById("edit-emel").value.trim();
    const jumlahJanjiIman = parseFloat(document.getElementById("edit-jumlah").value) || 0;

    const ansuran = {
        jul2026: parseFloat(document.getElementById("edit-jul2026").value) || 0,
        ogos2026: parseFloat(document.getElementById("edit-ogos2026").value) || 0,
        sept2026: parseFloat(document.getElementById("edit-sept2026").value) || 0,
        okt2026: parseFloat(document.getElementById("edit-okt2026").value) || 0,
        nov2026: parseFloat(document.getElementById("edit-nov2026").value) || 0,
        dis2026: parseFloat(document.getElementById("edit-dis2026").value) || 0,
    };

    if (!nama || !telefon || !emel || !statusJemaat || jumlahJanjiIman <= 0) {
        showEditAlert("Sila lengkapkan semua maklumat wajib dengan betul.", "danger");
        return;
    }

    editSaveBtn.disabled = true;
    editSaveBtn.textContent = "Menyimpan...";

    try {
        await updateDoc(doc(db, "pendaftaran", docId), {
            nama, telefon, emel, statusJemaat, jumlahJanjiIman, ansuran
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