// assets/js/edit_confirm.js

let amountStr = '0';
let display = null;
let custId = null;
let txnId = null;
let foundTxn = null;
let foundCust = null;

function showError(msg) {
    const errEl = document.getElementById('error-msg');
    if (errEl) {
        errEl.textContent = msg; 
        errEl.classList.remove('hidden');
        setTimeout(() => { errEl.classList.add('hidden'); }, 3000);
    }
}

function updateActionContainer() {
    const actionContainer = document.getElementById('action-container');
    if (actionContainer) {
        if (parseFloat(amountStr) > 0) {
            actionContainer.classList.remove('hidden');
        } else {
            actionContainer.classList.add('hidden');
        }
    }
}

document.addEventListener('deviceready', () => {
    display = document.getElementById('amount-display');
    const urlParams = new URLSearchParams(window.location.search);
    txnId = urlParams.get('id');
    custId = urlParams.get('custId');

    if(!txnId || !custId || !window.db) return window.history.back();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, custRs) {
            if (custRs.rows.length === 0) return window.history.back();
            foundCust = custRs.rows.item(0);

            tx.executeSql('SELECT * FROM transactions WHERE id = ?', [txnId], function(tx, txnRs) {
                if (txnRs.rows.length === 0) return window.history.back();
                foundTxn = txnRs.rows.item(0);

                document.getElementById('header-name').textContent = "Editing for " + foundCust.name;
                if(foundTxn.date) {
                    const dateObj = new Date(Number(foundTxn.date));
                    document.getElementById('header-date').textContent = "Txn Date: " + dateObj.toLocaleDateString();
                }

                const isGiven = (foundTxn.type === 'given');
                const mainColorClass = isGiven ? 'text-red-500' : 'text-green-500';
                const bgColorClass = isGiven ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30';
                const badgeBg = isGiven ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800';

                const amtContainer = document.getElementById('amount-container');
                amtContainer.className = `text-5xl font-bold flex justify-center items-center transition-colors ${mainColorClass}`;
                document.getElementById('amount-underline').className = `h-[3px] w-32 mx-auto mt-4 rounded-full opacity-40 transition-colors ${isGiven ? 'bg-red-500' : 'bg-green-500'}`;
                
                document.getElementById('save-btn').className = `w-full text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-[16px] tracking-wide transition-transform active:scale-95 ${bgColorClass}`;
                document.getElementById('entry-type-badge').className = `ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0 ${badgeBg}`;
                document.getElementById('entry-type-badge').textContent = isGiven ? 'EDIT GIVEN' : 'EDIT GOT';

                amountStr = foundTxn.amount.toString();
                display.textContent = amountStr;
                updateActionContainer();
            });
        });
    });

    // 🟢 NEW BLOCK 2: DOUBLE-TAP & GHOST HISTORY FIX (Replaces old save-btn.onclick)
    let isSubmitting = false; // Double tap lock

    document.getElementById('save-btn').onclick = function() {
        if (isSubmitting) return; // Stop double clicks

        let finalAmount = 0;
        try { 
            finalAmount = eval(amountStr.replace(/[^0-9+\-*/.]/g, '')); 
        } catch(e) { 
            finalAmount = parseFloat(amountStr); 
        }
        if(isNaN(finalAmount)) finalAmount = parseFloat(amountStr);

        if (!finalAmount || finalAmount <= 0) {
            // showError function tuhade base code vich define hona chahida hai
            alert("Please enter a valid amount."); 
            return;
        }

        // Lock the button
        isSubmitting = true;
        this.disabled = true;
        this.style.opacity = "0.7";
        const originalText = this.innerHTML;
        this.innerHTML = "Updating...";

        const hasPin = localStorage.getItem('khata_pin'); 

        if (hasPin) {
            const pendingData = { custId: custId, txnId: txnId, newAmount: finalAmount };
            localStorage.setItem('pending_edit_data', JSON.stringify(pendingData));
            window.location.replace(`security_verify.html?action=edit_entry`);
        } else {
            const currentTime = Date.now();
            
            // 🟢 SINGLE TRANSACTION BLOCK FOR ATOMICITY
            db.transaction(function(tx) {
                
                // Step 1: Update the specific transaction
                tx.executeSql('UPDATE transactions SET amount = ?, is_edited = 1, edited_on = ? WHERE id = ?', 
                    [finalAmount, currentTime, txnId]);

                // Step 2: Recalculate net balance
                tx.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', 
                    [custId], 
                    function(tx, rsCalc) {
                        let netBal = 0;
                        for(let i = 0; i < rsCalc.rows.length; i++) {
                            let t = rsCalc.rows.item(i);
                            netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
                        }

                        // Step 3: Update customer balance AND last_activity_text
                        // Eh executeSql calculation de success block vich hai taaki netBal exactly calculate hon baad challey
                        const activityText = 'Entry Edited';
                        tx.executeSql('UPDATE customers SET balance = ?, updated_at = ?, last_activity_text = ? WHERE id = ?', 
                            [netBal, currentTime, activityText, custId]);
                    }
                );

            }, function(error) {
                // Eh error block saari transaction nu cover karega. Agar koi vi query fail hoyi, eh trigger hovega.
                alert("Database Error: " + error.message);
                
                // Unlock on fail
                isSubmitting = false;
                document.getElementById('save-btn').disabled = false;
                document.getElementById('save-btn').style.opacity = "1";
                document.getElementById('save-btn').innerHTML = originalText;
            }, function() {
                // Eh success block sirf tad chalega jadon saariyan queries bina kisi error de execute ho jangiyan.
                setTimeout(() => { history.back(); }, 100);
            });
        }
    };

}, false);

// 🟢 NEW BLOCK 1: CALCULATOR EDGE CASES (Replaces old window.pressKey)
window.pressKey = function(val) {
    if(!display) return;
    
    if (val === 'back') {
        amountStr = amountStr.slice(0, -1) || '0';
    } 
    else if (val === '=') {
        try {
            // Remove trailing operators before evaluating
            if (/[+\-*/.]$/.test(amountStr)) amountStr = amountStr.slice(0, -1);
            let res = eval(amountStr.replace(/[^0-9+\-*/.]/g, ''));
            if(isNaN(res) || !isFinite(res)) res = 0; // Guard against divide by zero
            amountStr = Number.isInteger(res) ? res.toString() : res.toFixed(2);
        } catch(e) { return; }
    } 
    else {
        const lastChar = amountStr.slice(-1);
        const isOp = (c) => ['+', '-', '*', '/'].includes(c);
        
        // Prevent multiple decimals in same block (e.g. 5..5)
        if (val === '.') {
            const parts = amountStr.split(/[+\-*/]/);
            if (parts[parts.length-1].includes('.')) return; 
        }

        // Prevent operator duplication (+* or -+)
        if (isOp(val)) {
            if (isOp(lastChar) || lastChar === '.') amountStr = amountStr.slice(0, -1);
            if (amountStr === '0' || amountStr === '') return;
        }

        // Prevent leading zeros (000)
        if (amountStr === '0' && !isOp(val) && val !== '.') {
            amountStr = val; 
        } else {
            amountStr += val;
        }
    }
    
    display.textContent = amountStr;
    updateActionContainer();
};
