/**
 * ONE-TIME MIGRATION SCRIPT
 * Backfills a 12-digit reference number (format xxxx-xxxx-xxxx) onto every
 * existing document in the "pendaftaran" collection that doesn't already
 * have one.
 *
 * This does NOT change a document's Firestore ID (that's not possible
 * without deleting and recreating it) — it only adds a `refNumber` FIELD
 * to each existing record, matching what new submissions store.
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────────────
 * 1. In the Firebase Console: Project Settings → Service Accounts →
 *    "Generate new private key". Save the downloaded JSON file as
 *    `serviceAccountKey.json` in this same folder.
 *    ⚠️ Do NOT commit serviceAccountKey.json to GitHub — it grants full
 *    admin access to your Firebase project. Add it to .gitignore.
 *
 * 2. Install the Admin SDK:
 *      npm install firebase-admin
 *
 * 3. Run:
 *      node migrate-add-refnumber.js
 *
 *    Add --dry-run to preview changes without writing anything:
 *      node migrate-add-refnumber.js --dry-run
 * ─────────────────────────────────────────────────────────────────────────
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const isDryRun = process.argv.includes("--dry-run");

function generateRefNumber() {
    let digits = "";
    for (let i = 0; i < 12; i++) {
        digits += Math.floor(Math.random() * 10);
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

async function migrate() {
    console.log(isDryRun ? "Running in DRY-RUN mode — no writes will be made.\n" : "Running migration — writes WILL be made.\n");

    const snapshot = await db.collection("pendaftaran").orderBy("createdAt", "asc").get();

    if (snapshot.empty) {
        console.log("No documents found in 'pendaftaran'. Nothing to do.");
        return;
    }

    const usedRefNumbers = new Set();

    // Pre-load ref numbers already present so new ones can't collide with them
    snapshot.forEach(docSnap => {
        const existing = docSnap.data().refNumber;
        if (existing) usedRefNumbers.add(existing);
    });

    let updatedCount = 0;
    let skippedCount = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        if (data.refNumber) {
            skippedCount++;
            continue;
        }

        let refNumber;
        do {
            refNumber = generateRefNumber();
        } while (usedRefNumbers.has(refNumber));

        usedRefNumbers.add(refNumber);

        console.log(`${isDryRun ? "[DRY-RUN] Would assign" : "Assigning"} ${refNumber} → ${docSnap.id} (${data.nama || "no name"})`);

        if (!isDryRun) {
            await docSnap.ref.update({ refNumber });
        }

        updatedCount++;
    }

    console.log(`\nDone. ${updatedCount} document(s) ${isDryRun ? "would be" : "were"} updated, ${skippedCount} already had a reference number.`);
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Migration failed:", err);
        process.exit(1);
    });