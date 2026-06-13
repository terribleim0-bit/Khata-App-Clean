// assets/js/delete_entry.js

let delCurrentTxnId = null;
let delCurrentCustId = null;
let delFoundTxn = null;
let isDelInitialized = false;

// ===============================================
// 🟢 SPA SCREEN HOOK & INITIALIZATION
// ===============================================
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-delete-entry') {
        const params = e.detail.params || {};
        delCurrentTxnId = params.id;
        delCurrentCustId = params.custId;

        if (!delCurrentTxnId || !delCurrentCustId) {
            AppRouter.goBack();
            return;
        }

        bindDeleteEventsOnce();
        loadDeleteEntryData();
    }
});

// ===============================================
// 🟢 EVENT BINDING (RUNS ONCE)
// ===============================================
function bindDeleteEventsOnce() {
    if (isDelInitialized) return;

    document.getElementById('del-entry-back-btn').addEventListener('click', () => {
        AppRouter.goBack();
    });

    document.getElementById('del-entry-confirm-btn').addEventListener('click', () => {
        if (window.showConfirmModal) {
            window.showConfirmModal(
                "Delete Entry", 
                "This entry will be deleted and the customer's balance will be updated. Deleted entries can only be viewed, not edited.", 
                "Delete", 
                executeDatabaseDelete
            );
        } else {
            if (confirm("Delete this entry?")) executeDatabaseDelete();
        }
    });

    isDelInitialized = true;
}

// ===============================================
// 🟢 LOAD DATA & RENDER UI
// ===============================================
function loadDeleteEntryData() {
    if (!window.db) return AppRouter.goBack();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM transactions WHERE id = ?', [delCurrentTxnId], function(tx, rs) {
            if (rs.rows.length === 0) return AppRouter.goBack();
            delFoundTxn = rs.rows.item(0);
            
            // Je pehlan hi delete ho chuki hai taan wapis bhej do
            if (delFoundTxn.is_deleted == 1 || String(delFoundTxn.is_deleted) === 'true') {
                AppRouter.goBack();
                return;
            }
            
            renderDeleteUI();
        });
    });
}

function renderDeleteUI() {
    const isGiven = delFoundTxn.type === 'given';
    
    const iconContainer = document.getElementById('del-entry-icon');
    const textEl = document.getElementById('del-entry-type-text');
    const amtEl = document.getElementById('del-entry-amount');
    
    if (isGiven) {
        iconContainer.innerHTML = `<svg class="w-7 h-7 text-status-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"></path></svg>`;
        textEl.textContent = "Credit Given";
        amtEl.textContent = `₹${delFoundTxn.amount}`;
    } else {
        iconContainer.innerHTML = `<svg class="w-7 h-7 text-status-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25"></path></svg>`;
        textEl.textContent = "Payment Received";
        amtEl.textContent = `₹${delFoundTxn.amount}`;
    }

    const d = new Date(Number(delFoundTxn.date));
    const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const dateStr = window.getFormattedDate ? window.getFormattedDate(Number(delFoundTxn.date)) : d.toLocaleDateString('en-GB');
    document.getElementById('del-entry-date').textContent = `${dateStr}, ${timeStr}`;

    const noteEl = document.getElementById('del-entry-note');
    const noteContainer = document.getElementById('del-entry-note-container');
    const originalNote = (delFoundTxn.note || "").trim();
    
    if (originalNote && originalNote.toLowerCase() !== "received" && originalNote.toLowerCase() !== "given") {
        noteEl.textContent = originalNote;
        noteContainer.classList.remove('hidden');
        noteContainer.classList.add('flex');
    } else {
        noteContainer.classList.add('hidden');
        noteContainer.classList.remove('flex');
    }
}

// ===============================================
// 🟢 CRITICAL FIX: ATOMIC DELETE & RECALCULATE
// ===============================================
function executeDatabaseDelete() {
    const deleteTime = Date.now();
    
    db.transaction(function(tx) {
        // Step 1: Mark transaction as deleted
        tx.executeSql('UPDATE transactions SET is_deleted = 1, deleted_on = ? WHERE id = ?', [deleteTime, delCurrentTxnId]);

        // Step 2: Recalculate pure customer balance
        tx.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', 
            [delCurrentCustId], 
            function(tx, rsCalc) {
                let netBal = 0;
                for(let i = 0; i < rsCalc.rows.length; i++) {
                    let t = rsCalc.rows.item(i);
                    netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
                }

                // Step 3: Set activity text and update customer
                const dateStr = window.getFormattedDate(deleteTime);
                const formattedAmount = parseFloat(delFoundTxn.amount).toLocaleString('en-IN');
                const isGiven = (delFoundTxn.type === 'given');
                const activityText = isGiven ? 
                    `₹${formattedAmount} Credit Deleted on ${dateStr}` : 
                    `₹${formattedAmount} Payment Deleted on ${dateStr}`;

                tx.executeSql('UPDATE customers SET balance = ?, updated_at = ?, last_activity_text = ? WHERE id = ?', 
                    [netBal, deleteTime, activityText, delCurrentCustId]);
            }
        );

    }, function(error) {
        if (window.showAppToast) window.showAppToast("Failed to delete entry. Database Error.", "error");
    }, function() {
        if (window.showAppToast) window.showAppToast("Entry Deleted & Balance Updated!");
        // Thoda delay taanki user Toast message dekh sake
        setTimeout(() => {
            AppRouter.goBack();
        }, 200);
    });
}
