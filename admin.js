import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "GANTIKAN_DENGAN_API_KEY_ANDA",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    storageBucket: "PROJECT_ID.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elemen DOM
const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("login-form");
const loginAlert = document.getElementById("login-alert");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const adminEmailDisplay = document.getElementById("admin-email-display");
const pendaftaranList = document.getElementById("pendaftaran-list");
const searchInput = document.getElementById("search-input");

// Elemen Statistik
const statTotal = document.getElementById("stat-total");
const statJemaat = document.getElementById("stat-jemaat");
const statBukan = document.getElementById("stat-bukan");

let allRecords = [];

// Tunjuk Amaran Log Masuk
function showLoginAlert(message, type = "danger") {
    loginAlert.textContent = message;
    loginAlert.className = `alert alert-${type}`;
    loginAlert.classList.remove("hidden");
}

// Semak Status Pengesahan Pengguna
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Semak sama ada peranan pengguna wujud dalam koleksi 'admins'
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                // Pengguna adalah pentadbir sah
                loginSection.classList.add("hidden");
                dashboardSection.classList.remove("hidden");
                adminEmailDisplay.textContent = user.email;
                loadRegistrationData();
            } else {
                // Bukan pentadbir
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

// Pengendali Borang Log Masuk
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

// Log Keluar
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Ralat log keluar:", error);
    }
});

// Memuatkan Data Pendaftaran dari Firestore
async function loadRegistrationData() {
    pendaftaranList.innerHTML = `<tr><td colspan="7" class="text-center">Sedang memuatkan data...</td></tr>`;

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
        pendaftaranList.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Gagal memuatkan data pendaftaran.</td></tr>`;
    }
}

// Kemaskini Kad Statistik
function updateStatistics(records) {
    const total = records.length;
    const jemaatCount = records.filter(r => r.statusJemaat === "Ya").length;
    const bukanCount = total - jemaatCount;

    statTotal.textContent = total;
    statJemaat.textContent = jemaatCount;
    statBukan.textContent = bukanCount;
}

// Papar Data ke dalam Jadual
function renderTable(records) {
    if (records.length === 0) {
        pendaftaranList.innerHTML = `<tr><td colspan="7" class="text-center">Tiada rekod pendaftaran ditemui.</td></tr>`;
        return;
    }

    pendaftaranList.innerHTML = "";
    records.forEach((data, index) => {
        const tr = document.createElement("tr");

        // Format Tarikh
        let dateFormatted = "N/A";
        if (data.createdAt && data.createdAt.toDate) {
            dateFormatted = data.createdAt.toDate().toLocaleDateString("ms-MY", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        const isJemaat = data.statusJemaat === "Ya";
        const badgeClass = isJemaat ? "badge-success" : "badge-secondary";

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(data.nama || "-")}</strong></td>
            <td>${escapeHtml(data.telefon || "-")}</td>
            <td>${escapeHtml(data.emel || "-")}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(data.statusJemaat || "-")}</span></td>
            <td>${dateFormatted}</td>
            <td>
                <button class="btn btn-delete btn-sm" data-id="${data.id}">Padam</button>
            </td>
        `;

        pendaftaranList.appendChild(tr);
    });

    // Tambah fungsi Padam
    document.querySelectorAll(".btn-delete").forEach(button => {
        button.addEventListener("click", async (e) => {
            const docId = e.target.getAttribute("data-id");
            if (confirm("Adakah anda pasti ingin memadam rekod ini?")) {
                try {
                    await deleteDoc(doc(db, "pendaftaran", docId));
                    loadRegistrationData();
                } catch (err) {
                    alert("Ralat semasa memadam rekod.");
                    console.error(err);
                }
            }
        });
    });
}

// Fungsi Cari / Tapis Rekod
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allRecords.filter(r => 
        (r.nama && r.nama.toLowerCase().includes(term)) ||
        (r.emel && r.emel.toLowerCase().includes(term)) ||
        (r.telefon && r.telefon.includes(term))
    );
    renderTable(filtered);
});

// Pembersihan Aksara HTML
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}