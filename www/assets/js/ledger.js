// assets/js/ledger.js

let isModalOpen = false;
let isLedgerSearchOpen = false; 
let currentLedgerCustId = null;
let currentLedgerCustomerObj = null;

// ===============================================
// 🟢 1. SPA SCREEN CHANGED EVENT (Main Trigger)
// ===============================================
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-ledger') {
        currentLedgerCustId = e.detail.params ? e.detail.params.id : currentLedgerCustId;
        
        if(!currentLedgerCustId) {
            AppRouter.goBack(); 
            return;
        }
        
        // Reset UI States
        if(isModalOpen) toggleModal();
        if(isLedgerSearchOpen) toggleLedgerSearch();
        
        loadLedgerData(currentLedgerCustId);
    }
});

// ===============================================
// 🟢 2. BACK BUTTON LOGIC (SPA Friendly)
// ===============================================
document.addEventListener('backbutton', function (e) {
    // Sirf odo chalega jado Ledger Screen sahmne hove
    if (!document.getElementById('screen-ledger').classList.contains('active')) return;
    
    if (isModalOpen) {
        e.preventDefault();
        toggleModal();
        return;
    }
    if (isLedgerSearchOpen) {
        e.preventDefault();
        toggleLedgerSearch();
        return;
    }
}, false);

const ledgerBackBtn = document.getElementById('ledger-back-btn');
if(ledgerBackBtn) {
    ledgerBackBtn.addEventListener('click', () => {
        if (isModalOpen) toggleModal();
        else if (isLedgerSearchOpen) toggleLedgerSearch();
        else AppRouter.goBack();
    });
}

// Modal Logic (Exact Same as before)
document.getElementById('more-modal-btn').addEventListener('click', toggleModal);
document.getElementById('modal-overlay').addEventListener('click', toggleModal);

function toggleModal() {
    const m = document.getElementById('moreModal');
    const c = document.getElementById('modalContent');
    if(!m || !c) return;
    
    if(!isModalOpen) {
        m.classList.remove('hidden');
        isModalOpen = true;
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            c.style.transform = 'translateY(0)';
        });
    } else {
        isModalOpen = false;
        requestAnimationFrame(() => {
            m.classList.add('opacity-0');
            c.style.transform = 'translateY(100%)';
        });
        setTimeout(() => m.classList.add('hidden'), 300);
    }
}

// Swipe down logic (Exact Same)
const modalContent = document.getElementById('modalContent');
if(modalContent) {
    let startY = 0; let currentY = 0;
    modalContent.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        modalContent.style.transition = 'none'; 
    }, {passive: true});

    modalContent.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        let deltaY = currentY - startY;
        if (deltaY > 0) { 
            requestAnimationFrame(() => { modalContent.style.transform = `translateY(${deltaY}px)`; });
        }
    }, {passive: true});

    modalContent.addEventListener('touchend', (e) => {
        modalContent.style.transition = 'transform 0.3s ease-out'; 
        let deltaY = currentY - startY;
        if (deltaY > 60) toggleModal();
        else requestAnimationFrame(() => { modalContent.style.transform = 'translateY(0)'; });
    });
}

// Floating Scroll Logic
const scrollContainer = document.getElementById('transaction-container');
const fabScrollBottom = document.getElementById('fab-scroll-bottom');
if (scrollContainer && fabScrollBottom) {
    scrollContainer.addEventListener('scroll', () => {
        const scrolledAmount = Math.abs(scrollContainer.scrollTop);
        if (scrolledAmount > 150) fabScrollBottom.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
        else fabScrollBottom.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
    });
    fabScrollBottom.addEventListener('click', () => {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===============================================
// 🟢 3. LOAD DATA & SETUP UI
// ===============================================
function loadLedgerData(custId) {
    if(!db) return;

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, rs) {
            if(rs.rows.length === 0) return AppRouter.goBack();
            
            let customer = rs.rows.item(0);
            currentLedgerCustomerObj = customer; // Save for WA
            
            tx.executeSql('SELECT * FROM transactions WHERE customer_id = ? ORDER BY date ASC', [custId], function(tx, txRs) {
                let transactions = [];
                for(let i = 0; i < txRs.rows.length; i++) {
                    let t = txRs.rows.item(i);
                    try { t.bill_paths = JSON.parse(t.bill_paths || "[]"); } 
                    catch(e) { t.bill_paths = []; }
                    transactions.push(t);
                }
                customer.transactions = transactions;
                setupUI(customer, custId);
            });
        });
    });
}

function setupUI(customer, custId) {
    document.getElementById('header-name').textContent = customer.name;
    document.getElementById('header-initial').textContent = customer.name.charAt(0).toUpperCase();
    
    // Links replaced with SPA Routes
    document.getElementById('header-profile-link').onclick = () => AppRouter.navigate('screen-profile', {id: custId});
    
    document.getElementById('receive-btn').onclick = () => AppRouter.navigate('screen-form', {type: 'receive', id: custId});
    document.getElementById('give-btn').onclick = () => AppRouter.navigate('screen-form', {type: 'given', id: custId});
    
    const statementNav = () => AppRouter.navigate('screen-statement', {id: custId});
    const deleteNav = () => AppRouter.navigate('screen-delete-customer', {id: custId});
    
    document.getElementById('strip-statement').onclick = statementNav;
    document.getElementById('modal-statement').onclick = statementNav;
    document.getElementById('strip-balance-btn').onclick = statementNav;
    
    document.getElementById('strip-delete').onclick = deleteNav;
    document.getElementById('modal-delete').onclick = deleteNav;

    const container = document.getElementById('transactions-wrapper');
    if(container) container.innerHTML = '';
    
    const parseDateSafe = (dateVal) => {
        if (!dateVal) return new Date();
        if (!isNaN(dateVal) && String(dateVal).trim() !== "") return new Date(Number(dateVal));
        if (typeof dateVal === 'string' && dateVal.includes('-') && dateVal.length === 10) {
            const parts = dateVal.split('-'); return new Date(parts[0], parts[1] - 1, parts[2]); 
        }
        const d = new Date(dateVal); return isNaN(d.getTime()) ? new Date() : d;
    };

    let running = 0;
    const enrichedTxns = (customer.transactions || []).map(txn => {
        const isGive = txn.type === 'given';
        const isDeleted = (txn.is_deleted == 1 || String(txn.is_deleted) === 'true');
        if (!isDeleted) running += isGive ? -parseFloat(txn.amount) : parseFloat(txn.amount);

        const d = parseDateSafe(txn.date);
        const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '');
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        let actualNote = "";
        if (txn.note && txn.note.toLowerCase() !== "received" && txn.note.toLowerCase() !== "given") {
            actualNote = txn.note.trim();
        }

        return {
            ...txn, isGive, runningBalance: running, dStr, time, actualNote,
            hasNote: actualNote !== "", isDeleted: isDeleted,
            balTxt: running !== 0 ? `₹${Math.abs(running)} ${running > 0 ? 'Advance' : 'Due'}` : `₹0 Settled`
        };
    });

    const total = running; 
    let pendingImagesLocal = [];

    window.renderLedgerTransactions = function(txnsToRender) {
        if(!container) return;
        
        if (txnsToRender.length === 0) {
            container.innerHTML = `<div class="flex flex-col justify-center items-center h-40 opacity-70">
                <svg class="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span class="text-gray-500 dark:text-gray-400 text-sm font-medium">No transactions found</span>
            </div>`;
            return;
        }

        const reversedTxns = [...txnsToRender].reverse();
        let htmlStrings = [];
        pendingImagesLocal = [];

        for (let i = 0; i < reversedTxns.length; i++) {
            const txn = reversedTxns[i];
            const uniqueTxnId = txn.id;
            let cardClasses, innerContent;

            if (txn.isDeleted) {
                cardClasses = "bg-gray-50/50 dark:bg-[#1c1c1e]/60 rounded-[15px] shadow-sm border border-gray-200/80 dark:border-gray-800 flex active:scale-95 transition-transform overflow-hidden opacity-85 w-fit";
                const trashIcon = `<svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
                const directionIcon = txn.isGive 
                    ? `<svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>` 
                    : `<svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
                const delText = txn.isGive ? `<span class="tracking-[0.05em]">Credit Deleted</span>` : `<span>Payment Deleted</span>`;
                
                innerContent = `
                    <div class="px-3 py-2.5 flex items-center gap-2.5">
                        <div class="flex items-center gap-1">${trashIcon}<span class="text-[11.5px] italic font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">${delText}</span></div>
                        <div class="flex items-center gap-0.5">${directionIcon}<span class="line-through font-bold text-[15px] text-gray-400 dark:text-gray-500">₹${txn.amount}</span></div>
                        <span class="text-[10px] text-gray-400/80 dark:text-gray-500 font-medium whitespace-nowrap ml-1">${txn.time}</span>
                    </div>`;
            } else {
                cardClasses = "bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm border border-gray-300 dark:border-gray-600 flex flex-col max-w-[75%] min-w-[170px] active:scale-95 transition-transform overflow-hidden block";
                const arrowIcon = txn.isGive 
                    ? `<svg class="w-5 h-5 mr-1.5 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>` 
                    : `<svg class="w-5 h-5 mr-1.5 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;

                const editStripHTML = txn.is_edited 
                    ? `<div class="w-full bg-slate-300 dark:bg-slate-800 px-4 py-1 border-b border-black/5 dark:border-white/5"><div class="flex items-center"><svg class="w-3.5 h-3.5 mr-1.5 text-[#486360] dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg><span class="text-[12px] font-semibold text-[#486360] dark:text-gray-300">Edited</span></div></div>` 
                    : "";

                let imageHTML = "";
                if (txn.bill_paths && txn.bill_paths.length > 0) {
                    let badgeHTML = txn.bill_paths.length > 1 ? `<div class="absolute top-2 right-2 bg-black/75 text-white text-[12px] font-bold px-2.5 py-1 rounded-md z-10 backdrop-blur-sm shadow-sm border border-white/10">+${txn.bill_paths.length - 1}</div>` : "";
                    const emptySrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                    imageHTML = `<div class="relative w-full h-32 border-b border-gray-200 dark:border-[#2a2a2e] bg-[#e2e8f0] dark:bg-[#252527] shrink-0 flex items-center justify-center overflow-hidden"><span id="loading-txt-${uniqueTxnId}" class="absolute text-xs text-gray-500 dark:text-gray-400 font-medium">Loading...</span>${badgeHTML}<img id="img-${uniqueTxnId}" src="${emptySrc}" class="absolute inset-0 w-full h-full object-cover z-0 opacity-0 transition-opacity duration-300" alt=""></div>`;
                    pendingImagesLocal.push({ id: uniqueTxnId, fileName: txn.bill_paths[0] });
                }

                innerContent = `
                    ${editStripHTML}
                    ${imageHTML}
                    <div class="px-4 py-3">
                        <div class="flex items-center justify-between gap-4 w-full">
                            <div class="flex items-center font-bold text-lg text-gray-900 dark:text-gray-100">
                                ${arrowIcon} ₹${txn.amount}
                            </div>
                            <div class="text-[11px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap self-center text-right">${txn.time}</div>
                        </div>
                        ${txn.hasNote ? `<p class="text-[13px] text-gray-600 dark:text-gray-300 mt-2 border-t border-gray-100 dark:border-[#2a2a2e] pt-2 break-words leading-relaxed">${txn.actualNote}</p>` : ""}
                    </div>`;
            }

            // SPA Route to Entry Details
            htmlStrings.push(`
                <div class="mb-5 flex flex-col ${txn.isGive ? 'items-end' : 'items-start'} w-full">
                    <a onclick="AppRouter.navigate('screen-entry-details', {id: '${uniqueTxnId}', custId: '${custId}'})" class="${cardClasses} cursor-pointer">
                        ${innerContent}
                    </a>
                    <p class="text-[11px] mt-1.5 font-medium px-1 text-gray-500 dark:text-gray-400 lowercase">${txn.balTxt}</p>
                </div>`);

            const nextTxn = reversedTxns[i + 1];
            if (!nextTxn || nextTxn.dStr !== txn.dStr) {
                htmlStrings.push(`<div class="flex justify-center mb-6 mt-2"><span class="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm border border-slate-300 dark:border-slate-700 text-xs px-4 py-1.5 rounded-full font-bold tracking-wide">${txn.dStr}</span></div>`);
            }
        }

        container.innerHTML = htmlStrings.join('');

        pendingImagesLocal.forEach(item => {
            const imgElement = document.getElementById(`img-${item.id}`);
            const loadingTxt = document.getElementById(`loading-txt-${item.id}`);
            if (!imgElement) return;

            if (window.cordova && cordova.file && cordova.file.dataDirectory) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + item.fileName, function(fileEntry) {
                    imgElement.src = fileEntry.toInternalURL();
                    imgElement.onload = () => { 
                        imgElement.classList.remove('opacity-0'); 
                        if(loadingTxt) loadingTxt.style.display = 'none'; 
                    };
                }, function() {
                    if(loadingTxt) loadingTxt.textContent = "Missing";
                });
            } else {
                if(loadingTxt) loadingTxt.textContent = "No Preview";
            }
        });
    }

    window.renderLedgerTransactions(enrichedTxns);

    // ===============================================
    // 🟢 SEARCH LOGIC (Renamed IDs to prevent clash)
    // ===============================================
    const searchBtn = document.getElementById('ledger-search-toggle-btn');
    const btnCancelSearch = document.getElementById('ledger-cancel-search-btn'); 
    const btnClearSearch = document.getElementById('ledger-btn-clear-search');
    const headerNormal = document.getElementById('ledger-header-normal');
    const headerSearch = document.getElementById('ledger-header-search');
    const searchInput = document.getElementById('ledger-search-input');
    
    const mainFooter = document.getElementById('ledger-footer');
    const bottomControls = document.getElementById('bottom-controls-container');
    const ledgerMain = document.getElementById('ledger-main');

    window.toggleLedgerSearch = function() {
        if (!isLedgerSearchOpen) {
            if (headerNormal) headerNormal.classList.add('opacity-0', 'pointer-events-none');
            if (headerSearch) headerSearch.classList.remove('opacity-0', 'pointer-events-none');
            
            if (mainFooter) mainFooter.style.display = 'none';
            if (bottomControls) bottomControls.style.display = 'none';
            if (ledgerMain) ledgerMain.style.paddingBottom = '0px';
            
            isLedgerSearchOpen = true;
            if (searchInput) setTimeout(() => searchInput.focus(), 50);
            
        } else {
            if (headerSearch) headerSearch.classList.add('opacity-0', 'pointer-events-none');
            if (headerNormal) headerNormal.classList.remove('opacity-0', 'pointer-events-none');
            
            if (mainFooter) mainFooter.style.display = '';
            if (bottomControls) bottomControls.style.display = '';
            if (ledgerMain) ledgerMain.style.paddingBottom = '';
            
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
                if (btnClearSearch) btnClearSearch.classList.add('hidden');
            }
            isLedgerSearchOpen = false;
            window.renderLedgerTransactions(enrichedTxns); 
        }
    };

    if(searchBtn) searchBtn.addEventListener('click', window.toggleLedgerSearch);
    if(btnCancelSearch) btnCancelSearch.addEventListener('click', window.toggleLedgerSearch);

    if (btnClearSearch && searchInput) {
        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            btnClearSearch.classList.add('hidden');
            searchInput.focus(); 
            window.renderLedgerTransactions(enrichedTxns);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === "") {
                if(btnClearSearch) btnClearSearch.classList.add('hidden');
                window.renderLedgerTransactions(enrichedTxns);
                return;
            } else {
                if(btnClearSearch) btnClearSearch.classList.remove('hidden');
            }

            const filtered = enrichedTxns.filter(t => {
                const amtMatch = String(t.amount).includes(query);
                const noteMatch = t.actualNote.toLowerCase().includes(query);
                const typeMatch = t.type && t.type.toLowerCase().includes(query);
                let dateMatch = false;
                
                if (!isNaN(query) && query.length < 4) {
                    const dayPart = t.dStr.split(' ')[0]; 
                    dateMatch = dayPart.includes(query);
                } else {
                    dateMatch = t.dStr.toLowerCase().includes(query);
                }
                return amtMatch || noteMatch || typeMatch || dateMatch; 
            });
            window.renderLedgerTransactions(filtered);
        });
    }

    // ===============================================
    // 🟢 WHATSAPP LOGIC
    // ===============================================
    const waClickHandler = (e) => {
        e.preventDefault();
        const phoneStr = currentLedgerCustomerObj.phone;
        if (!phoneStr || phoneStr.trim() === "") {
            if(window.showAppToast) window.showAppToast("Phone number missing for this customer.");
            return;
        }
        sendWhatsAppReminder(currentLedgerCustomerObj.name, total, phoneStr);
    };

    const stripWaBtn = document.getElementById('strip-wa');
    const modalWaBtn = document.getElementById('modal-wa');
    if (stripWaBtn) stripWaBtn.onclick = waClickHandler;
    if (modalWaBtn) modalWaBtn.onclick = waClickHandler;

    document.getElementById('strip-balance-value').textContent = `₹${Math.abs(total)}`;
    
    const sBal = document.getElementById('strip-balance-value');
    const sArrow = document.getElementById('strip-balance-arrow');
    if (sBal && sArrow) {
        if (total < 0) {
            sBal.className = "text-[18px] font-bold tracking-tight text-[#ef4444]";
            sArrow.setAttribute("class", "w-4 h-4 text-[#ef4444]");
        } else if (total > 0) {
            sBal.className = "text-[18px] font-bold tracking-tight text-[#22c55e]";
            sArrow.setAttribute("class", "w-4 h-4 text-[#22c55e]");
        } else {
            sBal.className = "text-[18px] font-bold tracking-tight text-gray-800 dark:text-gray-200";
            sArrow.setAttribute("class", "w-4 h-4 text-gray-800 dark:text-gray-200");
        }
    }
    document.getElementById('strip-balance-label').textContent = `Balance ${total < 0 ? 'Due' : (total > 0 ? 'Advance' : 'Settled')}`;
}

function sendWhatsAppReminder(customerName, amount, customerPhone) {
    if (!window.plugins || !window.plugins.socialsharing) {
        if(window.showAppToast) window.showAppToast("Share plugin not installed.");
        return;
    }
    let formattedPhone = customerPhone.replace(/\D/g, ''); 
    if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone; 

    let waText = "";
    const separator = "━━━━━━━━━━━━━━━━━━━━";

    if (amount < 0) {
        waText = `*Khata App Update*\n${separator}\nTo: ${customerName}\n\n*Payment Due Reminder*\nTotal Amount: *₹${Math.abs(amount)}*\n${separator}\n_Please clear your due amount at the earliest._`;
    } else if (amount > 0) {
        waText = `*Khata App Update*\n${separator}\nTo: ${customerName}\n\n*Advance Balance Update*\nTotal Amount: *₹${Math.abs(amount)}*\n${separator}\n_Your advance balance is safely updated. Thank you!_`;
    } else {
        waText = `*Khata App Update*\n${separator}\nTo: ${customerName}\n\n*Account Fully Settled*\nTotal Amount: *₹0*\n${separator}\n_Your account is clear. Thank you._`;
    }

    window.plugins.socialsharing.shareViaWhatsAppToReceiver(
        formattedPhone, waText, null, null,
        function() { },
        function(err) { if(window.showAppToast) window.showAppToast("WhatsApp share failed."); }
    );
}
