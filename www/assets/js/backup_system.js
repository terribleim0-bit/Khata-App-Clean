// ==========================================
// 🟢 SQLITE ZIP BACKUP SYSTEM
// ==========================================

window.backupData = function(e) {
    e.preventDefault();
    if (!window.db) return showAppToast("Database ready nahi hai", "error");

    showAppToast("Preparing backup, please wait...");

    let backupObj = {
        customers: []
    };

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers', [], function(tx, custRs) {
            let customers = [];
            for(let i=0; i<custRs.rows.length; i++) {
                customers.push(custRs.rows.item(i));
            }

            if(customers.length === 0) {
                return showAppToast("Backup karan layi koi data nahi hai.", "error");
            }

            tx.executeSql('SELECT * FROM transactions', [], function(tx, txnRs) {
                let transactions = [];
                for(let i=0; i<txnRs.rows.length; i++) {
                    transactions.push(txnRs.rows.item(i));
                }

                let allBillPaths = []; // Photos de naam save karan layi

                customers.forEach(c => {
                    c.transactions = transactions.filter(t => t.customer_id === c.id);
                    c.transactions.forEach(t => {
                        try { 
                            t.bill_paths = JSON.parse(t.bill_paths || "[]"); 
                            allBillPaths.push(...t.bill_paths); 
                        } 
                        catch(err) { t.bill_paths = []; }
                    });
                });

                backupObj.customers = customers;
                let uniqueBills = [...new Set(allBillPaths)];
                
                createZipBackup(backupObj, uniqueBills);
            });
        });
    });
};

async function createZipBackup(backupObj, billPaths) {
    if (typeof JSZip === 'undefined') {
        return showAppToast("JSZip library load nahi hoyi!", "error");
    }

    let zip = new JSZip();
    zip.file("khata_data.json", JSON.stringify(backupObj, null, 2));
    let imgFolder = zip.folder("bills");

    if (window.cordova && cordova.file) {
        for (let i = 0; i < billPaths.length; i++) {
            let fileName = billPaths[i];
            try {
                let fileData = await readCordovaFileAsArrayBuffer(fileName);
                if (fileData) {
                    imgFolder.file(fileName, fileData); 
                }
            } catch(e) {
                console.warn("Photo missing ya read nahi hoyi: " + fileName);
            }
        }
    }

    zip.generateAsync({ type: "blob", compression: "STORE" }).then(function(content) {
        saveZipFile(content);
    }).catch(function(err) {
        showAppToast("Zip generation failed.", "error");
    });
}

function readCordovaFileAsArrayBuffer(fileName) {
    return new Promise((resolve, reject) => {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory + fileName, function(fileEntry) {
            fileEntry.file(function(file) {
                let reader = new FileReader();
                reader.onloadend = function() {
                    resolve(this.result);
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            }, reject);
        }, reject);
    });
}

function saveZipFile(blobData) {
    const date = new Date();
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12; 
    const strH = String(h).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');

    const fileName = `Khata_Backup_${d}-${m}-${y}_${strH}-${min}-${s}${ampm}.zip`;

    if (typeof cordova !== 'undefined' && cordova.file) {
        window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory + 'Download/', function(dirEntry) {
            dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = function() { showAppToast("Backup downloaded successfully."); };
                    fileWriter.onerror = function(err) { showAppToast("Backup save fail ho gaya.", "error"); };
                    fileWriter.write(blobData);
                });
            }, function(err) { fallbackBrowserDownload(blobData, fileName); });
        }, function(err) { fallbackBrowserDownload(blobData, fileName); });
    } else {
        fallbackBrowserDownload(blobData, fileName);
    }
}

function fallbackBrowserDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showAppToast("Backup downloaded successfully.");
}

// ==========================================
// 🟢 SMART RESTORE SYSTEM (ZIP & JSON DONO LAYI)
// ==========================================

window.triggerRestore = function(e) {
    e.preventDefault(); 
    const fileInput = document.getElementById('restore-file-input');
    if (fileInput) {
        fileInput.click();
    } else {
        showAppToast("Error: Restore button HTML vich nahi milya", "error");
    }
};

window.handleRestore = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
        reader.onload = function(e) {
            try {
                const parsedData = JSON.parse(e.target.result);
                processRestoreData(parsedData, null); 
            } catch (err) {
                showAppToast("Error reading JSON backup.", "error");
            }
        };
        reader.readAsText(file); 
    } 
    else if (file.name.endsWith('.zip')) {
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            if (typeof JSZip === 'undefined') return showAppToast("JSZip library missing!", "error");

            JSZip.loadAsync(arrayBuffer).then(function(zip) {
                const jsonFile = zip.file("khata_data.json");
                if (!jsonFile) return showAppToast("Invalid Zip: JSON data missing!", "error");

                jsonFile.async("string").then(function(jsonText) {
                    try {
                        const parsedData = JSON.parse(jsonText);
                        processRestoreData(parsedData, zip); 
                    } catch (err) {
                        showAppToast("Error reading Zip JSON.", "error");
                    }
                });
            }).catch(function(err) {
                showAppToast("Failed to open Zip file.", "error");
            });
        };
        reader.readAsArrayBuffer(file); 
    } 
    else {
        showAppToast("Please select a .zip or .json file!", "error");
    }
};

function processRestoreData(parsedData, zipArchive) {
    let customersToRestore = Array.isArray(parsedData) ? parsedData : (parsedData.customers || null);
    
    if (!customersToRestore || !window.db) {
        document.getElementById('restore-file-input').value = ''; 
        return showAppToast("Invalid backup format!", "error");
    }

    showConfirmModal(
        "Restore Data", 
        "Restoring will overwrite your current data with the backup. Are you sure you want to proceed?", 
        "Restore", 
        function() { 
            db.transaction(function(tx) {
                tx.executeSql('DELETE FROM customers');
                tx.executeSql('DELETE FROM transactions');

                customersToRestore.forEach(cust => {
                    tx.executeSql('INSERT INTO customers (id, name, phone, balance, updated_at) VALUES (?, ?, ?, ?, ?)', 
                        [cust.id, cust.name, cust.phone || '', cust.balance || 0, cust.updated_at || Date.now()]);
                    
                    if (cust.transactions && Array.isArray(cust.transactions)) {
                        cust.transactions.forEach(t => {
                            let billStr = JSON.stringify(t.bill_paths || []);
                            tx.executeSql('INSERT INTO transactions (id, customer_id, amount, type, date, note, bill_paths, is_edited, edited_on, is_deleted, deleted_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                                [t.id, cust.id, t.amount, t.type, t.date, t.note || '', billStr, t.is_edited ? 1 : 0, t.edited_on || null, t.is_deleted ? 1 : 0, t.deleted_on || null]);
                        });
                    }
                });
            }, function(error) {
                showAppToast("DB Restore failed: " + error.message, "error");
                document.getElementById('restore-file-input').value = '';
            }, function() {
                if (zipArchive) {
                    restorePhotosFromZip(zipArchive).then(() => {
                        finishRestoreAlert();
                    });
                } else {
                    finishRestoreAlert();
                }
            });
        }
    );

    document.getElementById('restore-file-input').value = ''; 
}

function finishRestoreAlert() {
    showAppToast("Data restored successfully!", "success");
    setTimeout(() => {
        window.location.reload();
    }, 1500); 
}

function restorePhotosFromZip(zip) {
    return new Promise((resolve) => {
        if (!window.cordova || !cordova.file) {
            console.log("Cordova missing, skipping photos.");
            return resolve(); 
        }

        const billsFolder = zip.folder("bills");
        if (!billsFolder) return resolve(); 

        let promises = [];

        billsFolder.forEach(function (relativePath, zipEntry) {
            if (!zipEntry.dir) {
                let p = zipEntry.async("blob").then(function(blobData) {
                    return saveBlobToCordova(relativePath, blobData);
                });
                promises.push(p);
            }
        });

        Promise.all(promises).then(() => {
            resolve();
        }).catch(() => {
            resolve(); 
        });
    });
}

function saveBlobToCordova(fileName, blobData) {
    return new Promise((resolve, reject) => {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
            dirEntry.getFile(fileName, { create: true, exclusive: false }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = resolve;
                    fileWriter.onerror = reject;
                    fileWriter.write(blobData);
                });
            }, reject);
        }, reject);
    });
}
