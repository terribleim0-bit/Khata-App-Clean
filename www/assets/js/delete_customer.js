// assets/js/delete_customer.js

document.addEventListener('deviceready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const custId = urlParams.get('id');

    if (!custId || !window.db) return window.location.replace('../index.html');

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, rs) {
            if (rs.rows.length === 0) return window.location.replace('../index.html');
            
            const customer = rs.rows.item(0);
            const bal = parseFloat(customer.balance) || 0;
            const isSettled = (bal === 0);

            // UI Elements
            document.getElementById('cust-name').textContent = customer.name;
            const balAmtEl = document.getElementById('cust-bal-amt');
            const balTextEl = document.getElementById('cust-bal-text');
            const statusIcon = document.getElementById('status-icon');
            const statusTitle = document.getElementById('status-title');
            const statusDesc = document.getElementById('status-desc');
            const actionBtn = document.getElementById('action-btn');

            // 🟢 FIX: Theek kita hoya Balance Display (Due lai Red, Advance lai Green)
            balAmtEl.textContent = `₹${Math.abs(bal)}`;
            balTextEl.textContent = `₹${Math.abs(bal)} ${bal < 0 ? 'Due' : (bal > 0 ? 'Advance' : 'Settled')}`;
            balAmtEl.className = `text-2xl font-bold tracking-tight ${bal < 0 ? 'text-[#EF4444]' : (bal > 0 ? 'text-[#22C55E]' : 'text-gray-400')}`;

            if (isSettled) {
                statusIcon.innerHTML = `<div class="p-5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full border border-red-100 dark:border-red-900/30"><svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></div>`;
                statusTitle.textContent = "Confirm & Delete?";
                statusDesc.textContent = "Customer da saara data hamesha layi khatam ho jayega. Eh action wapas nahi ho sakda.";
                
                actionBtn.textContent = "Delete Permanently";
                actionBtn.className = "w-full bg-[#EF4444] hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-all";
                
                actionBtn.onclick = () => {
                    // 🟢 NAVA LOGIC: Check karo ki PIN set hai ya nahi
                    const hasPin = localStorage.getItem('khata_pin');
                    
                    if (hasPin) {
                        // Je PIN hai taan Lock Screen te bhejo
                        window.location.href = `security_verify.html?action=delete_customer&custId=${custId}`;
                    } else {
                        // Je PIN nahi hai taan sidha Confirm karwa ke Delete karo
                        if (confirm("Are you sure you want to permanently delete this customer?")) {
                            db.transaction(function(tx2) {
                                tx2.executeSql('DELETE FROM customers WHERE id = ?', [custId]);
                                tx2.executeSql('DELETE FROM transactions WHERE customer_id = ?', [custId]);
                            }, function(error) {
                                alert("Delete Error: " + error.message);
                            }, function() {
                                window.location.replace('../index.html');
                            });
                        }
                    }
                };
            } else {
                // 🟢 FIX: Asli settle logic
                const isDue = bal < 0; 
                
                statusIcon.innerHTML = `<div class="p-5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 rounded-full border border-yellow-100 dark:border-yellow-900/30"><svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`;
                statusTitle.textContent = "Balance Not Zero!";
                statusDesc.textContent = "Delete karan layi pehla isda hisaab zero (0) karna pauga. Kirpa karke baki rakam settle karo.";

                // Je Udhaar (Due) hai taan Receive karange. Je Advance hai taan Give (Wapas) karange.
                const btnText = isDue ? `Receive Payment of ₹${Math.abs(bal)}` : `Give Refund of ₹${Math.abs(bal)}`;
                const btnType = isDue ? 'receive' : 'given'; 
                
                actionBtn.textContent = btnText;
                actionBtn.className = `w-full ${isDue ? 'bg-[#22C55E] hover:bg-green-600' : 'bg-[#EF4444] hover:bg-red-600'} text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-all`;
                
                actionBtn.onclick = () => {
                    window.location.href = `add_entry.html?id=${custId}&type=${btnType}&amount=${Math.abs(bal)}&redirect=delete`;
                };
            }
        });
    });
}, false);
