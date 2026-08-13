/**
 * ONE-TIME MIGRATION SCRIPT
 * Reformats every existing record's "refNumber" field into the new
 * sequential-per-day format:
 *
 *      OTR-JI-MMDD-YY-XX
 *
 * where MM/DD/YY come from the record's submission date (createdAt), and
 * XX is a two-digit sequence number that starts at 01 for the first
 * record submitted that day, 02 for the second, and so on — based on
 * submission order within each day.
 *
 * This does NOT change a document's Firestore ID — it only updates the
 * "refNumber" FIELD, matching the new format that live form submissions
 * now also generate (see index.js).
 *
 * It also creates/updates a "refCounters" document for each day that has
 * existing records, so that any new submission made later that same day
 * continues the sequence correctly instead of restarting at 01.
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────────────
 * 1. Make sure you already have serviceAccountKey.json in this folder
 *    (same one used by the earlier migration scripts). If not, see
 *    migrate-add-refnumber.js for how to generate it.
 *
 * 2. Install the Admin SDK (skip if already installed):
 *      npm install firebase-admin
 *
 * 3. Run:
 *      node migrate-refnumber-sequential.js
 *
 *    Add --dry-run to preview changes without writing anything:
 *      node migrate-refnumber-sequential.js --dry-run
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

// Malaysia is a fixed UTC+8 offset (no daylight saving), so computing the
// local date this way is safe regardless of what timezone this script
// happens to run in.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad2(n) {
    return String(n).padStart(2, "0");
}

function getMalaysiaDateParts(jsDate) {
    const myTime = new Date(jsDate.getTime() + MY_OFFSET_MS);
    const MM = pad2(myTime.getUTCMonth() + 1);
    const DD = pad2(myTime.getUTCDate());
    const YY = pad2(myTime.getUTCFullYear() % 100);
    return { MM, DD, YY, dayKey: `${MM}${DD}${YY}` };
}

async function migrate() {
    console.log(isDryRun ? "Running in DRY-RUN mode — no writes will be made.\n" : "Running migration — writes WILL be made.\n");

    // Fetch everything unordered (see note in migrate-add-refnumber.js on
    // why .orderBy() would silently skip records missing createdAt), then
    // sort chronologically in memory. Records with no createdAt fall back
    // to "now" and are treated as today's records.
    const snapshot = await db.collection("pendaftaran").get();

    if (snapshot.empty) {
        console.log("No documents found in 'pendaftaran'. Nothing to do.");
        return;
    }

    const docs = snapshot.docs.slice().sort((a, b) => {
        const aTime = a.data().createdAt ? a.data().createdAt.toMillis() : Infinity;
        const bTime = b.data().createdAt ? b.data().createdAt.toMillis() : Infinity;
        return aTime - bTime;
    });

    // Group records by their Malaysia-local submission day, preserving
    // chronological order within each day.
    const dayGroups = new Map(); // dayKey -> [{ docSnap, jsDate }, ...]

    docs.forEach(docSnap => {
        const data = docSnap.data();
        const jsDate = data.createdAt ? data.createdAt.toDate() : new Date();
        const { dayKey } = getMalaysiaDateParts(jsDate);
        if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, []);
        dayGroups.get(dayKey).push({ docSnap, jsDate });
    });

    let updatedCount = 0;

    for (const [dayKey, entries] of dayGroups.entries()) {
        let seq = 0;

        for (const { docSnap, jsDate } of entries) {
            seq++;
            const { MM, DD, YY } = getMalaysiaDateParts(jsDate);
            const newRefNumber = `OTR-JI-${MM}${DD}-${YY}-${pad2(seq)}`;
            const data = docSnap.data();

            console.log(`${isDryRun ? "[DRY-RUN] Would set" : "Setting"} ${docSnap.id} (${data.nama || "no name"}) → ${newRefNumber}`);

            if (!isDryRun) {
                await docSnap.ref.update({ refNumber: newRefNumber });
            }
            updatedCount++;
        }

        // Set the day's counter to the final sequence count, so a live
        // submission made later on this same day continues from the
        // correct next number instead of restarting at 01.
        const counterRef = db.collection("refCounters").doc(dayKey);
        console.log(`${isDryRun ? "[DRY-RUN] Would set counter" : "Setting counter"} refCounters/${dayKey} → seq: ${seq}`);

        if (!isDryRun) {
            await counterRef.set({ seq });
        }
    }

    console.log(`\nDone. ${updatedCount} document(s) ${isDryRun ? "would be" : "were"} updated across ${dayGroups.size} day(s).`);
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Migration failed:", err);
        process.exit(1);
    });