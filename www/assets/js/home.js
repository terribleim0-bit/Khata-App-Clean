// assets/js/home.js

function getFormattedDate(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

// Global Variables
let allCustomers = [];
const listContainer = document.getElementById('customer-list');
const totalBalanceEl = document.getElementById('total-balance'); 
const accountCountEl = document.getElementById('account-count');
const totalStatusEl = document.getElementById('total-status');

// Naviyan Search IDs
const searchBtn = document.getElementById('search-toggle-btn');
const btnCancelSearch = document.getElementById('cancel-search-btn');
const btnClearSearch = document.getElementById('btn-clear-search'); 
const headerNormal = document.getElementById('header-normal');
const headerSearch = document.getElementById('header-search');
const searchInput = document.getElementById('search-input');
const fabContainer = document.getElementById('fab-container');
const netBalanceCard = document.getElementById('net-balance-card');
const mainScrollArea = document.getElementById('main-scroll-area');

let lastScrollTop = 0;
let isSearchOpen = false;

// Initialize on Device Ready OR when Router loads the screen
document.addEventListener('deviceready', checkSecurityAndLoad, false);

// 🟢 THE MAGIC: Reload data instantly whenever user comes back to Home Screen
document.addEventListener('screenChanged', (e) => {
    if (e.detail.screenId === 'screen-home') {
        loadCustomersFromDB();
    }
});

function checkSecurityAndLoad() {
    const isLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
    const isUnlocked = sessionStorage.getItem('unlocked') === 'true';

    if (isLockEnabled && !isUnlocked) {
        document.body.classList.add('app-locked');
        if (window.Fingerprint) {
            Fingerprint.show({
                title: 'Unlock Khata App',
                description: 'Verify identity to view your ledger',
                fallbackButtonTitle: 'Use PIN'
            }, function (success) {
                sessionStorage.setItem('unlocked', 'true');
                document.body.classList.remove('app-locked');
                loadCustomersFromDB(); 
            }, function (error) {
                navigator.app.exitApp();
            });
        }
    } else {
        loadCustomersFromDB(); 
    }
}

// Floating Action Button Scroll Animation
if(mainScrollArea) {
    mainScrollArea.addEventListener('scroll', function(e) {
        let currentScroll = e.target.scrollTop || 0;
        if (currentScroll > lastScrollTop && currentScroll > 10) {
            fabContainer.classList.add('shrunk');
        } else {
            fabContainer.classList.remove('shrunk');
        }
        lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    }, true);
}

// Search Logic
window.toggleSearch = function() {
    if (!isSearchOpen) {
        if (headerNormal) headerNormal.classList.add('opacity-0', 'pointer-events-none');
        if (headerSearch) headerSearch.classList.remove('opacity-0', 'pointer-events-none');
        if (fabContainer) fabContainer.classList.add('hidden-state');
        if (netBalanceCard) {
            netBalanceCard.style.transition = "none";
            netBalanceCard.style.display = 'none';
        }
        setTimeout(() => { if (searchInput) searchInput.focus(); }, 50);
        isSearchOpen = true;
    } else {
        if (headerSearch) headerSearch.classList.add('opacity-0', 'pointer-events-none');
        if (headerNormal) headerNormal.classList.remove('opacity-0', 'pointer-events-none');
        if (fabContainer) fabContainer.classList.remove('hidden-state');
        if (netBalanceCard) netBalanceCard.style.display = '';
        if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }
        if (btnClearSearch) btnClearSearch.classList.add('hidden'); 
        isSearchOpen = false;
        renderCustomers(allCustomers); 
    }
};

if (searchBtn) searchBtn.addEventListener('click', window.toggleSearch);
if (btnCancelSearch) btnCancelSearch.addEventListener('click', window.toggleSearch);

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (btnClearSearch) {
            if (searchTerm.length > 0) btnClearSearch.classList.remove('hidden');
            else btnClearSearch.classList.add('hidden');
        }
        const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCustomers(filtered);
    });
}

if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus(); 
    });
}

// Load from DB
function loadCustomersFromDB() {
    if (!window.db) return; 
    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers', [], function(tx, rs) {
            allCustomers = [];
            for(let i = 0; i < rs.rows.length; i++) {
                allCustomers.push(rs.rows.item(i));
            }
            if (searchInput) searchInput.value = '';
            renderCustomers(allCustomers);
        }, function(tx, error) {
            console.log('Error fetching customers: ' + error.message);
        });
    });
}

// Smart Date Filter
function formatRelativeActivityText(text) {
    if (!text) return "";
    const now = new Date();
    const currentYear = now.getFullYear();
    const today = new Date(currentYear, now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const dateRegex = /(\d{1,2})\s([A-Z][a-z]{2}),\s(\d{4})/;
    const match = text.match(dateRegex);
    
    if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2];
        const year = parseInt(match[3], 10);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = months.indexOf(monthStr);
        const entryDate = new Date(year, monthIndex, day);
        let formattedDate = "";
        
        if (entryDate.getTime() === today.getTime()) {
            formattedDate = "Today";
        } else if (entryDate.getTime() === yesterday.getTime()) {
            formattedDate = "Yesterday";
        } else if (year === currentYear) {
            formattedDate = `${day} ${monthStr}`; 
        } else {
            formattedDate = `${day} ${monthStr}, ${year}`; 
        }
        
        let result = text.replace(match[0], formattedDate);
        result = result.replace(' Added on ', ' • ');
        result = result.replace(' Edited on ', ' (Edit) • ');
        result = result.replace(' Deleted on ', ' (Del) • ');
        result = result.replace('Added on ', '');
        result = result.replace('Added On ', '');
        return result;
    }
    return text; 
}

// Render UI
function renderCustomers(customers) {
    if (!listContainer) return;

    if (customers.length === 0) {
        listContainer.className = "";
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-secondary">
                <p class="text-[15px] font-medium">No customers found.</p>
            </div>`;
        if (accountCountEl) accountCountEl.innerHTML = '0 Accounts';
        if (totalBalanceEl) {
            totalBalanceEl.textContent = '₹0';
            totalBalanceEl.className = 'text-[17px] font-semibold text-primary';
        }
        if (totalStatusEl) totalStatusEl.textContent = 'Settled';
        return;
    }

    listContainer.className = "bg-card rounded-2xl overflow-hidden shadow-sm mb-4 transition-colors";
    listContainer.innerHTML = '';
    
    let totalNet = 0;

    customers.forEach((cust) => {
        const bal = parseFloat(cust.balance) || 0;
        totalNet += bal;
        const formattedBal = Math.abs(bal).toLocaleString('en-IN');
        
        let balClass = 'text-primary';
        let statusText = 'Settled';
        
        if (bal > 0) {
            balClass = 'text-status-green';
            statusText = 'Advance';
        } else if (bal < 0) {
            balClass = 'text-status-red';
            statusText = 'Due';
        }

        let subTextHTML = '';
        let rawText = '';
        let isPayment = false;

        if (cust.last_activity_text && cust.last_activity_text.includes('₹')) {
            rawText = cust.last_activity_text;
            isPayment = true;
        } else {
            rawText = cust.last_activity_text || `Added On ${cust.created_at || 'Recently'}`;
            isPayment = false;
        }

        const finalActivityText = formatRelativeActivityText(rawText);

        if (isPayment) {
            subTextHTML = `
                <div class="flex items-center gap-1 text-secondary min-w-0 flex-1 pr-2">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                    <span class="text-[11.5px] tracking-tight truncate">${finalActivityText}</span>
                </div>`;
        } else {
            subTextHTML = `
                <div class="flex items-center gap-1 text-secondary min-w-0 flex-1 pr-2">
                    <svg class="w-3.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span class="text-[11.5px] tracking-tight truncate">${finalActivityText}</span>
                </div>`;
        }

        // 🟢 THE MAGIC: AppRouter.navigate changed here
        const itemHTML = `
            <a onclick="AppRouter.navigate('screen-ledger', {id: '${cust.id}'})" class="group flex items-center pl-4 transition-all cursor-pointer active:scale-[0.98] active:opacity-70 block">
                <div class="w-10 h-10 rounded-full bg-avatar text-white flex items-center justify-center font-semibold text-[17px] shrink-0 uppercase">
                    ${cust.name.charAt(0)}
                </div>
                <div class="flex-1 flex flex-col justify-center ml-3 min-w-0">
                    <div class="py-3 pr-4 flex flex-col justify-center gap-1">
                        <div class="flex justify-between items-center">
                            <h3 class="text-[15px] font-normal text-primary truncate pr-2">${cust.name}</h3>
                            <p class="text-[16px] font-semibold ${balClass} tracking-wide shrink-0">₹${formattedBal}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            ${subTextHTML}
                            <p class="text-[11.5px] text-secondary tracking-tight shrink-0 text-right">${statusText}</p>
                        </div>
                    </div>
                    <div class="h-[1px] bg-line mr-4 group-last:hidden"></div>
                </div>
            </a>
        `;
        listContainer.innerHTML += itemHTML;
    });

    if (customers === allCustomers) {
        if (accountCountEl) {
            accountCountEl.innerHTML = `
                <div class="flex items-center gap-1 text-secondary mt-0.5">
                    <svg class="w-3.5 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span class="text-[13px] tracking-tight">${customers.length} Accounts</span>
                </div>`;
        }
        if (totalBalanceEl && totalStatusEl) {
            const formattedTotalNet = Math.abs(totalNet).toLocaleString('en-IN');
            totalBalanceEl.textContent = `₹${formattedTotalNet}`;
            
            if (totalNet > 0) {
                totalStatusEl.textContent = 'You Give';
                totalBalanceEl.className = 'text-[17px] font-semibold text-status-green';
            } else if (totalNet < 0) {
                totalStatusEl.textContent = 'You Get';
                totalBalanceEl.className = 'text-[17px] font-semibold text-status-red';
            } else {
                totalStatusEl.textContent = 'Settled';
                totalBalanceEl.className = 'text-[17px] font-semibold text-primary';
            }
        }
    }
}

// Keyboard logic
const bottomNav = document.getElementById('bottom-nav');
let initialWindowHeight = window.innerHeight;

window.addEventListener('resize', () => {
    if (window.innerHeight < initialWindowHeight - 150) {
        if (bottomNav) bottomNav.style.display = 'none';
    } else {
        if (bottomNav) bottomNav.style.display = 'flex';
        initialWindowHeight = window.innerHeight; 
    }
});

if (searchInput) {
    searchInput.addEventListener('focus', () => { if (bottomNav) bottomNav.style.display = 'none'; });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => { if (bottomNav) bottomNav.style.display = 'flex'; }, 100);
    });
}
