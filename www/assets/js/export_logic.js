// --- 🟢 EXPORT SINGLE CUSTOMER ---
window.exportCustomer = function(custId) {
    if (!window.db) return showToast("DB Error", "error");

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, custRs) {
            if (custRs.rows.length === 0) return showToast("Customer nahi mileya", "error");
            let customer = custRs.rows.item(0);

            tx.executeSql('SELECT * FROM transactions WHERE customer_id = ?', [custId], function(tx, txnRs) {
                let transactions = [];
                for(let i=0; i<txnRs.rows.length; i++) {
                    let t = txnRs.rows.item(i);
                    try { t.bill_paths = JSON.parse(t.bill_paths || "[]"); } catch(e) { t.bill_paths = []; }
                    transactions.push(t);
                }
                customer.transactions = transactions;
                
                // Professional Filename banaya
                const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
                const fileName = `Khata_Export_${customer.name.replace(/\s+/g, '_')}_${date}.json`;
                
                saveToFile(JSON.stringify(customer, null, 2), fileName, 'Customers');
            });
        });
    });
};

// --- 🟢 SAVER FUNCTION (Folder bna ke save karega) ---
function saveToFile(content, fileName, subFolder) {
    if (typeof cordova !== 'undefined' && cordova.file) {
        const path = cordova.file.externalRootDirectory + 'Download/Khata_Backups/' + subFolder + '/';
        
        window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory + 'Download/', function(dirEntry) {
            // Check/Create Main Folder
            dirEntry.getDirectory('Khata_Backups', {create: true}, function(backupDir) {
                // Check/Create Sub Folder
                backupDir.getDirectory(subFolder, {create: true}, function(subDir) {
                    subDir.getFile(fileName, {create: true, exclusive: false}, function(fileEntry) {
                        fileEntry.createWriter(function(fileWriter) {
                            fileWriter.onwriteend = () => showToast(`${fileName} save ho gaya!`);
                            fileWriter.write(new Blob([content], {type: 'application/json'}));
                        });
                    });
                });
            });
        });
    } else {
        // Browser fallback
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
        a.download = fileName; a.click();
    }
}
