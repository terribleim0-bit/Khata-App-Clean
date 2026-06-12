let currentTxnId = null;
let currentCustId = null;
let foundTxn = null;

document.addEventListener('deviceready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTxnId = urlParams.get('id');
    currentCustId = urlParams.get('custId');

    if (!currentTxnId || !currentCustId) return history.back();

    loadEntryData();

    document.getElementById('confirm-del-btn').onclick = () => {
        // Apple style Confirm Modal
        if(window.showConfirmModal) {
            window.showConfirmModal(
                "Delete Entry", 
                "This entry will be deleted and the customer's balance will be updated. Deleted entries can only be viewed, not edited.", 
                "Delete", 
                executeDelete
            );
        } else {
            // Fallback (in case ui.js is missing)
            if(confirm("Delete this entry?")) executeDelete();
        }
    };
}, false);

function loadEntryData() {
    if (!window.db) return history.back();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM transactions WHERE id = ?', [currentTxnId], function(tx, rs) {
            if (rs.rows.length === 0) return history.back();
            foundTxn = rs.rows.item(0);
            
            // If already deleted, just go back
            if(foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true') {
                history.back();
                return;
            }
            
            renderUI();
        });
    });
}

function renderUI() {
    const isGiven = foundTxn.type === 'given';
    
    // 1. Set Icons and Text based on Type
    const iconContainer = document.getElementById('type-icon');
    const textEl = document.getElementById('type-text');
    const amtEl = document.getElementById('txn-amount');
    
    if (isGiven) {
        // Red Up Arrow for Given
        iconContainer.innerHTML = `<svg class="w-6 h-6 text-status-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"></path></svg>`;
        textEl.textContent = "Credit Given:";
        amtEl.textContent = `₹ ${foundTxn.amount}`;
        amtEl.className = 'text-[18px] font-bold text-status-red';
    } else {
        // Green Down Arrow for Received
        iconContainer.innerHTML = `<svg class="w-6 h-6 text-status-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25"></path></svg>`;
        textEl.textContent = "Payment Received:";
        amtEl.textContent = `₹ ${foundTxn.amount}`;
        amtEl.className = 'text-[18px] font-bold text-status-green';
    }

    // 2. Set Date
    const d = new Date(Number(foundTxn.date));
    const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    // getFormattedDate UI.js vichon aayega (e.g., "14 May, 2026")
    const dateStr = window.getFormattedDate ? window.getFormattedDate(Number(foundTxn.date)) : d.toLocaleDateString();
    document.getElementById('txn-date').textContent = `${dateStr}, ${timeStr}`;

    // 3. Set Note (Hide divider and section if note is empty)
    const noteEl = document.getElementById('txn-note');
    const noteContainer = document.getElementById('txn-note-container');
    const originalNote = (foundTxn.note || "").trim();
    
    if (originalNote && originalNote.toLowerCase() !== "received" && originalNote.toLowerCase() !== "given") {
        noteEl.textContent = originalNote;
        noteContainer.classList.remove('hidden');
    } else {
        noteContainer.classList.add('hidden');
    }
}

function executeDelete() {
    const deleteTime = Date.now();
    db.transaction(function(tx) {
        // Mark as deleted in database
        tx.executeSql('UPDATE transactions SET is_deleted = 1, deleted_on = ? WHERE id = ?', [deleteTime, currentTxnId], function(tx, rs) {
            
            // Show Success Toast
            if (window.showAppToast) {
                window.showAppToast("Entry Deleted Successfully");
            }
            
            // Go back after slight delay to let toast trigger
            setTimeout(() => {
                history.back();
            }, 300);
            
        }, function(tx, error) {
            if (window.showAppToast) window.showAppToast("Failed to delete entry", "error");
        });
    });
}
