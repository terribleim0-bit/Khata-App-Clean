// assets/js/entry_details.js (PART 1)

let currentTxnId = null;
let currentCustId = null;
let originalNote = "";
let foundCustomer = null;
let foundTxn = null;
let activePreviewIndex = null;
const MAX_BILLS = 5;

// Nawa tracking variable Modals layi
let activeModal = null; 

document.addEventListener('deviceready', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTxnId = urlParams.get('id');
    currentCustId = urlParams.get('custId');
    
    if(!currentTxnId || !currentCustId) return window.history.back();

    loadTransactionData();

    document.getElementById('add-bill-trigger').onclick = () => {
        // Je delete ho chuki hai taan photo add nahi karni
        if(foundTxn && (foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true')) return;
        
        if((foundTxn.bill_paths || []).length >= MAX_BILLS) {
            if(window.showAppToast) showAppToast("Maximum of 5 photos allowed.");
            return;
        }
        toggleModal('billModal', true);
    };

    document.getElementById('cam-capture-btn').onclick = () => captureBillImage(1);
    document.getElementById('cam-gallery-btn').onclick = () => {
        history.back(); // Modal band karan layi

        const billPaths = foundTxn.bill_paths || [];
        const availableSlots = MAX_BILLS - billPaths.length;

        if (availableSlots <= 0) {
            if(window.showAppToast) showAppToast("Limit reached. Cannot add more photos.");
            return;
        }

        if (!window.MediaPicker) {
            alert("Error: MediaPicker plugin is missing! App rebuild karo.");
            return;
        }

        // Native Picker with STRICT LIMIT
        MediaPicker.getPictures({
            maxImages: availableSlots, // 🟢 Gallery limit aithe lag rhi hai
            mediaType: 'image',
            quality: 60
        }, function(result) {
            if (!result || result.length === 0) return;
            
            result.forEach((imagePath, i) => {
                let finalURI = imagePath.indexOf('file://') === 0 ? imagePath : 'file://' + imagePath;
                window.resolveLocalFileSystemURL(finalURI, function(fileEntry) {
                    window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                        let uniqueFileName = "khata_bill_dt_gal_" + Date.now() + "_" + i + ".jpg";
                        fileEntry.copyTo(dirEntry, uniqueFileName, function(newFileEntry) {
                            attachBillToData(newFileEntry.name);
                        }, function(err) { console.error("Copy failed: ", err); });
                    });
                });
            });
        }, function(error) {
            console.error("Gallery Error: " + error);
        });
    };

    document.getElementById('preview-delete-btn').onclick = () => deleteActiveImage();
    document.getElementById('sms-share-btn').onclick = () => triggerSMSIntent();

    setupSwipeToClose();
}, false);


function loadTransactionData() {
    if(!window.db) return window.history.back();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [currentCustId], function(tx, custRs) {
            if (custRs.rows.length === 0) return window.history.back();
            foundCustomer = custRs.rows.item(0);

            tx.executeSql('SELECT * FROM transactions WHERE id = ?', [currentTxnId], function(tx, txnRs) {
                if (txnRs.rows.length === 0) return window.history.back();
                
                foundTxn = txnRs.rows.item(0);
                try {
                    foundTxn.bill_paths = JSON.parse(foundTxn.bill_paths || "[]");
                } catch(e) {
                    foundTxn.bill_paths = [];
                }
                
                updateUI(); 
            });
        });
    });
}


function updateUI() {
    document.getElementById('header-name').textContent = foundCustomer.name;
    
    const amtEl = document.getElementById('detail-amount');
    const badgeEl = document.getElementById('detail-type-badge');
    const isGiven = foundTxn.type === 'given';
    
    // 🟢 NAVA LOGIC: Check Delete Status
    const isDeleted = (foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true');
    
    amtEl.textContent = foundTxn.amount;
    
    if (isDeleted) {
        // Deleted UI
        amtEl.className = 'text-5xl font-bold tracking-tight text-gray-400 line-through decoration-2';
        badgeEl.textContent = isGiven ? 'GIVEN (DELETED)' : 'GOT (DELETED)';
        badgeEl.className = 'text-[10px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full mb-3 border text-gray-400 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50';
        
        // Hide Top Edit Link
        const topEdit = document.getElementById('top-edit-link');
        if(topEdit) topEdit.style.display = 'none';

        // Disable Note Editing
        const noteEditLink = document.getElementById('note-edit-link');
        if(noteEditLink) {
            noteEditLink.onclick = null; // Click band
            noteEditLink.classList.remove('active:bg-gray-50', 'dark:active:bg-[#252529]', 'cursor-pointer');
            const editBadge = noteEditLink.querySelector('span'); // EDIT likheya hoya badge
            if(editBadge) editBadge.style.display = 'none';
        }

        // Hide Actions Box (Edit/Delete entry buttons)
        const editBtn = document.getElementById('list-edit-btn');
        if(editBtn && editBtn.parentElement) {
            editBtn.parentElement.style.display = 'none'; // Box gayab
            // Hide the "Actions" text above the box
            const actionsTitle = editBtn.parentElement.previousElementSibling;
            if(actionsTitle) actionsTitle.style.display = 'none';
        }

        // Hide Delete icon in Image Preview
        const previewDelBtn = document.getElementById('preview-delete-btn');
        if(previewDelBtn) previewDelBtn.style.display = 'none';

    } else {
        // Normal UI
        amtEl.className = `text-5xl font-bold tracking-tight ${isGiven ? 'text-[#ef4444]' : 'text-[#22c55e]'}`;
        badgeEl.textContent = isGiven ? 'YOU GAVE' : 'YOU GOT';
        badgeEl.className = `text-[10px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full mb-3 border ${isGiven ? 'text-[#ef4444] border-[#ef4444] bg-red-50 dark:bg-red-900/10' : 'text-[#22c55e] border-[#22c55e] bg-green-50 dark:bg-green-900/10'}`;
    }

    const noteEl = document.getElementById('detail-note');
    originalNote = (foundTxn.note || "").trim();
    if (originalNote && originalNote.toLowerCase() !== "received" && originalNote.toLowerCase() !== "given") {
        noteEl.textContent = originalNote;
        noteEl.classList.remove('text-gray-400', 'italic');
    } else {
        noteEl.textContent = isDeleted ? "No note added." : "Tap to add a note...";
        noteEl.classList.add('text-gray-400', 'italic');
        originalNote = "";
    }

    const d = new Date(Number(foundTxn.date));
    document.getElementById('detail-date').textContent = `${d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

    if (foundTxn.is_edited && foundTxn.edited_on) {
        const e = new Date(Number(foundTxn.edited_on));
        const edCont = document.getElementById('edited-container');
        edCont.classList.remove('hidden');
        edCont.classList.add('border-t', 'border-gray-100', 'dark:border-[#2a2a2e]');
        document.getElementById('detail-edited-date').textContent = `${e.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${e.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }

    // 🟢 JS automatically "Deleted On" row banayegi je zarurat hove (Bina HTML chhede)
    if (isDeleted && foundTxn.deleted_on) {
        let delCont = document.getElementById('deleted-container');
        if(!delCont) {
            const edCont = document.getElementById('edited-container');
            // Insert after edited container (or date if not edited)
            edCont.insertAdjacentHTML('afterend', `
            <div id="deleted-container" class="p-4 flex items-center border-t border-gray-100 dark:border-[#2a2a2e] bg-red-50/50 dark:bg-red-900/10 rounded-b-2xl">
                <div class="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-xl mr-4">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </div>
                <div>
                    <p class="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-0.5">Deleted On</p>
                    <p id="detail-deleted-date" class="text-[14px] font-medium text-red-700 dark:text-red-400">Loading...</p>
                </div>
            </div>`);
            delCont = document.getElementById('deleted-container');
        }
        delCont.classList.remove('hidden');
        const delDate = new Date(Number(foundTxn.deleted_on));
        document.getElementById('detail-deleted-date').textContent = `${delDate.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})} at ${delDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }

    const editUrl = `edit_confirm.html?id=${currentTxnId}&custId=${foundCustomer.id}`;
    const delUrl = `delete_warning.html?id=${currentTxnId}&custId=${foundCustomer.id}`; 
    document.getElementById('top-edit-link').href = editUrl;
    document.getElementById('list-edit-btn').href = editUrl;
    document.getElementById('list-delete-btn').href = delUrl;
    document.getElementById('delete-text').textContent = `Delete ${isGiven ? 'Given' : 'Received'} Entry`;

    renderBillsGallery(isDeleted);
    buildWhatsAppShareLink(isDeleted);
}
// assets/js/entry_details.js (PART 2)

// 🟢 renderBillsGallery vich isDeleted check add kitta hai
function renderBillsGallery(isDeleted = false) {
    const billPaths = foundTxn.bill_paths || [];
    const counterEl = document.getElementById('bill-counter');
    const container = document.getElementById('bills-thumb-container');
    
    counterEl.textContent = `${billPaths.length}/${MAX_BILLS}`;
    container.innerHTML = '';

    const triggerBox = document.getElementById('add-bill-trigger');
    // Je delete ho chuki hai ya max bill ho gaye ne, taan Add button luka deyo
    if (isDeleted || billPaths.length >= MAX_BILLS) {
        if(triggerBox) triggerBox.style.display = 'none';
    } else {
        if(triggerBox) triggerBox.style.display = 'flex';
    }

    const emptyPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    billPaths.forEach((fileName, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'shrink-0 w-[64px] h-[64px] rounded-xl overflow-hidden bg-gray-200 dark:bg-zinc-800 relative border border-gray-300 dark:border-zinc-700 active:scale-90 transition-transform cursor-pointer flex items-center justify-center';
        
        thumb.innerHTML = `
            <span id="loading-txt-${index}" class="absolute text-[9px] text-gray-500 dark:text-gray-400 font-medium">Loading...</span>
            <img id="detail-thumb-${index}" src="${emptyPixel}" class="absolute inset-0 w-full h-full object-cover z-0 opacity-0 transition-opacity duration-300" alt="Bill">
        `;
        
        thumb.onclick = () => launchFullScreenPreview(index);
        container.appendChild(thumb);
    });

    setTimeout(() => {
        billPaths.forEach((fileName, index) => {
            const imgNode = document.getElementById(`detail-thumb-${index}`);
            const loadingTxt = document.getElementById(`loading-txt-${index}`);
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

function launchFullScreenPreview(index) {
    activePreviewIndex = index;
    const fileName = foundTxn.bill_paths[index];
    const fullImgNode = document.getElementById('full-preview-img');

    toggleModal('imagePreviewModal', true);

    if (window.cordova && cordova.file && cordova.file.dataDirectory) {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory + fileName, function(fileEntry) {
            fullImgNode.src = fileEntry.toInternalURL();
        }, function() {
            fullImgNode.src = "";
        });
    } else {
        fullImgNode.src = "https://via.placeholder.com/400x600/1a73e8/FFFFFF?text=Bill+Preview";
    }
}

function deleteActiveImage() {
    if (activePreviewIndex === null) return;
    
    // Je delete ho chuki entry hai taan photo vi delete nahi hon deni
    if(foundTxn && (foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true')) {
        if(window.showAppToast) showAppToast("Cannot delete image from deleted entry.");
        return;
    }

    foundTxn.bill_paths.splice(activePreviewIndex, 1);
    const updatedPathsStr = JSON.stringify(foundTxn.bill_paths);

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET bill_paths = ? WHERE id = ?', [updatedPathsStr, currentTxnId], function(tx, rs) {
            history.back(); // Modal band karan layi
            if(window.showAppToast) showAppToast("Image Deleted Successfully");
            loadTransactionData(); 
        });
    });
}

function captureBillImage(sourceType) {
    if(foundTxn && (foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true')) return;

    if (!window.cordova || !navigator.camera) {
        attachBillToData("mock_native_file_" + Date.now() + ".jpg");
        history.back();
        return;
    }

    navigator.camera.getPicture(
        function(imageURI) {
            window.resolveLocalFileSystemURL(imageURI, function(fileEntry) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, function(dirEntry) {
                    let uniqueFileName = "khata_bill_dt_" + Date.now() + ".jpg";
                    fileEntry.copyTo(dirEntry, uniqueFileName, function(newFileEntry) {
                        attachBillToData(newFileEntry.name);
                        if(window.showAppToast) showAppToast("Image Added Successfully");
                        history.back(); 
                    }, function() { alert("File save failed!"); history.back(); });
                }, function() { alert("Directory error!"); history.back(); });
            }, function() { alert("Image error!"); history.back(); });
        },
        function(cancel) { console.log("Camera cancelled"); history.back(); },
        { quality: 60, destinationType: Camera.DestinationType.FILE_URI, sourceType: sourceType, correctOrientation: true }
    );
}

function attachBillToData(savedFileName) {
    foundTxn.bill_paths = foundTxn.bill_paths || [];
    foundTxn.bill_paths.push(savedFileName);
    const updatedPathsStr = JSON.stringify(foundTxn.bill_paths);

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET bill_paths = ? WHERE id = ?', [updatedPathsStr, currentTxnId], function(tx, rs) {
            loadTransactionData(); 
        });
    });
}

// 🟢 WhatsApp link vich 'DELETED' status add kitta hai
function buildWhatsAppShareLink(isDeleted = false) {
    const d = new Date(Number(foundTxn.date));
    const dateStr = d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    let statusLabel = foundTxn.type === 'given' ? 'Given (Debit)' : 'Received (Credit)';
    
    if (isDeleted) {
        statusLabel += " [DELETED]";
    }

    let noteText = "";
    if (originalNote) noteText = `\n📝 Note: ${originalNote}`;

    let message = `*Khata App Transaction Details*\n\n👤 Customer: ${foundCustomer.name}\n💰 Amount: ₹${foundTxn.amount}\n📊 Status: ${statusLabel}\n📅 Date: ${dateStr}${noteText}`;
    const encodedMsg = encodeURIComponent(message);
    
    let cleanedPhone = (foundCustomer.phone || "").replace(/[^0-9]/g, "");
    const waBtn = document.getElementById('wa-share-btn');

    if (cleanedPhone) {
        if (cleanedPhone.length === 10) cleanedPhone = "91" + cleanedPhone;
        waBtn.href = `https://wa.me/${cleanedPhone}?text=${encodedMsg}`;
    } else {
        waBtn.href = `https://wa.me/?text=${encodedMsg}`;
    }
}

// 🟢 SMS link vich vi 'DELETED' status add kitta hai
function triggerSMSIntent() {
    const d = new Date(Number(foundTxn.date));
    const dateStr = d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    let statusLabel = foundTxn.type === 'given' ? 'Given' : 'Received';
    
    const isDeleted = (foundTxn.is_deleted == 1 || String(foundTxn.is_deleted) === 'true');
    if (isDeleted) {
        statusLabel += " (Deleted)";
    }
    
    let message = `Hisaab Notification: ₹${foundTxn.amount} ${statusLabel} on ${dateStr} via Khata App.`;
    let phone = foundCustomer.phone || "";
    
    if(window.cordova) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    } else {
        window.open(`sms:${phone};?&body=${encodeURIComponent(message)}`);
    }
}

// 🟢 Nawa Master Modal Function
function toggleModal(modalId, show) {
    const m = document.getElementById(modalId);
    if(!m) return;
    const c = m.querySelector('.modal-content');

    if(show) {
        m.classList.remove('hidden');
        if(c) {
            c.style.transform = '';
            setTimeout(() => c.classList.remove('translate-y-full'), 10);
        } else {
            // image preview layi opacity use hundi hai
            setTimeout(() => m.classList.remove('opacity-0'), 10);
        }
        if(modalId === 'noteModal') setTimeout(() => document.getElementById('quick-note-input').focus(), 300);
        history.pushState({ modalOpen: true }, '');
        activeModal = modalId;
    } else {
        if(modalId === 'noteModal') document.getElementById('quick-note-input').blur(); 
        if(c) {
            c.style.transform = ''; 
            c.classList.add('translate-y-full'); 
            setTimeout(() => m.classList.add('hidden'), 300); 
        } else {
            m.classList.add('opacity-0');
            setTimeout(() => m.classList.add('hidden'), 300);
        }
        activeModal = null;
    }
}

// 🟢 Android Back Button (Popstate) Logic
window.addEventListener('popstate', (e) => {
    if (activeModal) {
        const m = document.getElementById(activeModal);
        if(m) {
            const c = m.querySelector('.modal-content');
            if(activeModal === 'noteModal') document.getElementById('quick-note-input').blur(); 
            
            if(c) {
                c.style.transform = '';
                c.classList.add('translate-y-full'); 
                setTimeout(() => m.classList.add('hidden'), 300); 
            } else {
                m.classList.add('opacity-0');
                setTimeout(() => m.classList.add('hidden'), 300);
            }
        }
        if(activeModal === 'imagePreviewModal') activePreviewIndex = null;
        activeModal = null;
    }
});

function openNoteModal() {
    document.getElementById('quick-note-input').value = originalNote;
    toggleModal('noteModal', true);
}

window.saveNote = function() {
    const newNote = document.getElementById('quick-note-input').value.trim();
    const finalNote = newNote || (foundTxn.type === 'given' ? 'Given' : 'Received');
    const currentTime = Date.now();

    db.transaction(function(tx) {
        tx.executeSql('UPDATE transactions SET note = ?, is_edited = ?, edited_on = ? WHERE id = ?', 
            [finalNote, 1, currentTime, currentTxnId], 
            function(tx, rs) {
                history.back(); // Modal band karan layi
                if(window.showAppToast) showAppToast("Note Updated Successfully");
                loadTransactionData(); 
            }, 
            function(tx, error) {
                if(window.showAppToast) showAppToast("Failed to update note");
            }
        );
    });
};

// 🟢 Nawa Swipe Down Logic
function setupSwipeToClose() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            if (activeModal) history.back();
        });
    });

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
            
            if (diffY > 0) {
                modal.style.transform = `translateY(${diffY}px)`;
            }
        }, { passive: true });

        modal.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const endY = e.changedTouches[0].clientY;
            const diffY = endY - startY;

            modal.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'; 

            if (diffY > 100) { 
                if (activeModal) history.back();
                setTimeout(() => { modal.style.transform = ''; }, 300);
            } else {
                modal.style.transform = ''; 
            }
        }, { passive: true });
    });
                        }
