// assets/js/security_verify.js

let correctPin = null;
let action = "";
let params = null;
let pinChangeState = 0; 
let tempNewPin = "";

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('hidden-pin');
    const dots = document.querySelectorAll('.dot');
    const errorMsg = document.getElementById('error-msg');
    const pinContainer = document.getElementById('pin-dots');
    const bioPillContainer = document.getElementById('bio-pill-container');
    
    correctPin = localStorage.getItem('khata_pin'); 
    
    params = new URLSearchParams(window.location.search);
    action = params.get('action');
    const actionKey = params.get('key');
    
    const titleEl = document.getElementById('verify-title');
    const iconEl = document.getElementById('main-icon');

    const isBioToggle = action === 'toggle_setting' && actionKey === 'bio_transaction_enabled';
    const bioEnabled = localStorage.getItem('bio_transaction_enabled') === 'true';

    // 🎨 Apple Blue Lock Icon
    const blueLockIconSVG = `
        <svg class="w-16 h-16 text-[#007AFF] dark:text-[#0A84FF]" viewBox="0 0 24 24">
            <path d="M 7 16.5 L 7 18 A 2 2 0 0 0 9 20 L 15 20 A 2 2 0 0 0 17 18 L 17 6 A 2 2 0 0 0 15 4 L 9 4 A 2 2 0 0 0 7 6 L 7 7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <path d="M 11 17.5 H 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <rect x="3.5" y="11" width="6.5" height="4.5" rx="1.2" fill="currentColor" />
            <path d="M 5.25 11 V 9 A 1.5 1.5 0 0 1 8.25 9 V 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
    `;

    const noCardWrapperClass = "mb-6 flex items-center justify-center";
    titleEl.textContent = ''; 

    // UI Setup based on Action
    if (action === 'clear_data' || action === 'delete_customer' || action === 'delete_entry' || action === 'edit_entry') {
        iconEl.innerHTML = blueLockIconSVG;
        iconEl.className = noCardWrapperClass;
    }
    else if (action === 'change_pin') {
        iconEl.className = noCardWrapperClass;
        iconEl.innerHTML = `
            
        `;
        
        if (!correctPin) {
            pinChangeState = 1;
            titleEl.textContent = 'Set a 4-digit PIN';
        } else {
            titleEl.textContent = 'Enter Current PIN';
        }
    }

    // 🟢 Simple te Pakka UI Initialize Logic
    function initUI() {
        const shouldShowBio = (bioEnabled && action !== 'change_pin') || isBioToggle;

        if (shouldShowBio) {
            // Bio Pill Button Show karo
            bioPillContainer.classList.remove('hidden');
            bioPillContainer.classList.add('flex');
            
            // Aape Fingerprint popup bulao
            setTimeout(() => { window.startBiometric(); }, 400); 
        } else {
            // Je bio nahi hai, taan sidha keyboard khol do
            setTimeout(() => { input.focus(); }, 300);
        }
    }

    if (window.cordova) document.addEventListener("deviceready", initUI);
    else initUI();

    // 🟢 Biometric Function (Bina kise lukwan-michi de)
    window.startBiometric = async function(e) {
        if (e) e.stopPropagation();
        
        input.blur(); // Popup aunde hi pichon keyboard lukko lavo taaki clear diske

        if (window.Fingerprint) {
            Fingerprint.show({ 
                title: 'Security Check', 
                description: 'Verify identity to proceed', 
                disableBackup: true // Eh true hi rakhna hai taaki phone wala pattern na mange
            }, () => { 
                window.executeAction(); 
            }, (err) => { 
                // Je user Cancel dabda hai, taan kuch nahi karna.
                // Screen te pehlan hi PIN dots majood ne. User screen te touch karke PIN bhar sakda hai.
            });
            return;
        }
        
        try {
            if (!window.PublicKeyCredential) throw new Error("Not supported");
            const challenge = new Uint8Array(32); window.crypto.getRandomValues(challenge);
            const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "Khata" }, user: { id: new Uint8Array(16) }, pubKeyCredParams: [{ type: "public-key", alg: -7 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } });
            if (credential) { window.executeAction(); }
        } catch (err) { 
            // Canceled by user
        }
    };

    input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        e.target.value = val;
        
        errorMsg.classList.add('hidden');
        pinContainer.classList.remove('shake');

        dots.forEach((dot, index) => {
            if (index < val.length) {
                dot.className = "dot w-3 h-3 rounded-full bg-[#007AFF] dark:bg-[#0A84FF] transition-colors";
            } else {
                dot.className = "dot w-3 h-3 rounded-full bg-[#E9E9EA] dark:bg-[#39393D] transition-colors";
            }
        });

        if (val.length === 4) {
            setTimeout(() => { handlePinComplete(val); }, 150);
        }
    });

    function handlePinComplete(entered) {
        if (action === 'change_pin') {
            if (pinChangeState === 0) {
                if (entered === correctPin) {
                    pinChangeState = 1;
                    titleEl.textContent = 'Set a 4-digit PIN';
                    resetDots();
                } else { showError("Incorrect Current PIN!"); }
            } else if (pinChangeState === 1) {
                tempNewPin = entered;
                pinChangeState = 2;
                titleEl.textContent = 'Confirm 4-digit PIN';
                resetDots();
            } else if (pinChangeState === 2) {
                if (entered === tempNewPin) {
                    localStorage.setItem('khata_pin', entered);
                    window.location.replace('settings.html');
                } else {
                    showError("PINs do not match!");
                    pinChangeState = 1;
                    titleEl.textContent = 'Set a 4-digit PIN';
                }
            }
            return;
        }

        if (correctPin && entered === correctPin) {
            window.executeAction();
        } else {
            showError("Incorrect PIN!");
        }
    }

    function resetDots() {
        input.value = "";
        dots.forEach(d => d.className = "dot w-3 h-3 rounded-full bg-[#E9E9EA] dark:bg-[#39393D] transition-colors");
        input.focus();
    }

    function showError(msg = "Incorrect PIN!") {
        
        pinContainer.classList.add('shake');
        dots.forEach(d => d.className = "dot w-3 h-3 rounded-full bg-[#E9E9EA] dark:bg-[#39393D] transition-colors");
        if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
        setTimeout(() => { resetDots(); }, 600);
    }
}); 

document.addEventListener('deviceready', function() {
    document.addEventListener('backbutton', function (e) {
        e.preventDefault(); window.goBack();
    }, false);
}, false);

window.goBack = function() {
    if (!params) return window.location.replace('../index.html');
    if (action === 'app_unlock') { if(window.navigator.app) navigator.app.exitApp(); } 
    else if (action === 'toggle_setting' || action === 'change_pin' || action === 'clear_data') { window.location.replace('settings.html'); } 
    else if (action === 'delete_customer') {
        const custId = params.get('custId');
        if (custId) window.location.replace(`entry_details.html?id=${custId}`);
        else window.location.replace('../index.html');
    } 
    else if (action === 'delete_entry' || action === 'edit_entry') {
        const editData = JSON.parse(localStorage.getItem('pending_edit_data') || '{}');
        const custId = params.get('custId') || editData.custId;
        if (custId) window.location.replace(`entry_details.html?id=${custId}`);
        else window.location.replace('../index.html');
    } 
    else { window.location.replace('../index.html'); }
};

window.executeAction = function() {
    if (action === 'toggle_setting') {
        const key = params.get('key');
        const currentState = localStorage.getItem(key) === 'true';
        localStorage.setItem(key, currentState ? 'false' : 'true');
        window.location.replace('settings.html');
        return;
    }
    
    if (action === 'change_pin') return; 
    
    if (!window.db) {
        alert("Database connection fail ho gaya!");
        return;
    }

    if (action === 'delete_entry') {
        const txnId = params.get('id');
        const custId = params.get('custId');
        const currentTime = Date.now(); // 🟢 Delete hon da time
        
        db.transaction(function(tx) {
            // 🟢 NAVA LOGIC: is_deleted nu 1 set kardo (Soft Delete)
            tx.executeSql('UPDATE transactions SET is_deleted = 1, deleted_on = ? WHERE id = ?', [currentTime, txnId]);
        }, function(error) {
            alert("Entry Delete Error: " + error.message);
        }, function() {
            window.recalculateAndSave(custId, `entry_details.html?id=${txnId}&custId=${custId}`);
        });
    } 
    else if (action === 'edit_entry') {
        const editData = JSON.parse(localStorage.getItem('pending_edit_data'));
        if (!editData) return window.location.replace('../index.html');

        const currentTime = Date.now();
        db.transaction(function(tx) {
            // 🟢 NAVA LOGIC: Sirf amount update karna hai, Note wala logic delete kar ditta
            tx.executeSql('UPDATE transactions SET amount = ?, is_edited = 1, edited_on = ? WHERE id = ?', 
                [editData.newAmount, currentTime, editData.txnId]);
        }, function(error) {
            alert("Edit Error: " + error.message);
        }, function() {
            localStorage.removeItem('pending_edit_data');
            window.recalculateAndSave(editData.custId, `entry_details.html?id=${editData.txnId}&custId=${editData.custId}`);
        });
    }
    else if (action === 'clear_data') {
        db.transaction(function(tx) {
            tx.executeSql('DELETE FROM customers');
            tx.executeSql('DELETE FROM transactions');
        }, function(error) {
            alert("Data Clear Error: " + error.message);
        }, function() {
            window.location.replace('../index.html');
        });
    }
    else if (action === 'delete_customer') {
        const custId = params.get('custId');
        db.transaction(function(tx) {
            tx.executeSql('DELETE FROM customers WHERE id = ?', [custId]);
            tx.executeSql('DELETE FROM transactions WHERE customer_id = ?', [custId]);
        }, function(error) {
            alert("Customer Delete Error: " + error.message);
        }, function() {
            window.location.replace('../index.html');
        });
    }
};

window.recalculateAndSave = function(custId, redirectUrl) {
    let netBal = 0;
    
    db.transaction(function(tx) {
        // 🟢 NAVA LOGIC: Calculate karde waqt Delete hoyian entries nu add nahi karna
        tx.executeSql('SELECT type, amount FROM transactions WHERE customer_id = ? AND (is_deleted IS NULL OR is_deleted = 0)', [custId], function(tx, rs) {
            for(let i = 0; i < rs.rows.length; i++) {
                let t = rs.rows.item(i);
                netBal += (t.type === 'given') ? -parseFloat(t.amount) : parseFloat(t.amount);
            }
        });
    }, function(error) {
        alert("Balance Calculation Error: " + error.message);
    }, function() {
        db.transaction(function(tx2) {
            tx2.executeSql('UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?', [netBal, Date.now(), custId]);
        }, function(error) {
            alert("Balance Update Error: " + error.message);
        }, function() {
            if (redirectUrl) window.location.replace(redirectUrl);
            else window.location.replace(`ledger.html?id=${custId}`);
        });
    });
};
