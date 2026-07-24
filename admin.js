import { db, auth } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc 
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
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                loginSection.classList.add("hidden");
                dashboardSection.classList.remove("hidden");
                adminEmailDisplay.textContent = user.email;
                loadRegistrationData();
            } else {
                await signOut(auth);
                showLoginAlert("Akses ditolak. Akaun anda tidak mempunyai peranan pentadbir.", "danger");
                loginSection.classList.remove("hidden");
                dashboardSection.classList.add("hidden");
            }
        } catch (error) {
            console.error("Ralat menyemak akses pentadbir:", error);
            await signOut(auth);
            showLoginAlert("Ralat semasa menyemak kebenaran pentadbir.", "danger");
        }
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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}