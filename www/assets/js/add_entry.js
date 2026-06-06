let customer = { id: 'test', name: 'Customer', balance: 0 };
let isGiven = false;
let amountStr = '0';
let attachedBills = []; 
const MAX_BILLS = 5;
let activeModal = null;
let isSubmitting = false; 

// ==========================================
// 🟢 INIT & HARDWARE BACK BUTTON
// ==========================================
document.addEventListener('deviceready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const custId = urlParams.get('id') || 'test';
    const entryType = urlParams.get('type');
    isGiven = (entryType === 'given');
    amountStr = urlParams.get('amount') || '0';

    // Native Back Button Handler
    document.addEventListener('backbutton', function (e) {
        if (activeModal) {
            e.preventDefault();
            toggleModal(activeModal, false);
        } else {
            e.preventDefault();
            goBackNative();
        }
    }, false);

    // Database Load
    db.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(rs) {
        if (rs.rows.length > 0) customer = rs.rows.item(0);
        else customer = { id: custId, name: 'Customer', balance: 0 };
        setupUI(); 
    }, function(error) {
        setupUI(); 
    });
}, false);

function goBackNative() {
    document.body.style.transform = 'translateX(100%)';
    setTimeout(() => { history.back(); }, 300); 
}

// ==========================================
// 🟢 MODALS LOGIC (PushState Removed to Fix Black Screen)
// ==========================================
window.toggleModal = function(modalId, show) {
    const m = document.getElementById(modalId);
    if(!m) return;
    
    const c = m.querySelector('.modal-content');
    const pContainer = document.getElementById('preview-img-container');
    
    if(show) {
        m.classList.remove('hidden');
        activeModal = modalId;
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            if (c) c.style.transform = 'translateY(0)';
            if (modalId === 'imagePreviewModal' && pContainer) pContainer.classList.remove('scale-95');
        });
        if(modalId === 'noteModal') setTimeout(() => document.getElementById('quick-note-input').focus(), 300);
        // Note: history.pushState removed to prevent Ghost/Black screen bug
    } else {
        if(modalId === 'noteModal') document.getElementById('quick-note-input').blur(); 
        
        if(modalId === 'imagePreviewModal' && pContainer) {
            pContainer.classList.add('scale-95');
            setTimeout(() => { document.getElementById('full-preview-img').src = ''; }, 300);
        }

        activeModal = null;
        requestAnimationFrame(() => {
            m.classList.add('opacity-0');
            if (c) c.style.transform = 'translateY(100%)';
        });
        setTimeout(() => m.classList.add('hidden'), 300); 
    }
}

// Setup Native Swipe Down
document.querySelectorAll('.modal-content').forEach(modal => {
    let startY = 0;
    let isDragging = false;

    modal.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        modal.style.transition = 'none'; 
    }, { passive: true });

    modal.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diffY = currentY - startY;
        if (diffY > 0) requestAnimationFrame(() => { modal.style.transform = `translateY(${diffY}px)`; });
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const diffY = e.changedTouches[0].clientY - startY;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 

        if (diffY > 80) { 
            if (activeModal) toggleModal(activeModal, false);
            setTimeout(() => { modal.style.transform = ''; }, 300);
        } else {
            requestAnimationFrame(() => { modal.style.transform = 'translateY(0)'; });
            setTimeout(() => { modal.style.transform = ''; }, 300);
        }
    }, { passive: true });
});

// ==========================================
// 🟢 CALCULATOR / KEYPAD LOGIC
// ==========================================
function updateActionUI() {
    const actionContainer = document.getElementById('action-container');
    if (parseFloat(amountStr) > 0) actionContainer.classList.remove('hidden');
    else actionContainer.classList.add('hidden');
}

document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-val');
        
        if (val === 'back') {
            amountStr = amountStr.slice(0, -1) || '0';
        } 
        else if (val === '=') {
            try {
                if (/[+\-*/.]$/.test(amountStr)) amountStr = amountStr.slice(0, -1);
                let res = eval(amountStr);
                if(isNaN(res) || !isFinite(res)) res = 0; 
                amountStr = Number.isInteger(res) ? res.toString() : res.toFixed(2);
            } catch(err) { 
                if(window.showAppToast) showAppToast("Invalid calculation.");
                return; 
            }
        } 
        else {
            const lastChar = amountStr.slice(-1);
            const isOp = (c) => ['+', '-', '*', '/'].includes(c);
            
            if (val === '.') {
                const parts = amountStr.split(/[+\-*/]/);
                if (parts[parts.length-1].includes('.')) return; 
            }

            if (isOp(val)) {
                if (isOp(lastChar) || lastChar === '.') amountStr = amountStr.slice(0, -1);
                if (amountStr === '0' || amountStr === '') return;
            }

            if (amountStr === '0' && !isOp(val) && val !== '.') {
                amountStr = val; 
            } else {
                amountStr += val;
            }
        }
        
        requestAnimationFrame(() => {
            document.getElementById('amount-display').textContent = amountStr;
            updateActionUI();
        });
    });
});
// ==========================================
// 🟢 UI SETUP (Header, Colors, Dates)
// ==========================================
function setupUI() {
    const mainColorHex = isGiven ? '#ef4444' : '#22c55e';
    const mainClass = isGiven ? 'text-red-500' : 'text-green-500';
    const bgClass = isGiven ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30';

    document.getElementById('header-name').textContent = customer.name;
    document.getElementById('amount-container').className = `text-5xl font-bold flex justify-center items-center transition-colors ${mainClass}`;
    document.getElementById('amount-underline').style.backgroundColor = mainColorHex;
    
    let badge = document.getElementById('entry-type-badge');
    badge.textContent = isGiven ? 'YOU GAVE' : 'YOU GOT';
    badge.style.color = mainColorHex; 
    badge.style.borderColor = mainColorHex;
    badge.style.backgroundColor = isGiven ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)';

    let bal = parseFloat(customer.balance) || 0;
    const headerBalance = document.getElementById('header-balance');
    const baseClasses = 'text-xs font-semibold tracking-wide truncate '; 
    
    if (bal < 0) { 
        headerBalance.textContent = `₹${Math.abs(bal)} Due`;
        headerBalance.className = baseClasses + 'text-red-500'; 
    } else if (bal > 0) { 
        headerBalance.textContent = `₹${Math.abs(bal)} Advance`;
        headerBalance.className = baseClasses + 'text-green-500'; 
    } else { 
        headerBalance.textContent = `₹0 Settled`;
        headerBalance.className = baseClasses + 'text-gray-500 dark:text-gray-400'; 
    }

    const confBtn = document.getElementById('confirm-btn');
    confBtn.className = `mt-1 w-full text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-[16px] tracking-wide transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 ${bgClass}`;

    document.getElementById('amount-display').textContent = amountStr;
    updateActionUI();

    const dateInput = document.getElementById('native-date-input');
    const dateDisplay = document.getElementById('date-display');
    const today = new Date();
    const isoToday = today.toISOString().split('T')[0];
    
    dateInput.value = isoToday;
    dateInput.setAttribute('max', isoToday); 
    
    dateInput.addEventListener('change', (e) => {
        const d = new Date(e.target.value);
        if (d > today) {
            if(window.showAppToast) showAppToast("Future dates are not allowed.");
            e.target.value = isoToday;
            return;
        }
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        dateDisplay.textContent = d.toLocaleDateString('en-IN', options);
    });

    document.getElementById('back-btn').addEventListener('click', goBackNative);
}

// ==========================================
// 🟢 NOTES LOGIC
// ==========================================
document.getElementById('open-note-btn').addEventListener('click', () => {
    document.getElementById('quick-note-input').value = document.getElementById('note-input').value;
    toggleModal('noteModal', true);
});

document.getElementById('save-note-btn').addEventListener('click', () => {
    const newNote = document.getElementById('quick-note-input').value.trim();
    const displayEl = document.getElementById('note-display');
    document.getElementById('note-input').value = newNote;
    
    if (newNote) {
        displayEl.textContent = newNote;
        displayEl.classList.replace('text-gray-500', 'text-gray-900');
        displayEl.classList.replace('dark:text-gray-400', 'dark:text-gray-100');
    } else {
        displayEl.textContent = "Add Notes";
        displayEl.classList.replace('text-gray-900', 'text-gray-500');
        displayEl.classList.replace('dark:text-gray-100', 'dark:text-gray-400');
    }
    toggleModal('noteModal', false); 
});

// ==========================================
// 🟢 CAMERA, GALLERY & PREVIEW
// ==========================================
window.triggerBillModal = function() {
    if(attachedBills.length >= MAX_BILLS) {
        if(window.showAppToast) showAppToast(`You can only select up to ${MAX_BILLS} photos.`);
        return;
    }
    toggleModal('billModal', true);
};

document.getElementById('cam-capture-btn').onclick = () => {
    if(attachedBills.length >= MAX_BILLS) return;
    if(navigator.camera) {
        navigator.camera.getPicture((imgUri) => {
            attachBillToData(imgUri);
            toggleModal('billModal', false); 
        }, (err) => {
            if(err !== "No Image Selected" && err !== "Camera cancelled." && window.showAppToast) {
                showAppToast("Permission denied or camera error.");
            }
            toggleModal('billModal', false); 
        }, {
            quality: 50,
            destinationType: Camera.DestinationType.FILE_URI,
            saveToPhotoAlbum: false
        });
    } else {
        attachBillToData("mock_cam_" + Date.now() + ".jpg");
        toggleModal('billModal', false);
    }
};

document.getElementById('cam-gallery-btn').onclick = () => {
    document.getElementById('native-gallery-input').click();
};

document.getElementById('native-gallery-input').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) {
        toggleModal('billModal', false);
        return; 
    }

    const availableSlots = MAX_BILLS - attachedBills.length;
    if (files.length > availableSlots) {
        toggleModal('billModal', false); 
        if(window.showAppToast) {
            // Smart Toast Message Add Kita Gya Hai
            if (attachedBills.length === 0) {
                showAppToast(`You can only select up to ${MAX_BILLS} photos.`);
            } else {
                showAppToast(`You can only add ${availableSlots} more photos.`);
            }
        }
        this.value = ''; 
        return; 
    }

    toggleModal('billModal', false); 

    files.forEach((file, i) => {
        if (window.cordova && cordova.file) {
            let uniqueFileName = "khata_bill_add_" + Date.now() + "_" + i + ".jpg";
            window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                dirEntry.getFile(uniqueFileName, { create: true, exclusive: false }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        fileWriter.onwriteend = function() { attachBillToData(fileEntry.name); };
                        fileWriter.write(file); 
                    });
                });
            });
        } else {
            attachBillToData("web_mock_gal_" + Date.now() + "_" + i + ".jpg");
        }
    });
    this.value = ''; 
});

function attachBillToData(path) {
    if(attachedBills.length >= MAX_BILLS) return;
    attachedBills.push(path);
    updateBillUI();
}

window.removeBill = function(index) {
    if(event) event.stopPropagation();
    attachedBills.splice(index, 1);
    updateBillUI();
}

window.openFullPreview = function(index, imgUrl) {
    const previewImg = document.getElementById('full-preview-img');
    const loader = document.getElementById('preview-loader');
    
    previewImg.classList.add('opacity-0');
    loader.style.display = 'block';
    
    if (window.cordova && cordova.file && !imgUrl.startsWith('data:')) {
        if (imgUrl.startsWith('file://') || imgUrl.startsWith('content://')) {
            previewImg.src = imgUrl;
            previewImg.onload = () => { previewImg.classList.remove('opacity-0'); loader.style.display = 'none'; };
        } else {
            window.resolveLocalFileSystemURL(cordova.file.dataDirectory + imgUrl, function(fileEntry) {
                previewImg.src = fileEntry.toInternalURL();
                previewImg.onload = () => { previewImg.classList.remove('opacity-0'); loader.style.display = 'none'; };
            });
        }
    } else {
        previewImg.src = imgUrl; 
        previewImg.onload = () => { previewImg.classList.remove('opacity-0'); loader.style.display = 'none'; };
    }
    
    toggleModal('imagePreviewModal', true);
}

function updateBillUI() {
    const emptyState = document.getElementById('empty-bill-state');
    const filledState = document.getElementById('filled-bill-state');
    const gallery = document.getElementById('bill-gallery');
    const counter = document.getElementById('bill-counter');

    if (attachedBills.length > 0) {
        emptyState.classList.add('hidden');
        filledState.classList.remove('hidden');
        filledState.classList.add('flex');
        counter.textContent = `${attachedBills.length}/${MAX_BILLS}`;
        
        let htmlStrings = [];
        attachedBills.forEach((bill, index) => {
            htmlStrings.push(`
                <div class="h-14 w-14 rounded-xl bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shrink-0 flex items-center justify-center overflow-hidden relative shadow-sm cursor-pointer active:scale-95 transition-transform group" onclick="openFullPreview(${index}, '${bill}')">
                    <span class="loader-txt absolute text-[9px] text-gray-500 font-medium uppercase tracking-widest z-0">Loading</span>
                    <img data-path="${bill}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 z-10" alt="Bill">
                    
                    <button onclick="removeBill(${index})" class="absolute top-1 right-1 w-4 h-4 bg-red-500/90 text-white rounded-full flex items-center justify-center z-20 backdrop-blur-sm shadow-sm active:scale-75 transition-transform" style="padding: 2px;">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            `);
        });
        
        if (attachedBills.length < MAX_BILLS) {
            htmlStrings.push(`
                <div onclick="triggerBillModal()" class="h-14 w-14 rounded-xl border-2 border-dashed border-[#007AFF]/50 dark:border-[#0A84FF]/50 shrink-0 flex items-center justify-center cursor-pointer active:scale-95 transition-transform bg-[#007AFF]/5 dark:bg-[#0A84FF]/5">
                    <svg class="w-6 h-6 text-[#007AFF] dark:text-[#0A84FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                </div>
            `);
        }
        
        gallery.innerHTML = htmlStrings.join('');

        const imgElements = gallery.querySelectorAll('img');
        imgElements.forEach(imgEl => {
            const billPath = imgEl.getAttribute('data-path');
            const loader = imgEl.previousElementSibling; 
            
            if (window.cordova && cordova.file) {
                if (billPath.startsWith('file://') || billPath.startsWith('content://')) {
                    imgEl.src = billPath;
                    imgEl.onload = () => { imgEl.classList.remove('opacity-0'); if(loader) loader.style.display = 'none'; };
                } else {
                    window.resolveLocalFileSystemURL(cordova.file.dataDirectory + billPath, function(fileEntry) {
                        imgEl.src = fileEntry.toInternalURL();
                        imgEl.onload = () => { imgEl.classList.remove('opacity-0'); if(loader) loader.style.display = 'none'; };
                    });
                }
            } else {
                if(loader) loader.textContent = "No Preview";
            }
        });

    } else {
        emptyState.classList.remove('hidden');
        filledState.classList.add('hidden');
        filledState.classList.remove('flex');
    }
}

// ==========================================
// 🟢 DATABASE SUBMIT
// ==========================================
document.getElementById('confirm-btn').addEventListener('click', function() {
    if (isSubmitting) return; 

    const finalAmount = parseFloat(amountStr);
    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
        if(window.showAppToast) showAppToast("Please enter a valid amount."); 
        return;
    }
    
    isSubmitting = true;
    const btnIcon = document.getElementById('confirm-icon');
    const btnText = document.getElementById('confirm-text');
    this.disabled = true;
    if(btnIcon) btnIcon.style.display = 'none';
    if(btnText) btnText.textContent = "Saving...";

    const finalBillPaths = JSON.stringify(attachedBills);
    let dateInputVal = document.getElementById('native-date-input').value;
    let finalDateTimestamp = dateInputVal ? new Date(dateInputVal).getTime() : Date.now();
    
    const txnId = 'txn_' + Date.now();
    const noteText = document.getElementById('note-input').value.trim() || (isGiven ? 'Given' : 'Received');
    const txnType = isGiven ? 'given' : 'receive';

    let newBalance = parseFloat(customer.balance) || 0;
    newBalance = isGiven ? newBalance - finalAmount : newBalance + finalAmount;

    db.transaction(function(tx) {
        tx.executeSql('INSERT INTO transactions (id, customer_id, amount, type, note, date, bill_paths) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [txnId, customer.id, finalAmount, txnType, noteText, finalDateTimestamp, finalBillPaths]);
        
        tx.executeSql('INSERT OR REPLACE INTO customers (id, name, balance) VALUES (?, ?, ?)', 
            [customer.id, customer.name, newBalance]);
            
    }, function(error) {
        if(window.showAppToast) showAppToast("Failed to save entry. Please try again.");
        isSubmitting = false;
        document.getElementById('confirm-btn').disabled = false;
        if(btnIcon) btnIcon.style.display = 'block';
        if(btnText) btnText.textContent = "Confirm";
    }, function() {
        goBackNative();
    });
});
