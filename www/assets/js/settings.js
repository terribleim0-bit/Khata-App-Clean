// ==========================================
// ⚙️ SETTINGS.JS 
// ==========================================

// 🟢 INITIALIZE TOGGLES ON LOAD
document.addEventListener('deviceready', initToggles);
document.addEventListener('DOMContentLoaded', () => {
    if (!window.cordova) initToggles();
});

function initToggles() {
    if (localStorage.getItem('app_lock_enabled') === 'true') {
        setToggleState(document.getElementById('app-lock-toggle'), true);
    }
    if (localStorage.getItem('bio_transaction_enabled') === 'true') {
        setToggleState(document.getElementById('bio-toggle'), true);
    }
}

// 🟢 SET TOGGLE VISUAL STATE (Apple Blue)
function setToggleState(element, isOn) {
    if (!element) return;
    const circle = element.querySelector('div');
    if (isOn) {
        element.classList.remove('bg-[#E9E9EA]', 'dark:bg-[#39393D]');
        element.classList.add('bg-[#007AFF]', 'dark:bg-[#0A84FF]');
        circle.classList.add('translate-x-6');
    }
}

// 🟢 TOGGLE SWITCH HANDLER (App Lock & Bio Transactions)
window.toggleSwitch = async function(element) {
    const key = (element.id === 'app-lock-toggle') ? 'app_lock_enabled' : 'bio_transaction_enabled';
    const isCurrentlyOn = localStorage.getItem(key) === 'true';

    if (key === 'app_lock_enabled') {
        if (window.Fingerprint) {
            Fingerprint.show({
                title: isCurrentlyOn ? 'Disable App Lock' : 'Enable App Lock',
                description: 'Verify phone lock to confirm',
                fallbackButtonTitle: 'Use Phone PIN',
                disableBackup: false 
            }, function() {
                localStorage.setItem(key, isCurrentlyOn ? 'false' : 'true');
                window.location.reload(); 
                
            }, function(err) {
            });
        } else {
            try {
                if (!window.PublicKeyCredential) throw new Error("Not supported");
                const challenge = new Uint8Array(32); 
                window.crypto.getRandomValues(challenge);
                
                const credential = await navigator.credentials.create({
                    publicKey: {
                        challenge: challenge,
                        rp: { name: "Khata App" }, 
                        user: { id: new Uint8Array(16), name: "user", displayName: "User" },
                        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                        timeout: 60000
                    }
                });
                
                if (credential) {
                    localStorage.setItem(key, isCurrentlyOn ? 'false' : 'true');
                    window.location.reload();
                }
            } catch(e) {
                showAppToast("Verification cancelled.", "error");
            }
        }
    } else {
        if (!localStorage.getItem('khata_pin')) {
            showAppToast("Please set an App PIN first.", "error");
            setTimeout(() => window.location.replace('security_verify.html?action=change_pin'), 1500);
            return;
        }
        window.location.replace(`security_verify.html?action=toggle_setting&key=${key}`);
    }
};

window.triggerClearData = function(e) {
    e.preventDefault();
    if (!window.db) return showAppToast("Database error!", "error");

    db.transaction(function(tx) {
        // SQL query de naal tisra parameter (error handler) add kitta hai
        tx.executeSql('SELECT COUNT(*) as cnt FROM customers', [], function(tx, rs) {
            if (rs.rows.item(0).cnt === 0) {
                return showAppToast("No data available to clear.", "warning");
            }
            proceedToClear();
        }, function(tx, error) {
            // Je table aje nahi baneya, taan chup-chaap warning de ke rok de
            return showAppToast("No data available to clear.", "warning");
        });
    });

    function proceedToClear() {
        const hasPin = localStorage.getItem('khata_pin');
        if (hasPin) {
            window.location.replace('security_verify.html?action=clear_data');
        } else {
            showConfirmModal(
                "Clear All Data",
                "Are you sure you want to delete all records? This action cannot be undone.",
                "Delete All",
                function() {
                    db.transaction(function(txDel) {
                        txDel.executeSql('DELETE FROM customers');
                        txDel.executeSql('DELETE FROM transactions');
                    }, function(error) {
                        showAppToast("Failed to clear data.", "error");
                    }, function() {
                        showAppToast("All data cleared successfully.", "success");
                        // Clear hon ton baad wapas index te bhej reha hai
                        setTimeout(() => window.location.replace('../index.html'), 1500);
                    });
                }
            );
        }
    }
};
