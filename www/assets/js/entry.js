// assets/js/entry.js

let entryCustomer = { id: 'test', name: 'Customer', balance: 0 };
let isEntryGiven = false;
let entryAmountStr = '0';
let entryAttachedBills = []; 
const MAX_ENTRY_BILLS = 5;
let activeEntryModal = null;
let isEntrySubmitting = false; 
let isEntryInitialized = false;

// ==========================================
// 🟢 SPA SCREEN HOOK & RESET LOGIC
// ==========================================
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-entry') {
        const params = e.detail.params || {};
        initEntryScreen(params);
    }
});

function initEntryScreen(params) {
    // 1. Reset all state variables
    isEntryGiven = (params.type === 'given');
    entryAmountStr = params.amount || '0';
    entryAttachedBills = [];
    activeEntryModal = null;
    isEntrySubmitting = false;
    
    // 2. Reset UI Form Elements
    document.getElementById('entry-note-input').value = '';
    const noteDisplay = document.getElementById('entry-note-display');
    noteDisplay.textContent = "Add Notes";
    noteDisplay.classList.replace('text-primary', 'text-secondary');
    
    document.getElementById('entry-confirm-btn').disabled = false;
    document.getElementById('entry-confirm-icon').style.display = 'block';
    document.getElementById('entry-confirm-text').textContent = "Confirm";

    updateEntryBillUI();
    bindEntryEventsOnce(); // Bind static events only if not bound yet

    // 3. Fetch Customer Data
    const custId = params.custId || 'test';
    if (window.db) {
        window.db.transaction(function(tx) {
            tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, rs) {
                if (rs.rows.length > 0) entryCustomer = rs.rows.item(0);
                else entryCustomer = { id: custId, name: 'Customer', balance: 0 };
                setupEntryUI(); 
            });
        }, function(err) {
            console.error("DB Error:", err.message);
            setupEntryUI();
        });
    } else {
        setupEntryUI();
    }
}

// ==========================================
// 🟢 HARDWARE BACK BUTTON (SPA FRIENDLY)
// ==========================================
document.addEventListener('backbutton', function (e) {
    if (!document.getElementById('screen-entry').classList.contains('active')) return;
    
    if (activeEntryModal) {
        e.preventDefault();
        window.toggleEntryModal(activeEntryModal, false);
    } else {
        // AppRouter automatically handles back navigation globally
    }
}, false);


// ==========================================
// 🟢 MODALS LOGIC
// ==========================================
window.toggleEntryModal = function(modalId, show) {
    const m = document.getElementById(`entry-${modalId}`);
    if(!m) return;
    
    const c = m.querySelector('div[id$="-modal-content"]') || m.querySelector('div.relative.w-full.max-w-lg'); 
    const pContainer = document.getElementById('entry-preview-img-container');
    
    if(show) {
        m.classList.remove('hidden');
        activeEntryModal = modalId;
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            if (c && modalId !== 'imagePreviewModal') c.style.transform = 'translateY(0)';
            if (modalId === 'imagePreviewModal' && pContainer) pContainer.classList.remove('scale-95');
        });
        if(modalId === 'noteModal') setTimeout(() => document.getElementById('entry-quick-note-input').focus(), 300);
    } else {
        if(modalId === 'noteModal') document.getElementById('entry-quick-note-input').blur(); 
        
        if(modalId === 'imagePreviewModal' && pContainer) {
            pContainer.classList.add('scale-95');
            setTimeout(() => { document.getElementById('entry-full-preview-img').src = ''; }, 300);
        }

        activeEntryModal = null;
        requestAnimationFrame(() => {
            m.classList.add('opacity-0');
            if (c && modalId !== 'imagePreviewModal') c.style.transform = 'translateY(100%)';
        });
        setTimeout(() => m.classList.add('hidden'), 300); 
    }
}

// ==========================================
// 🟢 UI SETUP (Header, Colors, Dates)
// ==========================================
function setupEntryUI() {
    const mainColorHex = isEntryGiven ? '#ef4444' : '#22c55e'; // Red or Green
    const mainClass = isEntryGiven ? 'text-[#ef4444]' : 'text-[#22c55e]';
    const bgClass = isEntryGiven ? 'bg-[#ef4444] shadow-red-500/30' : 'bg-[#22c55e] shadow-green-500/30';

    document.getElementById('entry-header-name').textContent = entryCustomer.name;
    document.getElementById('entry-amount-container').className = `text-5xl font-bold flex justify-center items-center transition-colors ${mainClass}`;
    document.getElementById('entry-amount-underline').style.backgroundColor = mainColorHex;
    
    let badge = document.getElementById('entry-type-badge');
    badge.textContent = isEntryGiven ? 'YOU GAVE' : 'YOU GOT';
    badge.style.color = mainColorHex; 
    
    let bal = parseFloat(entryCustomer.balance) || 0;
    const headerBalance = document.getElementById('entry-header-balance');
    const baseClasses = 'text-[11px] font-semibold tracking-wide truncate '; 
    
    if (bal < 0) { 
        headerBalance.textContent = `₹${Math.abs(bal)} Due`;
        headerBalance.className = baseClasses + 'text-[#ef4444]'; 
    } else if (bal > 0) { 
        headerBalance.textContent = `₹${Math.abs(bal)} Advance`;
        headerBalance.className = baseClasses + 'text-[#22c55e]'; 
    } else { 
        headerBalance.textContent = `₹0 Settled`;
        headerBalance.className = baseClasses + 'text-secondary'; 
    }

    const confBtn = document.getElementById('entry-confirm-btn');
    confBtn.className = `mt-1 w-full text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 text-[16px] tracking-wide transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 ${bgClass}`;

    document.getElementById('entry-amount-display').textContent = entryAmountStr;
    updateEntryActionUI();

    const dateInput = document.getElementById('entry-native-date-input');
    const dateDisplay = document.getElementById('entry-date-display');
    const today = new Date();
    
    // Adjust for local timezone correctly
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    
    dateInput.value = localISOTime;
    dateInput.setAttribute('max', localISOTime); 
    dateDisplay.textContent = 'Today';
}

function updateEntryActionUI() {
    const actionContainer = document.getElementById('entry-action-container');
    if (parseFloat(entryAmountStr) > 0) actionContainer.classList.remove('hidden');
    else actionContainer.classList.add('hidden');
}

// ==========================================
// 🟢 EVENT BINDING (RUNS ONCE)
// ==========================================
function bindEntryEventsOnce() {
    if (isEntryInitialized) return;

    // Header Back
    document.getElementById('entry-back-btn').addEventListener('click', () => {
        AppRouter.goBack();
    });

    // Date Picker
    document.getElementById('entry-native-date-input').addEventListener('change', (e) => {
        const d = new Date(e.target.value);
        const today = new Date();
        today.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        
        if (d > today) {
            if(window.showAppToast) showAppToast("Future dates are not allowed.");
            const tzOffset = (new Date()).getTimezoneOffset() * 60000;
            e.target.value = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
            document.getElementById('entry-date-display').textContent = 'Today';
            return;
        }
        
        if (d.getTime() === today.getTime()) {
            document.getElementById('entry-date-display').textContent = 'Today';
        } else {
            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            document.getElementById('entry-date-display').textContent = d.toLocaleDateString('en-IN', options);
        }
    });

    // Keypad Logic
    document.querySelectorAll('#entry-keypad .key-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-val');
            
            if (val === 'back') {
                entryAmountStr = entryAmountStr.slice(0, -1) || '0';
            } 
            else if (val === '=') {
                try {
                    if (/[+\-*/.]$/.test(entryAmountStr)) entryAmountStr = entryAmountStr.slice(0, -1);
                    let sanitizedStr = entryAmountStr.replace(/[^0-9+\-*/.]/g, '');
                    let res = eval(sanitizedStr);
                    if(isNaN(res) || !isFinite(res)) res = 0; 
                    entryAmountStr = Number.isInteger(res) ? res.toString() : res.toFixed(2);
                } catch(err) { 
                    if(window.showAppToast) showAppToast("Invalid calculation.");
                    return; 
                }
            } 
            else {
                const lastChar = entryAmountStr.slice(-1);
                const isOp = (c) => ['+', '-', '*', '/'].includes(c);
                
                if (val === '.') {
                    const parts = entryAmountStr.split(/[+\-*/]/);
                    if (parts[parts.length-1].includes('.')) return; 
                }

                if (isOp(val)) {
                    if (isOp(lastChar) || lastChar === '.') entryAmountStr = entryAmountStr.slice(0, -1);
                    if (entryAmountStr === '0' || entryAmountStr === '') return;
                }

                if (entryAmountStr === '0' && !isOp(val) && val !== '.') {
                    entryAmountStr = val; 
                } else {
                    entryAmountStr += val;
                }
            }
            
            requestAnimationFrame(() => {
                document.getElementById('entry-amount-display').textContent = entryAmountStr;
                updateEntryActionUI();
            });
        });
    });

    // Notes Logic
    document.getElementById('entry-open-note-btn').addEventListener('click', () => {
        document.getElementById('entry-quick-note-input').value = document.getElementById('entry-note-input').value;
        toggleEntryModal('noteModal', true);
    });

    document.getElementById('entry-save-note-btn').addEventListener('click', () => {
        const newNote = document.getElementById('entry-quick-note-input').value.trim();
        const displayEl = document.getElementById('entry-note-display');
        document.getElementById('entry-note-input').value = newNote;
        
        if (newNote) {
            displayEl.textContent = newNote;
            displayEl.classList.replace('text-secondary', 'text-primary');
        } else {
            displayEl.textContent = "Add Notes";
            displayEl.classList.replace('text-primary', 'text-secondary');
        }
        toggleEntryModal('noteModal', false); 
    });

    // Bills Logic (Clicks)
    document.getElementById('entry-empty-bill-state').addEventListener('click', () => {
        if(entryAttachedBills.length >= MAX_ENTRY_BILLS) {
            if(window.showAppToast) showAppToast(`Max ${MAX_ENTRY_BILLS} photos allowed.`);
            return;
        }
        toggleEntryModal('billModal', true);
    });

    document.getElementById('entry-cam-capture-btn').addEventListener('click', () => {
        if(entryAttachedBills.length >= MAX_ENTRY_BILLS) return;
        if(navigator.camera) {
            navigator.camera.getPicture((imgUri) => {
                attachEntryBill(imgUri);
                toggleEntryModal('billModal', false); 
            }, (err) => {
                if(err !== "No Image Selected" && err !== "Camera cancelled." && window.showAppToast) {
                    showAppToast("Permission denied or camera error.");
                }
                toggleEntryModal('billModal', false); 
            }, { quality: 50, destinationType: Camera.DestinationType.FILE_URI, saveToPhotoAlbum: false });
        } else {
            attachEntryBill("mock_cam_" + Date.now() + ".jpg");
            toggleEntryModal('billModal', false);
        }
    });

    document.getElementById('entry-cam-gallery-btn').addEventListener('click', () => {
        document.getElementById('entry-native-gallery-input').click();
    });

    document.getElementById('entry-native-gallery-input').addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) {
            toggleEntryModal('billModal', false); return; 
        }

        const availableSlots = MAX_ENTRY_BILLS - entryAttachedBills.length;
        if (files.length > availableSlots) {
            toggleEntryModal('billModal', false); 
            if(window.showAppToast) {
                if (entryAttachedBills.length === 0) showAppToast(`Max ${MAX_ENTRY_BILLS} photos allowed.`);
                else showAppToast(`You can only add ${availableSlots} more photos.`);
            }
            this.value = ''; return; 
        }

        toggleEntryModal('billModal', false); 

        files.forEach((file, i) => {
            if (window.cordova && cordova.file) {
                let uniqueFileName = "khata_bill_add_" + Date.now() + "_" + i + ".jpg";
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                    dirEntry.getFile(uniqueFileName, { create: true, exclusive: false }, function(fileEntry) {
                        fileEntry.createWriter(function(fileWriter) {
                            fileWriter.onwriteend = function() { attachEntryBill(fileEntry.name); };
                            fileWriter.write(file); 
                        });
                    });
                });
            } else { attachEntryBill("web_mock_gal_" + Date.now() + "_" + i + ".jpg"); }
        });
        this.value = ''; 
    });

    document.getElementById('entry-close-preview').addEventListener('click', () => toggleEntryModal('imagePreviewModal', false));
    document.getElementById('entry-btn-close-preview').addEventListener('click', () => toggleEntryModal('imagePreviewModal', false));

    // Submit Logic
    document.getElementById('entry-confirm-btn').addEventListener('click', submitEntryData);

    // Swipe Down Modals
    document.querySelectorAll('#screen-entry div[id$="-modal-content"]').forEach(modal => {
        let startY = 0; let isDragging = false;
        modal.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY; isDragging = true; modal.style.transition = 'none'; 
        }, { passive: true });
        modal.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const diffY = e.touches[0].clientY - startY;
            if (diffY > 0) requestAnimationFrame(() => { modal.style.transform = `translateY(${diffY}px)`; });
        }, { passive: true });
        modal.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const diffY = e.changedTouches[0].clientY - startY;
            modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 
            if (diffY > 80) { 
                if (activeEntryModal) toggleEntryModal(activeEntryModal, false);
                setTimeout(() => { modal.style.transform = ''; }, 300);
            } else {
                requestAnimationFrame(() => { modal.style.transform = 'translateY(0)'; });
                setTimeout(() => { modal.style.transform = ''; }, 300);
            }
        }, { passive: true });
    });

    isEntryInitialized = true;
}

// ==========================================
// 🟢 BILLS HELPER LOGIC
// ==========================================
function attachEntryBill(path) {
    if(entryAttachedBills.length >= MAX_ENTRY_BILLS) return;
    entryAttachedBills.push(path);
    updateEntryBillUI();
}

window.removeEntryBill = function(index) {
    if(event) event.stopPropagation();
    entryAttachedBills.splice(index, 1);
    updateEntryBillUI();
}

window.openEntryFullPreview = function(index, imgUrl) {
    const previewImg = document.getElementById('entry-full-preview-img');
    const loader = document.getElementById('entry-preview-loader');
    
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
    
    toggleEntryModal('imagePreviewModal', true);
}

function updateEntryBillUI() {
    const emptyState = document.getElementById('entry-empty-bill-state');
    const filledState = document.getElementById('entry-filled-bill-state');
    const gallery = document.getElementById('entry-bill-gallery');
    const counter = document.getElementById('entry-bill-counter');

    if (entryAttachedBills.length > 0) {
        emptyState.classList.add('hidden');
        filledState.classList.remove('hidden');
        filledState.classList.add('flex');
        counter.textContent = `${entryAttachedBills.length}/${MAX_ENTRY_BILLS}`;
        
        let htmlStrings = [];
        entryAttachedBills.forEach((bill, index) => {
            htmlStrings.push(`
                <div class="h-14 w-14 rounded-xl bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shrink-0 flex items-center justify-center overflow-hidden relative shadow-sm cursor-pointer active:scale-95 transition-transform group" onclick="openEntryFullPreview(${index}, '${bill}')">
                    <span class="loader-txt absolute text-[9px] text-gray-500 font-medium uppercase tracking-widest z-0">Load</span>
                    <img data-path="${bill}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 z-10" alt="Bill">
                    <button onclick="removeEntryBill(${index})" class="absolute top-1 right-1 w-4 h-4 bg-red-500/90 text-white rounded-full flex items-center justify-center z-20 backdrop-blur-sm shadow-sm active:scale-75 transition-transform" style="padding: 2px;">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            `);
        });
        
        if (entryAttachedBills.length < MAX_ENTRY_BILLS) {
            htmlStrings.push(`
                <div onclick="toggleEntryModal('billModal', true)" class="h-14 w-14 rounded-xl border-2 border-dashed border-[#007AFF]/50 dark:border-[#0A84FF]/50 shrink-0 flex items-center justify-center cursor-pointer active:scale-95 transition-transform bg-[#007AFF]/5 dark:bg-[#0A84FF]/5">
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
function submitEntryData() {
    if (isEntrySubmitting) return; 

    const finalAmount = parseFloat(entryAmountStr);
    if (!finalAmount || finalAmount <= 0 || isNaN(finalAmount)) {
        if(window.showAppToast) showAppToast("Please enter a valid amount."); 
        return;
    }
    
    isEntrySubmitting = true;
    const btnIcon = document.getElementById('entry-confirm-icon');
    const btnText = document.getElementById('entry-confirm-text');
    document.getElementById('entry-confirm-btn').disabled = true;
    if(btnIcon) btnIcon.style.display = 'none';
    if(btnText) btnText.textContent = "Saving...";

    const finalBillPaths = JSON.stringify(entryAttachedBills);
    let dateInputVal = document.getElementById('entry-native-date-input').value;
    let finalDateTimestamp = dateInputVal ? new Date(dateInputVal).getTime() : Date.now();
    
    const txnId = 'txn_' + Date.now();
    const noteText = document.getElementById('entry-note-input').value.trim() || (isEntryGiven ? 'Given' : 'Received');
    const txnType = isEntryGiven ? 'given' : 'receive';

    let newBalance = parseFloat(entryCustomer.balance) || 0;
    newBalance = isEntryGiven ? newBalance - finalAmount : newBalance + finalAmount;

    const dateStr = window.getFormattedDate(finalDateTimestamp);
    const formattedAmount = finalAmount.toLocaleString('en-IN'); 
    const activityText = isEntryGiven ? `₹${formattedAmount} Credit Added on ${dateStr}` : `₹${formattedAmount} Payment Added on ${dateStr}`;

    if (window.db) {
        db.transaction(function(tx) {
            tx.executeSql('INSERT INTO transactions (id, customer_id, amount, type, note, date, bill_paths) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                [txnId, entryCustomer.id, finalAmount, txnType, noteText, finalDateTimestamp, finalBillPaths]);
            
            tx.executeSql('UPDATE customers SET balance = ?, last_activity_text = ? WHERE id = ?', 
                [newBalance, activityText, entryCustomer.id]);
        }, function(error) {
            if(window.showAppToast) showAppToast("Failed to save entry. Please try again.");
            isEntrySubmitting = false;
            document.getElementById('entry-confirm-btn').disabled = false;
            if(btnIcon) btnIcon.style.display = 'block';
            if(btnText) btnText.textContent = "Confirm";
        }, function() {
            AppRouter.goBack(); // Back to Ledger
        });
    } else {
        AppRouter.goBack(); // Fallback if no DB
    }
}
