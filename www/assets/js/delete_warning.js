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
                        
                        db.transaction(function(txDel) {
                            // Soft Delete (is_deleted = 1)
                            txDel.executeSql('UPDATE transactions SET is_deleted = 1, deleted_on = ? WHERE id = ?', [currentTime, txnId]);
                        }, function(error) {
                            if(window.showToast) showToast("Entry Delete Error: " + error.message);
                        }, function() {
                            // Delete hon ton baad Balance wapas Recalculate karke save karna
                            let netBal = 0;
                            db.transaction(function(txCalc) {
                                // Sirf ohna entries nu gino jehriyan delete nahi hoyian
                                txCalc.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', [custId], function(txCalc, rsCalc) {
                                    for(let i = 0; i < rsCalc.rows.length; i++) {
                                        let t = rsCalc.rows.item(i);
                                        netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
                                    }
                                });
                            }, function(err) {
                                if(window.showToast) showToast("Balance Calculation Error: " + err.message);
                            }, function() {
                                // Nawa Balance Customer table ch update karo
                                db.transaction(function(txUpdate) {
                                    txUpdate.executeSql('UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?', [netBal, currentTime, custId]);
                                }, function(err) {
                                    if(window.showToast) showToast("Balance Update Error: " + err.message);
                                }, function() {
                                    // 🟢 THE MAGIC FIX: Replace nu hata ke history.back() laya
                                    // Eh tuhanu wapas "Entry Details" te bhejega, jo ki hun instantly "DELETED" state ch badal jayega!
                                    if(window.showToast) showToast("Entry deleted successfully");
                                    setTimeout(() => {
                                        history.back();
                                    }, 100);
                                });
                            });
                        });
                    }
                }
            };
        });
    });
}, false);
