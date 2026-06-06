// ===============================================
// 🟢 STATE MANAGER (Hardware Back Button & Search)
// ===============================================
let isModalOpen = false;
let isSearchOpen = false;

document.addEventListener('deviceready', function() {
    
    // Hardware back button logic
    document.addEventListener('backbutton', function (e) {
        e.preventDefault();
        
        if (isModalOpen) {
            toggleModal(); // Close modal first
            return;
        }
        
        if (isSearchOpen) {
            toggleSearch(); // Close search next
            return;
        }
        
        // Silent exit
        history.back(); 
    }, false);

    // Resume lock logic
    document.addEventListener('resume', function() {
        const isLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
        if (isLockEnabled) {
            sessionStorage.removeItem('unlocked');
            window.location.replace('lock.html');
        }
    }, false);
    
    // Custom header back button link
    const backBtn = document.getElementById('back-btn');
    if(backBtn) {
        backBtn.addEventListener('click', () => {
            if (isModalOpen) toggleModal();
            else if (isSearchOpen) toggleSearch();
            else history.back();
        });
    }
    
    loadLedgerData();
}, false);
// ===============================================
// 🟢 FLOATING SCROLL-TO-BOTTOM LOGIC
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    // 🟢 NAVA FIX: Hun aapa 'transaction-container' di scroll track karni hai
    const scrollContainer = document.getElementById('transaction-container');
    const fabScrollBottom = document.getElementById('fab-scroll-bottom');

    if (scrollContainer && fabScrollBottom) {
        scrollContainer.addEventListener('scroll', () => {
            // Reverse list vich scroll thalle 0 hunda hai, upar jaan te negative (minus) hunda hai
            const scrolledAmount = Math.abs(scrollContainer.scrollTop);
            
            // Je 150px ton zyada upar gya, taan button dikhao
            if (scrolledAmount > 150) {
                fabScrollBottom.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
            } else {
                fabScrollBottom.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
            }
        });

        // Button click hon te wapas '0' (Bottom) te le aao
        fabScrollBottom.addEventListener('click', () => {
            scrollContainer.scrollTo({
                top: 0, // Reverse flexbox ch 0 da matlab thalle (bottom) hunda hai!
                behavior: 'smooth'
            });
        });
    }
});
// Page cache reload fallback
window.addEventListener('pageshow', function (event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        window.location.reload();
    }
});

// ===============================================
// 🟢 MODAL TOGGLE & SWIPE DOWN TO CLOSE (GPU Accel)
// ===============================================
function toggleModal() {
    const m = document.getElementById('moreModal');
    const c = document.getElementById('modalContent');
    if(!m || !c) return;
    
    if(!isModalOpen) {
        // Open
        m.classList.remove('hidden');
        isModalOpen = true;
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            c.style.transform = 'translateY(0)';
        });
    } else {
        // Close
        isModalOpen = false;
        requestAnimationFrame(() => {
            m.classList.add('opacity-0');
            c.style.transform = 'translateY(100%)';
        });
        setTimeout(() => m.classList.add('hidden'), 300);
    }
}

// Swipe down logic
const modalContent = document.getElementById('modalContent');
if(modalContent) {
    let startY = 0;
    let currentY = 0;
    
    modalContent.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        modalContent.style.transition = 'none'; // Disable transition during drag
    }, {passive: true});

    modalContent.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        let deltaY = currentY - startY;
        if (deltaY > 0) { // Only allow swiping down
            requestAnimationFrame(() => {
                modalContent.style.transform = `translateY(${deltaY}px)`;
            });
        }
    }, {passive: true});

    modalContent.addEventListener('touchend', (e) => {
        modalContent.style.transition = 'transform 0.3s ease-out'; // Restore transition
        let deltaY = currentY - startY;
        
        if (deltaY > 60) {
            // Threshold passed, close modal
            toggleModal();
        } else {
            // Snap back up
            requestAnimationFrame(() => {
                modalContent.style.transform = 'translateY(0)';
            });
        }
    });
}

// ===============================================
// 🟢 MAIN SQLITE LOAD EVENT
// ===============================================
function loadLedgerData() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let custId = urlParams.get('id');

        if(!custId) {
            history.back(); // Silent exit
            return;
        }
        
        if(!db) {
            if(window.showAppToast) window.showAppToast("Database connection failed");
            return;
        }

        db.transaction(function(tx) {
            tx.executeSql('SELECT * FROM customers WHERE id = ?', [custId], function(tx, rs) {
                if(rs.rows.length === 0) {
                    let dummyCustomer = { id: custId, name: 'Customer (Unsaved)', balance: 0, transactions: [] };
                    setupUI(dummyCustomer, custId);
                    return;
                }
                
                let customer = rs.rows.item(0);
                
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
                }, function(tx, error) {
                    if(window.showAppToast) window.showAppToast("Failed to load transactions.");
                });
            }, function(tx, error) {
                if(window.showAppToast) window.showAppToast("Failed to load customer profile.");
            });
        }, function(error) {
            // If the query fails (e.g., empty table), load the empty UI
            let dummyCustomer = { id: custId, name: 'Customer', balance: 0, transactions: [] };
            setupUI(dummyCustomer, custId);
        });
        
    } catch (e) {
        if(window.showAppToast) window.showAppToast("App encountered an error.");
    }
}
// ===============================================
// 🟢 UI SETUP & BATCH RENDERING
// ===============================================
function setupUI(customer, custId) {
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const setHref = (id, url) => { const el = document.getElementById(id); if (el) el.href = url; };

    setText('header-name', customer.name);
    setText('header-initial', customer.name.charAt(0).toUpperCase());
    
    const profileLink = document.getElementById('header-profile-link');
    if (profileLink) profileLink.onclick = () => window.location.href = `profile.html?id=${custId}`;

    setHref('receive-btn', `add_entry.html?type=receive&id=${custId}`);
    setHref('give-btn', `add_entry.html?type=given&id=${custId}`);
    setHref('strip-delete', `delete_customer.html?id=${custId}`);
    setHref('strip-statement', `statement.html?id=${custId}`);
    setHref('modal-statement', `statement.html?id=${custId}`);
    setHref('modal-delete', `delete_customer.html?id=${custId}`);
    setHref('strip-balance-btn', `statement.html?id=${custId}`);

    // 🟢 NAVA FIX: Hun patti safe rahegi, entries sirf wrapper ch jangiyan
    const container = document.getElementById('transactions-wrapper');
    if(container) container.innerHTML = '';
    
    // SAFE DATE PARSER (Optimized for speed)
    const parseDateSafe = (dateVal) => {
        if (!dateVal) return new Date();
        if (!isNaN(dateVal) && String(dateVal).trim() !== "") return new Date(Number(dateVal));
        if (typeof dateVal === 'string' && dateVal.includes('-') && dateVal.length === 10) {
            const parts = dateVal.split('-'); return new Date(parts[0], parts[1] - 1, parts[2]); 
        }
        const d = new Date(dateVal); return isNaN(d.getTime()) ? new Date() : d;
    };

    // Prepare data once in memory
    let running = 0;
    const enrichedTxns = (customer.transactions || []).map(txn => {
        const isGive = txn.type === 'given';
        const isDeleted = (txn.is_deleted == 1 || String(txn.is_deleted) === 'true');

        if (!isDeleted) {
            running += isGive ? -parseFloat(txn.amount) : parseFloat(txn.amount);
        }

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

    // 🚀 BATCH RENDER FUNCTION (Fast DOM Updates - WhatsApp Style Reversed)
    function renderTransactions(txnsToRender) {
        if(!container) return;
        
        if (txnsToRender.length === 0) {
            const searchVal = searchInput ? searchInput.value.trim() : "";
            if (searchVal !== "") {
                container.innerHTML = `<div class="flex justify-center items-center h-32 text-gray-500 dark:text-gray-400 text-sm font-medium">No matches found</div>`;
            } else {
                container.innerHTML = `<div class="flex flex-col justify-center items-center h-40 opacity-70">
                    <svg class="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span class="text-gray-500 dark:text-gray-400 text-sm font-medium">No transactions found</span>
                </div>`;
            }
            return;
        }

        // 🟢 ASLI JADOO: Array nu putha (reverse) karo taaki Newest entry DOM ch sab ton upar hove
        const reversedTxns = [...txnsToRender].reverse();
        
        let htmlStrings = [];
        pendingImagesLocal = [];

        // Loop hun navi entry ton purani entry wal chalega
        for (let i = 0; i < reversedTxns.length; i++) {
            const txn = reversedTxns[i];
            const uniqueTxnId = txn.id || 'txn_' + Math.random().toString(36).substr(2, 9);
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
                                ${arrowIcon}
                                ₹${txn.amount}
                            </div>
                            <div class="text-[11px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap self-center text-right">${txn.time}</div>
                        </div>
                        ${txn.hasNote ? `<p class="text-[13px] text-gray-600 dark:text-gray-300 mt-2 border-t border-gray-100 dark:border-[#2a2a2e] pt-2 break-words leading-relaxed">${txn.actualNote}</p>` : ""}
                    </div>`;
            }

            // Pehlan Card HTML ch pao (DOM ch upar jayega, screen te thalle disega)
            htmlStrings.push(`
                <div class="mb-5 flex flex-col ${txn.isGive ? 'items-end' : 'items-start'} w-full">
                    <a href="entry_details.html?id=${uniqueTxnId}&custId=${custId}" class="${cardClasses}">
                        ${innerContent}
                    </a>
                    <p class="text-[11px] mt-1.5 font-medium px-1 text-gray-500 dark:text-gray-400 lowercase">${txn.balTxt}</p>
                </div>`);

            // 🟢 REVERSE DATE LOGIC: Check karo ki AGLI entry (jo us ton purani hai) di date farak hai?
            const nextTxn = reversedTxns[i + 1];
            if (!nextTxn || nextTxn.dStr !== txn.dStr) {
                // Je date badal gayi (ya eh aakhri entry hai), taan Date Badge la do
                htmlStrings.push(`<div class="flex justify-center mb-6 mt-2"><span class="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm border border-slate-300 dark:border-slate-700 text-xs px-4 py-1.5 rounded-full font-bold tracking-wide">${txn.dStr}</span></div>`);
            }
        }

        // Draw karo ek hi vaar ch
        container.innerHTML = htmlStrings.join('');

        // Images load karo (Koi scroll hack di lod nahi!)
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
                    if(loadingTxt) loadingTxt.textContent = "Image Missing";
                });
            } else {
                if(loadingTxt) loadingTxt.textContent = "No Preview";
            }
        });
    }

    renderTransactions(enrichedTxns);

    // ===============================================
    // 🟢 SEARCH LOGIC (Fixed Header Swap + Clean Hide)
    // ===============================================
    const searchBtn = document.getElementById('search-toggle-btn');
    const btnCancelSearch = document.getElementById('cancel-search-btn'); // Cancel button di ID
    
    // Purane header variables wapas liyande
    const headerNormal = document.getElementById('header-normal');
    const headerSearch = document.getElementById('header-search');
    
    const searchInput = document.getElementById('search-input');
    const mainFooter = document.getElementById('main-footer');
    const bottomControls = document.getElementById('bottom-controls-container');
    const ledgerMain = document.getElementById('ledger-main');

    window.toggleSearch = function() {
        if (!isSearchOpen) {
            // 🟢 OPEN SEARCH (Header Swap)
            if (headerNormal) headerNormal.classList.add('opacity-0', 'pointer-events-none');
            if (headerSearch) headerSearch.classList.remove('opacity-0', 'pointer-events-none');
            
            // Thalle wali patti te buttons hide (Transparent effect)
            if (mainFooter) mainFooter.style.display = 'none';
            if (bottomControls) bottomControls.style.display = 'none';
            if (ledgerMain) ledgerMain.style.paddingBottom = '0px';
            
            if (searchInput) searchInput.focus();
            isSearchOpen = true;
        } else {
            // 🔴 CLOSE SEARCH (Header wapas laao)
            if (headerSearch) headerSearch.classList.add('opacity-0', 'pointer-events-none');
            if (headerNormal) headerNormal.classList.remove('opacity-0', 'pointer-events-none');
            
            // Thalle wale elements wapas show karo
            if (mainFooter) mainFooter.style.display = '';
            if (bottomControls) bottomControls.style.display = '';
            if (ledgerMain) ledgerMain.style.paddingBottom = '';
            
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }
            isSearchOpen = false;
            
            // List reset karo
            renderTransactions(enrichedTxns); 
        }
    };

    // Button clicks set kitte
    if(searchBtn) searchBtn.addEventListener('click', window.toggleSearch);
    if(btnCancelSearch) btnCancelSearch.addEventListener('click', window.toggleSearch);

    // Search input typing logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === "") {
                renderTransactions(enrichedTxns);
                return;
            }
            const filtered = enrichedTxns.filter(t => {
                return t.actualNote.toLowerCase().includes(query) || 
                       String(t.amount).includes(query) || 
                       t.dStr.toLowerCase().includes(query) || 
                       (t.type && t.type.toLowerCase().includes(query)); 
            });
            renderTransactions(filtered);
        });
    }



    // ===============================================
    // 🟢 WHATSAPP & BOTTOM STRIP (Standard English)
    // ===============================================
    let waText = `Hello ${customer.name},\n\n`;
    if (total < 0) waText += `Your current due balance is ₹${Math.abs(total)}. Please clear your dues at your earliest convenience.`;
    else if (total > 0) waText += `You have an advance balance of ₹${Math.abs(total)} with us.`;
    else waText += `Your account balance is completely settled.`;
    waText += `\n\nSent via Khata App`;
    
    const waMsg = encodeURIComponent(waText);
    setHref('strip-wa', `https://wa.me/?text=${waMsg}`);
    setHref('modal-wa', `https://wa.me/?text=${waMsg}`);

    setText('strip-balance-value', `₹${Math.abs(total)}`);
    
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

    setText('strip-balance-label', `Balance ${total < 0 ? 'Due' : (total > 0 ? 'Advance' : 'Settled')}`);

}    
    
