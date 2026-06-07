// assets/js/delete_warning.js

document.addEventListener('deviceready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const txnId = urlParams.get('id');
    const custId = urlParams.get('custId');

    if (!txnId || !custId || !window.db) return window.history.back();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM transactions WHERE id = ?', [txnId], function(tx, rs) {
            if (rs.rows.length === 0) return window.history.back();
            
            const txn = rs.rows.item(0);
            const isGive = txn.type === 'given';
            
            const amtEl = document.getElementById('txn-amount');
            // Rupee symbol corruption fixed here
            amtEl.textContent = `₹${txn.amount}`;
            amtEl.className = `text-2xl font-bold leading-tight ${isGive ? 'text-[#EF4444]' : 'text-[#22C55E]'}`;

            const d = new Date(Number(txn.date));
            document.getElementById('txn-date').textContent = `${d.toLocaleDateString('en-GB')} at ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

            // Note dikhaun da logic
            const noteContainer = document.getElementById('txn-note-container');
            const noteEl = document.getElementById('txn-note');
            const noteText = (txn.note || "").trim();
            
            if (noteText && noteText.toLowerCase() !== "received" && noteText.toLowerCase() !== "given") {
                noteEl.textContent = noteText;
                if(noteContainer) noteContainer.classList.remove('hidden');
            }

            document.getElementById('confirm-del-btn').onclick = () => {
                const hasPin = localStorage.getItem('khata_pin');

                if (hasPin) {
                    // Je PIN hai taan Security Verify (Lock Screen) te bhejo
                    window.location.replace(`security_verify.html?action=delete_entry&id=${txnId}&custId=${custId}`);
                } else {
                    // Je PIN nahi hai taan sidha Confirm karwa ke Delete karo
                    if (confirm("Are you sure you want to delete this entry?")) {
                        const currentTime = Date.now();
                        
                        // 🟢 FIX 1: Generate dynamic activity text for deletion
                        const dateStr = window.getFormattedDate(currentTime);
                        const activityText = `₹${txn.amount} Entry Deleted on ${dateStr}`;
                        
                        // 🟢 FIX 2: SINGLE TRANSACTION BLOCK FOR ATOMICITY
                        db.transaction(function(tx) {
                            
                            // Step 1: Soft Delete the transaction
                            tx.executeSql('UPDATE transactions SET is_deleted = 1, deleted_on = ? WHERE id = ?', 
                                [currentTime, txnId]);

                            // Step 2: Recalculate Balance
                            tx.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', 
                                [custId], 
                                function(tx, rsCalc) {
                                    let netBal = 0;
                                    for(let i = 0; i < rsCalc.rows.length; i++) {
                                        let t = rsCalc.rows.item(i);
                                        netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
                                    }

                                    // Step 3: Update Customer Balance AND last_activity_text
                                    tx.executeSql('UPDATE customers SET balance = ?, updated_at = ?, last_activity_text = ? WHERE id = ?', 
                                        [netBal, currentTime, activityText, custId]);
                                }
                            );

                        }, function(error) {
                            // Single error block catches any failure in the above 3 steps
                            if(window.showToast) showToast("Entry Delete Error: " + error.message);
                        }, function() {
                            // Success block runs only if ALL steps succeed
                            if(window.showToast) showToast("Entry deleted successfully");
                            setTimeout(() => {
                                history.back();
                            }, 100);
                        });
                    }
                }
            };
        });
    });
}, false);
