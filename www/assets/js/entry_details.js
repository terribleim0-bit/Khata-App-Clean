// assets/js/entry_details.js

let detailCurrentTxnId = null;
let detailCurrentCustId = null;
let detailOriginalNote = "";
let detailFoundCustomer = null;
let detailFoundTxn = null;
let detailActivePreviewIndex = null;
let detailPreviewStartX = 0;
let detailPreviewEndX = 0;
const DETAIL_MAX_BILLS = 5;

let detailActiveModal = null; 
let isDetailInitialized = false;

// ===============================================
// 🟢 SPA SCREEN HOOK & RESET LOGIC
// ===============================================
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-entry-details') {
        const params = e.detail.params || {};
        initEntryDetailsScreen(params);
    }
});

function initEntryDetailsScreen(params) {
    detailCurrentTxnId = params.id;
    detailCurrentCustId = params.custId;
    
    if(!detailCurrentTxnId || !detailCurrentCustId) {
        AppRouter.goBack();
        return;
    }

    // Reset states
    detailActiveModal = null;
    detailActivePreviewIndex = null;
    document.getElementById('detail-quick-note-input').value = "";
    
    bindEntryDetailsEventsOnce();
    loadDetailTransactionData();
}

// ===============================================
// 🟢 HARDWARE BACK BUTTON (SPA FRIENDLY)
// ===============================================
document.addEventListener('backbutton', function (e) {
    if (!document.getElementById('screen-entry-details').classList.contains('active')) return;
    
    if (detailActiveModal) {
        e.preventDefault();
        toggleDetailModal(detailActiveModal, false);
    } else {
        // AppRouter handles main global back navigation
    }
}, false);

// ===============================================
// 🟢 EVENT BINDING (RUNS ONCE)
// ===============================================
function bindEntryDetailsEventsOnce() {
    if (isDetailInitialized) return;

    // 1. Back Button
    document.getElementById('detail-back-btn').addEventListener('click', () => {
        if (detailActiveModal) toggleDetailModal(detailActiveModal, false);
        else AppRouter.goBack();
    });

    // 2. Bill Triggers
    document.getElementById('detail-add-bill-trigger').addEventListener('click', () => {
        if(detailFoundTxn && (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true')) return;
        if((detailFoundTxn.bill_paths || []).length >= DETAIL_MAX_BILLS) {
            if(window.showAppToast) showAppToast("Maximum of 5 photos allowed.");
            return;
        }
        toggleDetailModal('detail-billModal', true);
    });

    document.getElementById('detail-cam-capture-btn').addEventListener('click', () => captureDetailBillImage(1));
    document.getElementById('detail-cam-gallery-btn').addEventListener('click', () => {
        document.getElementById('detail-native-gallery-input').click();
    });

    // 3. Gallery Input
    document.getElementById('detail-native-gallery-input').addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        const billPaths = detailFoundTxn.bill_paths || [];
        const availableSlots = DETAIL_MAX_BILLS - billPaths.length;

        if (files.length > availableSlots) {
            toggleDetailModal('detail-billModal', false);
            if(window.showAppToast) showAppToast(`You can only add ${availableSlots} more photos.`);
            this.value = ''; 
            return; 
        }

        toggleDetailModal('detail-billModal', false);

        files.forEach((file, i) => {
            if (window.cordova && cordova.file) {
                let uniqueFileName = "khata_bill_dt_gal_" + Date.now() + "_" + i + ".jpg";
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                    dirEntry.getFile(uniqueFileName, { create: true, exclusive: false }, function(fileEntry) {
                        fileEntry.createWriter(function(fileWriter) {
                            fileWriter.onwriteend = function() { attachDetailBillToData(fileEntry.name); };
                            fileWriter.write(file); 
                        });
                    });
                });
            } else { attachDetailBillToData("web_mock_gal_" + Date.now() + "_" + i + ".jpg"); }
        });
        this.value = ''; 
    });

    // 4. Notes Trigger
    document.getElementById('detail-note-edit-link').addEventListener('click', () => {
        if(detailFoundTxn && (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true')) return;
        document.getElementById('detail-quick-note-input').value = detailOriginalNote;
        toggleDetailModal('detail-noteModal', true);
    });

    document.getElementById('detail-save-note-btn').addEventListener('click', saveDetailNote);

    // 5. Preview Buttons
    document.getElementById('detail-preview-back-btn').addEventListener('click', () => toggleDetailModal('detail-imagePreviewModal', false));
    document.getElementById('detail-preview-delete-btn').addEventListener('click', deleteDetailActiveImage);

    // 6. Share Buttons
    document.getElementById('detail-sms-share-btn').addEventListener('click', triggerDetailSMSIntent);

    // 7. Edit/Delete Routing (Placeholder for SPA Edit/Delete Screens)
    document.getElementById('detail-top-edit-link').addEventListener('click', () => AppRouter.navigate('screen-edit-confirm', {id: detailCurrentTxnId, custId: detailCurrentCustId}));
    document.getElementById('detail-list-edit-btn').addEventListener('click', () => AppRouter.navigate('screen-edit-confirm', {id: detailCurrentTxnId, custId: detailCurrentCustId}));
    document.getElementById('detail-list-delete-btn').addEventListener('click', () => AppRouter.navigate('screen-delete-warning', {id: detailCurrentTxnId, custId: detailCurrentCustId}));

    // 8. Swipe Listeners for Preview
    const swipeArea = document.getElementById('detail-preview-swipe-area');
    if(swipeArea) {
        swipeArea.addEventListener('touchstart', e => {
            detailPreviewStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        swipeArea.addEventListener('touchend', e => {
            detailPreviewEndX = e.changedTouches[0].screenX;
            handleDetailSwipe();
        }, { passive: true });
    }

    setupDetailSwipeToClose();
    isDetailInitialized = true;
}

// ===============================================
// 🟢 LOAD DATA & UPDATE UI
// ===============================================
function loadDetailTransactionData() {
    if(!window.db) { AppRouter.goBack(); return; }

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [detailCurrentCustId], function(tx, custRs) {
            if (custRs.rows.length === 0) { AppRouter.goBack(); return; }
            detailFoundCustomer = custRs.rows.item(0);

            tx.executeSql('SELECT * FROM transactions WHERE id = ?', [detailCurrentTxnId], function(tx, txnRs) {
                if (txnRs.rows.length === 0) { AppRouter.goBack(); return; }
                
                detailFoundTxn = txnRs.rows.item(0);
                try { detailFoundTxn.bill_paths = JSON.parse(detailFoundTxn.bill_paths || "[]"); } 
                catch(e) { detailFoundTxn.bill_paths = []; }
                
                updateDetailUI(); 
            });
        });
    });
}

function updateDetailUI() {
    document.getElementById('detail-header-name').textContent = detailFoundCustomer.name;
    
    const amtEl = document.getElementById('detail-amount');
    const badgeEl = document.getElementById('detail-type-badge');
    const isGiven = detailFoundTxn.type === 'given';
    const isDeleted = (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true');
    
    amtEl.textContent = detailFoundTxn.amount;
    badgeEl.classList.remove('hidden'); 
    
    const topEdit = document.getElementById('detail-top-edit-link');
    const listEditBtn = document.getElementById('detail-list-edit-btn');
    const listDeleteBtn = document.getElementById('detail-list-delete-btn');
    const previewDelBtn = document.getElementById('detail-preview-delete-btn');
    const noteEditLink = document.getElementById('detail-note-edit-link');

    if (isDeleted) {
        amtEl.className = 'text-5xl font-bold tracking-tight ml-1 text-muted line-through decoration-2';
        badgeEl.textContent = isGiven ? 'GIVEN (DELETED)' : 'GOT (DELETED)';
        badgeEl.className = 'text-[10px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full mb-3 border text-muted border-line bg-master';
        
        if(topEdit) topEdit.style.display = 'none';
        if(listEditBtn) listEditBtn.style.display = 'none';
        if(listDeleteBtn) listDeleteBtn.style.display = 'none';
        if(previewDelBtn) previewDelBtn.style.display = 'none';
        
        if(noteEditLink) {
            noteEditLink.classList.remove('active:bg-black/5', 'dark:active:bg-white/5', 'cursor-pointer');
        }

        if (detailFoundTxn.deleted_on) {
            const delCont = document.getElementById('detail-deleted-container');
            if(delCont) delCont.classList.remove('hidden');
            const delDate = new Date(Number(detailFoundTxn.deleted_on));
            document.getElementById('detail-deleted-date').textContent = `${delDate.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${delDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        }
    } else {
        amtEl.className = `text-5xl font-bold tracking-tight ml-1 ${isGiven ? 'text-status-red' : 'text-status-green'}`;
        badgeEl.textContent = isGiven ? 'YOU GAVE' : 'YOU GOT';
        badgeEl.className = `text-[10px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full mb-3 border ${isGiven ? 'text-status-red border-status-red/30 bg-status-red/10' : 'text-status-green border-status-green/30 bg-status-green/10'}`;
        
        if(topEdit) topEdit.style.display = 'flex';
        if(listEditBtn) listEditBtn.style.display = 'flex';
        if(listDeleteBtn) listDeleteBtn.style.display = 'flex';
        if(previewDelBtn) previewDelBtn.style.display = 'block';
    }

    // Note Logic
    const noteEl = document.getElementById('detail-note');
    detailOriginalNote = (detailFoundTxn.note || "").trim();
    if (detailOriginalNote && detailOriginalNote.toLowerCase() !== "received" && detailOriginalNote.toLowerCase() !== "given") {
        noteEl.textContent = detailOriginalNote;
        noteEl.classList.remove('text-muted');
        noteEl.classList.add('text-primary'); 
    } else {
        noteEl.textContent = isDeleted ? "No note added." : "Tap to add a note...";
        noteEl.classList.add('text-muted');
        noteEl.classList.remove('text-primary');
        detailOriginalNote = "";
    }

    // Date Logic
    const d = new Date(Number(detailFoundTxn.date));
    document.getElementById('detail-date').textContent = `${d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

    if (detailFoundTxn.is_edited && detailFoundTxn.edited_on) {
        const e = new Date(Number(detailFoundTxn.edited_on));
        const edCont = document.getElementById('detail-edited-container');
        if(edCont) edCont.classList.remove('hidden');
        document.getElementById('detail-edited-date').textContent = `${e.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${e.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }

    const deleteTextEl = document.getElementById('detail-delete-text');
    if(deleteTextEl) deleteTextEl.textContent = `Delete ${isGiven ? 'Given' : 'Received'} Entry`;

    renderDetailBillsGallery(isDeleted);
    buildDetailWhatsAppShareLink(isDeleted);
}

// ===============================================
// 🟢 BILLS & GALLERY LOGIC
// ===============================================
function renderDetailBillsGallery(isDeleted = false) {
    const billPaths = detailFoundTxn.bill_paths || [];
    const counterEl = document.getElementById('detail-bill-counter');
    const container = document.getElementById('detail-bills-thumb-container');
    
    counterEl.textContent = `${billPaths.length}/${DETAIL_MAX_BILLS}`;
    container.innerHTML = '';

    const triggerBox = document.getElementById('detail-add-bill-trigger');
    if (isDeleted || billPaths.length >= DETAIL_MAX_BILLS) {
        if(triggerBox) triggerBox.style.display = 'none';
    } else {
        if(triggerBox) triggerBox.style.display = 'flex';
    }

    const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    billPaths.forEach((fileName, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'shrink-0 w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-200 dark:bg-zinc-800 relative border border-gray-300 dark:border-zinc-700 active:scale-90 transition-transform cursor-pointer flex items-center justify-center';
        thumb.innerHTML = `
            <span id="detail-loading-txt-${index}" class="absolute text-[9px] text-gray-500 dark:text-gray-400 font-medium">Loading...</span>
            <img id="detail-thumb-${index}" src="${emptyPixel}" class="absolute inset-0 w-full h-full object-cover z-0 opacity-0 transition-opacity duration-300" alt="Bill">
        `;
        thumb.onclick = () => launchDetailFullScreenPreview(index);
        container.appendChild(thumb);
    });

    setTimeout(() => {
        billPaths.forEach((fileName, index) => {
            const imgNode = document.getElementById(`detail-thumb-${index}`);
            const loadingTxt = document.getElementById(`detail-loading-txt-${index}`);
            if (!imgNode) return;

            if (window.cordova && cordova.file && cordova.file.dataDirectory) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + fileName, function(fileEntry) {
                    imgNode.src = fileEntry.toInternalURL();
                    imgNode.onload = () => {
                        imgNode.classList.remove('opacity-0');
                        if (loadingTxt) loadingTxt.style.display = 'none';
                    };
                }, function(err) {
                    if (loadingTxt) loadingTxt.textContent = "Missing";
                });
            } else {
                imgNode.src = "https://via.placeholder.com/150/1a73e8/FFFFFF?text=Web";
                imgNode.onload = () => {
                    imgNode.classList.remove('opacity-0');
                    if (loadingTxt) loadingTxt.style.display = 'none';
                };
            }
        });
    }, 150);
}

function launchDetailFullScreenPreview(index) {
    detailActivePreviewIndex = index;
    toggleDetailModal('detail-imagePreviewModal', true);
    renderDetailPreviewScreen();
}

function renderDetailPreviewScreen() {
    const billPaths = detailFoundTxn.bill_paths || [];
    if (billPaths.length === 0) {
        toggleDetailModal('detail-imagePreviewModal', false);
        return; 
    }
    
    if (detailActivePreviewIndex >= billPaths.length) detailActivePreviewIndex = billPaths.length - 1;
    if (detailActivePreviewIndex < 0) detailActivePreviewIndex = 0;

    const fileName = billPaths[detailActivePreviewIndex];
    const fullImgNode = document.getElementById('detail-full-preview-img');

    if (window.cordova && cordova.file && cordova.file.dataDirectory) {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory + fileName, function(fileEntry) {
            fullImgNode.src = fileEntry.toInternalURL();
        }, function() { fullImgNode.src = ""; });
    } else {
        fullImgNode.src = "https://via.placeholder.com/400x600/1a73e8/FFFFFF?text=Bill+" + (detailActivePreviewIndex + 1);
    }

    const thumbContainer = document.getElementById('detail-preview-thumbnails-container');
    thumbContainer.innerHTML = '';
    
    if (billPaths.length <= 1) {
        thumbContainer.parentElement.style.display = 'none';
        return;
    } else {
        thumbContainer.parentElement.style.display = 'flex';
    }

    billPaths.forEach((path, i) => {
        const is_active = (i === detailActivePreviewIndex);
        const thumb = document.createElement('img');
        thumb.className = `w-12 h-12 object-cover rounded-xl transition-all duration-300 cursor-pointer shrink-0 ${is_active ? 'border-[2.5px] border-brand scale-110 opacity-100 shadow-lg' : 'border border-gray-500 opacity-50 scale-100 active:scale-95'}`;
        
        if (window.cordova && cordova.file) {
             window.resolveLocalFileSystemURL(cordova.file.dataDirectory + path, function(fileEntry) {
                thumb.src = fileEntry.toInternalURL();
            });
        } else {
            thumb.src = "https://via.placeholder.com/150/1a73e8/FFFFFF?text=Thumb";
        }

        thumb.onclick = (e) => {
            e.stopPropagation();
            detailActivePreviewIndex = i;
            renderDetailPreviewScreen();
        };
        thumbContainer.appendChild(thumb);
    });
}

function handleDetailSwipe() {
    const threshold = 50; 
    const billPaths = detailFoundTxn.bill_paths || [];
    
    if (detailPreviewEndX < detailPreviewStartX - threshold) {
        if (detailActivePreviewIndex < billPaths.length - 1) {
            detailActivePreviewIndex++;
            renderDetailPreviewScreen();
        }
    }
    if (detailPreviewEndX > detailPreviewStartX + threshold) {
        if (detailActivePreviewIndex > 0) {
            detailActivePreviewIndex--;
            renderDetailPreviewScreen();
        }
    }
}

function deleteDetailActiveImage() {
    if (detailActivePreviewIndex === null) return;
    if(detailFoundTxn && (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true')) {
        if(window.showAppToast) showAppToast("Cannot delete image from deleted entry.");
        return;
    }

    detailFoundTxn.bill_paths.splice(detailActivePreviewIndex, 1);
    const updatedPathsStr = JSON.stringify(detailFoundTxn.bill_paths);

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET bill_paths = ? WHERE id = ?', [updatedPathsStr, detailCurrentTxnId], function(tx, rs) {
            if(window.showAppToast) showAppToast("Image Deleted Successfully");
            
            if (detailFoundTxn.bill_paths.length === 0) {
                toggleDetailModal('detail-imagePreviewModal', false);
            } else {
                renderDetailPreviewScreen(); 
            }
            loadDetailTransactionData(); 
        });
    });
}

function captureDetailBillImage(sourceType) {
    if(detailFoundTxn && (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true')) return;

    if (!window.cordova || !navigator.camera) {
        attachDetailBillToData("mock_native_file_" + Date.now() + ".jpg");
        toggleDetailModal('detail-billModal', false);
        return;
    }

    navigator.camera.getPicture(
        function(imageURI) {
            window.resolveLocalFileSystemURL(imageURI, function(fileEntry) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                    let uniqueFileName = "khata_bill_dt_" + Date.now() + ".jpg";
                    fileEntry.copyTo(dirEntry, uniqueFileName, function(newFileEntry) {
                        attachDetailBillToData(newFileEntry.name);
                        if(window.showAppToast) showAppToast("Image Added Successfully");
                        toggleDetailModal('detail-billModal', false);
                    }, function() { alert("File save failed!"); toggleDetailModal('detail-billModal', false); });
                }, function() { alert("Directory error!"); toggleDetailModal('detail-billModal', false); });
            }, function() { alert("Image error!"); toggleDetailModal('detail-billModal', false); });
        },
        function(cancel) { console.log("Camera cancelled"); toggleDetailModal('detail-billModal', false); },
        { quality: 60, destinationType: Camera.DestinationType.FILE_URI, sourceType: sourceType, correctOrientation: true }
    );
}

function attachDetailBillToData(savedFileName) {
    detailFoundTxn.bill_paths = detailFoundTxn.bill_paths || [];
    detailFoundTxn.bill_paths.push(savedFileName);
    const updatedPathsStr = JSON.stringify(detailFoundTxn.bill_paths);

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET bill_paths = ? WHERE id = ?', [updatedPathsStr, detailCurrentTxnId], function(tx, rs) {
            loadDetailTransactionData(); 
        });
    });
}

// ===============================================
// 🟢 NOTES & MODAL ENGINE
// ===============================================
function saveDetailNote() {
    const newNote = document.getElementById('detail-quick-note-input').value.trim();
    const finalNote = newNote || (detailFoundTxn.type === 'given' ? 'Given' : 'Received');
    const currentTime = Date.now();

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET note = ?, is_edited = ?, edited_on = ? WHERE id = ?', 
            [finalNote, 1, currentTime, detailCurrentTxnId], 
            function(tx, rs) {
                toggleDetailModal('detail-noteModal', false);
                if(window.showAppToast) showAppToast("Note Updated Successfully");
                loadDetailTransactionData(); 
            }, 
            function(tx, error) {
                if(window.showAppToast) showAppToast("Failed to update note");
            }
        );
    });
}

function toggleDetailModal(modalId, show) {
    const m = document.getElementById(modalId);
    if(!m) return;
    const c = m.querySelector('.modal-content') || m.querySelector('div.relative.w-full.max-w-lg');

    if(show) {
        m.classList.remove('hidden');
        if(c && modalId !== 'detail-imagePreviewModal') {
            c.style.transform = '';
            setTimeout(() => c.classList.remove('translate-y-full'), 10);
        } else {
            setTimeout(() => m.classList.remove('opacity-0'), 10);
        }
        if(modalId === 'detail-noteModal') setTimeout(() => document.getElementById('detail-quick-note-input').focus(), 300);
        detailActiveModal = modalId;
    } else {
        if(modalId === 'detail-noteModal') document.getElementById('detail-quick-note-input').blur(); 
        if(c && modalId !== 'detail-imagePreviewModal') {
            c.style.transform = ''; 
            c.classList.add('translate-y-full'); 
            setTimeout(() => m.classList.add('hidden'), 300); 
        } else {
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
        }
        detailActiveModal = null;
    }
}

function setupDetailSwipeToClose() {
    const overlays = document.querySelectorAll('#screen-entry-details .modal-overlay, #detail-imagePreviewModal.bg-black\\/90');
    overlays.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay && detailActiveModal) toggleDetailModal(detailActiveModal, false);
        });
    });

    document.querySelectorAll('#screen-entry-details .modal-content').forEach(modal => {
        let startY = 0; let isDragging = false;
        modal.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY; isDragging = true; modal.style.transition = 'none';
        }, { passive: true });
        modal.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const diffY = e.touches[0].clientY - startY;
            if (diffY > 0) modal.style.transform = `translateY(${diffY}px)`;
        }, { passive: true });
        modal.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const diffY = e.changedTouches[0].clientY - startY;
            modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 
            if (diffY > 100) { 
                if (detailActiveModal) toggleDetailModal(detailActiveModal, false);
                setTimeout(() => { modal.style.transform = ''; }, 300);
            } else {
                modal.style.transform = ''; 
            }
        }, { passive: true });
    });
}

// ===============================================
// 🟢 SHARE & SMS
// ===============================================
function buildDetailWhatsAppShareLink(isDeleted = false) {
    const d = new Date(Number(detailFoundTxn.date));
    const dateStr = d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    let statusLabel = detailFoundTxn.type === 'given' ? 'Given (Debit)' : 'Received (Credit)';
    
    if (isDeleted) statusLabel += " [DELETED]";

    let noteText = "";
    if (detailOriginalNote) noteText = `\n📝 Note: ${detailOriginalNote}`;

    let message = `*Khata App Transaction Details*\n\n👤 Customer: ${detailFoundCustomer.name}\n💰 Amount: ₹${detailFoundTxn.amount}\n📊 Status: ${statusLabel}\n📅 Date: ${dateStr}${noteText}`;
    const encodedMsg = encodeURIComponent(message);
    
    let cleanedPhone = (detailFoundCustomer.phone || "").replace(/[^0-9]/g, "");
    const waBtn = document.getElementById('detail-wa-share-btn');

    if (cleanedPhone) {
        if (cleanedPhone.length === 10) cleanedPhone = "91" + cleanedPhone;
        waBtn.href = `https://wa.me/${cleanedPhone}?text=${encodedMsg}`;
    } else {
        waBtn.href = `https://wa.me/?text=${encodedMsg}`;
    }
}

function triggerDetailSMSIntent() {
    const d = new Date(Number(detailFoundTxn.date));
    const dateStr = d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    let statusLabel = detailFoundTxn.type === 'given' ? 'Given' : 'Received';
    
    const isDeleted = (detailFoundTxn.is_deleted == 1 || String(detailFoundTxn.is_deleted) === 'true');
    if (isDeleted) statusLabel += " (Deleted)";
    
    let message = `Hisaab Notification: ₹${detailFoundTxn.amount} ${statusLabel} on ${dateStr} via Khata App.`;
    let phone = detailFoundCustomer.phone || "";
    
    if(window.cordova) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    } else {
        window.open(`sms:${phone};?&body=${encodeURIComponent(message)}`);
    }
}
