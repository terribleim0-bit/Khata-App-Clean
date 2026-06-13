// assets/js/edit_entry.js

let editAmountStr = '0';
let editDisplay = null;
let editCustId = null;
let editTxnId = null;
let editFoundTxn = null;
let editFoundCust = null;
let isEditSubmitting = false;
let isEditInitialized = false;

// ===============================================
// 🟢 SPA SCREEN HOOK & RESET LOGIC
// ===============================================
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-edit-entry') {
        const params = e.detail.params || {};
        initEditEntryScreen(params);
    }
});

function initEditEntryScreen(params) {
    editTxnId = params.id;
    editCustId = params.custId;

    if(!editTxnId || !editCustId || !window.db) {
        AppRouter.goBack();
        return;
    }

    editAmountStr = '0';
    isEditSubmitting = false;
    editDisplay = document.getElementById('edit-amount-display');

    const saveBtn = document.getElementById('edit-save-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
        saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Save Changes`;
    }

    bindEditEventsOnce();
    loadEditTransactionData();
}

// ===============================================
// 🟢 LOAD DATA & UPDATE UI
// ===============================================
function loadEditTransactionData() {
    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [editCustId], function(tx, custRs) {
            if (custRs.rows.length === 0) { AppRouter.goBack(); return; }
            editFoundCust = custRs.rows.item(0);

            tx.executeSql('SELECT * FROM transactions WHERE id = ?', [editTxnId], function(tx, txnRs) {
                if (txnRs.rows.length === 0) { AppRouter.goBack(); return; }
                editFoundTxn = txnRs.rows.item(0);

                document.getElementById('edit-header-name').textContent = "Editing for " + editFoundCust.name;
                if(editFoundTxn.date) {
                    const dateObj = new Date(Number(editFoundTxn.date));
                    document.getElementById('edit-header-date').textContent = "Txn Date: " + dateObj.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
                }

                const isGiven = (editFoundTxn.type === 'given');
                const mainColorClass = isGiven ? 'text-status-red' : 'text-status-green';
                const bgColorClass = isGiven ? 'bg-status-red shadow-status-red/30' : 'bg-status-green shadow-status-green/30';
                const badgeBg = isGiven ? 'bg-status-red/10 text-status-red border-status-red/30' : 'bg-status-green/10 text-status-green border-status-green/30';

                const amtContainer = document.getElementById('edit-amount-container');
                amtContainer.className = `text-5xl font-bold flex justify-center items-center transition-colors ${mainColorClass}`;
                
                const amtUnderline = document.getElementById('edit-amount-underline');
                amtUnderline.className = `h-[3px] w-32 mx-auto mt-4 rounded-full opacity-40 transition-colors ${isGiven ? 'bg-status-red' : 'bg-status-green'}`;
                
                document.getElementById('edit-save-btn').className = `w-full text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-[16px] tracking-wide transition-transform active:scale-95 ${bgColorClass}`;
                
                const typeBadge = document.getElementById('edit-type-badge');
                typeBadge.className = `ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0 ${badgeBg}`;
                typeBadge.textContent = isGiven ? 'EDIT GIVEN' : 'EDIT GOT';
                typeBadge.classList.remove('hidden');

                editAmountStr = editFoundTxn.amount.toString();
                editDisplay.textContent = editAmountStr;
                updateEditActionContainer();
            });
        });
    });
}

function updateEditActionContainer() {
    const actionContainer = document.getElementById('edit-action-container');
    if (actionContainer) {
        if (parseFloat(editAmountStr) > 0) {
            actionContainer.classList.remove('hidden');
        } else {
            actionContainer.classList.add('hidden');
        }
    }
}

function showEditError(msg) {
    const errEl = document.getElementById('edit-error-msg');
    if (errEl) {
        errEl.textContent = msg; 
        errEl.classList.remove('hidden');
        setTimeout(() => { errEl.classList.add('hidden'); }, 3000);
    }
}

// ===============================================
// 🟢 EVENT BINDING & KEYPAD LOGIC
// ===============================================
function bindEditEventsOnce() {
    if (isEditInitialized) return;

    document.getElementById('edit-back-btn').addEventListener('click', () => {
        AppRouter.goBack();
    });

    document.querySelectorAll('#edit-keypad .key-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(!editDisplay) return;
            const val = e.currentTarget.getAttribute('data-val');
            
            if (val === 'back') {
                editAmountStr = editAmountStr.slice(0, -1) || '0';
            } 
            else if (val === '=') {
                try {
                    if (/[+\-*/.]$/.test(editAmountStr)) editAmountStr = editAmountStr.slice(0, -1);
                    let sanitizedStr = editAmountStr.replace(/[^0-9+\-*/.]/g, '');
                    let res = eval(sanitizedStr);
                    if(isNaN(res) || !isFinite(res)) res = 0; 
                    editAmountStr = Number.isInteger(res) ? res.toString() : res.toFixed(2);
                } catch(err) { return; }
            } 
            else {
                const lastChar = editAmountStr.slice(-1);
                const isOp = (c) => ['+', '-', '*', '/'].includes(c);
                
                if (val === '.') {
                    const parts = editAmountStr.split(/[+\-*/]/);
                    if (parts[parts.length-1].includes('.')) return; 
                }

                if (isOp(val)) {
                    if (isOp(lastChar) || lastChar === '.') editAmountStr = editAmountStr.slice(0, -1);
                    if (editAmountStr === '0' || editAmountStr === '') return;
                }

                if (editAmountStr === '0' && !isOp(val) && val !== '.') {
                    editAmountStr = val; 
                } else {
                    editAmountStr += val;
                }
            }
            
            requestAnimationFrame(() => {
                editDisplay.textContent = editAmountStr;
                updateEditActionContainer();
            });
        });
    });

    document.getElementById('edit-save-btn').addEventListener('click', submitEditData);
    isEditInitialized = true;
}

// ===============================================
// 🟢 DATABASE SUBMIT LOGIC
// ===============================================
function submitEditData() {
    if (isEditSubmitting) return;

    let finalAmount = 0;
    try { 
        finalAmount = eval(editAmountStr.replace(/[^0-9+\-*/.]/g, '')); 
    } catch(e) { 
        finalAmount = parseFloat(editAmountStr); 
    }
    if(isNaN(finalAmount)) finalAmount = parseFloat(editAmountStr);

    if (!finalAmount || finalAmount <= 0) {
        showEditError("Please enter a valid amount."); 
        return;
    }

    isEditSubmitting = true;
    const saveBtn = document.getElementById('edit-save-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";
    saveBtn.innerHTML = "Updating...";

    const hasPin = localStorage.getItem('khata_pin'); 

    if (hasPin) {
        const pendingData = { custId: editCustId, txnId: editTxnId, newAmount: finalAmount };
        localStorage.setItem('pending_edit_data', JSON.stringify(pendingData));
        AppRouter.navigate('screen-security-verify', {action: 'edit_entry'});
        
        isEditSubmitting = false;
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
        saveBtn.innerHTML = originalText;
    } else {
        const currentTime = Date.now();
        
        db.transaction(function(tx) {
            tx.executeSql('UPDATE transactions SET amount = ?, is_edited = 1, edited_on = ? WHERE id = ?', 
                [finalAmount, currentTime, editTxnId]);

            tx.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', 
                [editCustId], 
                function(tx, rsCalc) {
                    let netBal = 0;
                    for(let i = 0; i < rsCalc.rows.length; i++) {
                        let t = rsCalc.rows.item(i);
                        netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
                    }

                    const dateStr = window.getFormattedDate(currentTime);
                    const isGiven = (editFoundTxn.type === 'given');
                    const formattedAmount = finalAmount.toLocaleString('en-IN');
                    const activityText = isGiven ? 
                        `₹${formattedAmount} Credit Edited on ${dateStr}` : 
                        `₹${formattedAmount} Payment Edited on ${dateStr}`;

                    tx.executeSql('UPDATE customers SET balance = ?, updated_at = ?, last_activity_text = ? WHERE id = ?', 
                        [netBal, currentTime, activityText, editCustId]);
                }
            );
        }, function(error) {
            if(window.showAppToast) showAppToast("Database Error: " + error.message, "error");
            isEditSubmitting = false;
            saveBtn.disabled = false;
            saveBtn.style.opacity = "1";
            saveBtn.innerHTML = originalText;
        }, function() {
            if(window.showAppToast) showAppToast("Transaction Updated");
            AppRouter.goBack();
        });
    }
}
