/**
 * ONE-TIME MIGRATION SCRIPT
 * Converts every month inside the "ansuran" field (jul2026, ogos2026,
 * sept2026, okt2026, nov2026, dis2026) from a plain number:
 *
 *      ansuran: { jul2026: 500, ogos2026: 500, ... }
 *
 * into an object that also tracks whether that month has been paid:
 *
 *      ansuran: { jul2026: { jumlah: 500, dahBayar: false }, ... }
 *
 * Records that are already in the new format are left untouched.
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────────────
 * 1. In the Firebase Console: Project Settings → Service Accounts →
 *    "Generate new private key". Save the downloaded JSON file as
 *    `serviceAccountKey.json` in this same folder (skip this step if you
 *    already have it from running migrate-add-refnumber.js before).
 *    ⚠️ Do NOT commit serviceAccountKey.json to GitHub — it grants full
 *    admin access to your Firebase project. Add it to .gitignore.
 *
 * 2. Install the Admin SDK (skip if already installed):
 *      npm install firebase-admin
 *
 * 3. Run:
 *      node migrate-add-payment-status.js
 *
 *    Add --dry-run to preview changes without writing anything:
 *      node migrate-add-payment-status.js --dry-run
 * ─────────────────────────────────────────────────────────────────────────
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

const app = initializeApp({
    credential: cert(serviceAccount),
});

const db = getFirestore(app);
const isDryRun = process.argv.includes("--dry-run");

const MONTH_KEYS = ["jul2026", "ogos2026", "sept2026", "okt2026", "nov2026", "dis2026"];

// Already in the new shape ({ jumlah, dahBayar })?
function isNewFormat(monthValue) {
    return monthValue !== null && typeof monthValue === "object" && "jumlah" in monthValue;
}

async function migrate() {
    console.log(isDryRun ? "Running in DRY-RUN mode — no writes will be made.\n" : "Running migration — writes WILL be made.\n");

    const snapshot = await db.collection("pendaftaran").get();

    if (snapshot.empty) {
        console.log("No documents found in 'pendaftaran'. Nothing to do.");
        return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const ansuran = data.ansuran || {};

        // Skip records where every month is already in the new format
        // (or the record has no ansuran field at all).
        const needsMigration = MONTH_KEYS.some(key => !isNewFormat(ansuran[key]));
        if (!needsMigration) {
            skippedCount++;
            continue;
        }

        const updatedAnsuran = {};
        MONTH_KEYS.forEach(key => {
            const existing = ansuran[key];
            if (isNewFormat(existing)) {
                // Already migrated — keep as-is
                updatedAnsuran[key] = existing;
            } else {
                // Old plain-number format (or missing) — convert it.
                // Nothing has been marked paid yet, so dahBayar starts false.
                updatedAnsuran[key] = {
                    jumlah: Number(existing || 0),
                    dahBayar: false
                };
            }
        });

        console.log(`${isDryRun ? "[DRY-RUN] Would migrate" : "Migrating"} ${docSnap.id} (${data.nama || "no name"})`);

        if (!isDryRun) {
            await docSnap.ref.update({ ansuran: updatedAnsuran });
        }

        updatedCount++;
    }

    console.log(`\nDone. ${updatedCount} document(s) ${isDryRun ? "would be" : "were"} updated, ${skippedCount} already in the new format.`);
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Migration failed:", err);
        process.exit(1);
    });