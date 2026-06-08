// assets/js/home.js
// 🟢 HELPER: Get Formatted Date (e.g., "2 May, 2026")
function getFormattedDate(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}


document.addEventListener('deviceready', () => {
    // App Lock Logic
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

    document.addEventListener("backbutton", function (e) {
        e.preventDefault();
        navigator.app.exitApp(); 
    }, false);
    
    window.addEventListener('pageshow', () => {
        loadCustomersFromDB();
    });
}, false);

// Global Variables
let allCustomers = [];
const listContainer = document.getElementById('customer-list');
const totalBalanceEl = document.getElementById('total-balance'); 
const accountCountEl = document.getElementById('account-count');
const totalStatusEl = document.getElementById('total-status');

// 🟢 NAVIYAN SEARCH IDs
const searchBtn = document.getElementById('search-toggle-btn');
const btnCancelSearch = document.getElementById('cancel-search-btn');
const btnClearSearch = document.getElementById('btn-clear-search'); // Nawa cross button
const headerNormal = document.getElementById('header-normal');
const headerSearch = document.getElementById('header-search');
const searchInput = document.getElementById('search-input');
const fabContainer = document.getElementById('fab-container');
const netBalanceCard = document.getElementById('net-balance-card');

let lastScrollTop = 0;
let isSearchOpen = false;

// Floating Action Button Scroll Animation
window.addEventListener('scroll', function(e) {
    let currentScroll = e.target.scrollTop || window.scrollY || 0;
    if (currentScroll > lastScrollTop && currentScroll > 10) {
        fabContainer.classList.add('shrunk');
    } else {
        fabContainer.classList.remove('shrunk');
    }
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
}, true);

// ===============================================
// 🟢 SEARCH LOGIC (Empty Space Fix + Cross Button)
// ===============================================
window.toggleSearch = function() {
    if (!isSearchOpen) {
        // 🟢 OPEN SEARCH
        if (headerNormal) headerNormal.classList.add('opacity-0', 'pointer-events-none');
        if (headerSearch) headerSearch.classList.remove('opacity-0', 'pointer-events-none');
        
        if (fabContainer) fabContainer.classList.add('hidden-state');
        
        // FIX: style.display = 'none' naal khali jagah (gap) poori tarah khatam ho jayegi
        if (netBalanceCard) {
            netBalanceCard.style.transition = "none";
            netBalanceCard.style.display = 'none';
        }
        
        setTimeout(() => {
            if (searchInput) searchInput.focus();
        }, 50);
        isSearchOpen = true;
    } else {
        // 🔴 CLOSE SEARCH
        if (headerSearch) headerSearch.classList.add('opacity-0', 'pointer-events-none');
        if (headerNormal) headerNormal.classList.remove('opacity-0', 'pointer-events-none');
        
        if (fabContainer) fabContainer.classList.remove('hidden-state');
        
        // FIX: Card wapas layaunda hai
        if (netBalanceCard) {
            netBalanceCard.style.display = '';
        }
        
        if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }
        
        if (btnClearSearch) btnClearSearch.classList.add('hidden'); // Cross hide karo
        
        isSearchOpen = false;
        renderCustomers(allCustomers); 
    }
};

if (searchBtn) searchBtn.addEventListener('click', window.toggleSearch);
if (btnCancelSearch) btnCancelSearch.addEventListener('click', window.toggleSearch);

// Search Input te Cross Button show/hide logic
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        // Cross button logic
        if (btnClearSearch) {
            if (searchTerm.length > 0) btnClearSearch.classList.remove('hidden');
            else btnClearSearch.classList.add('hidden');
        }

        const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCustomers(filtered);
    });
}

// Cross button nappan te search khali karan da logic
if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus(); // Wapas keyboard khol ke rakho
    });
}

// SQLite Mathi Customers Load Karvanu Function
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
// Dynamic Date Filter: Converts exact dates to Today/Yesterday and removes year
function formatRelativeActivityText(text) {
    if (!text) return "";
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Tuhadi app de exact date format naal match karna (e.g., "8 Jun, 2026")
    const todayStr = `${today.getDate()} ${months[today.getMonth()]}, ${today.getFullYear()}`;
    const yesterdayStr = `${yesterday.getDate()} ${months[yesterday.getMonth()]}, ${yesterday.getFullYear()}`;
    
    let result = text;
    
    if (result.includes(todayStr)) {
        // Ajj di entry
        result = result.replace(` Added on ${todayStr}`, ' • Today');
        result = result.replace(` Edited on ${todayStr}`, ' (Edit) • Today');
        result = result.replace(` Deleted on ${todayStr}`, ' (Del) • Today');
        result = result.replace(`Added on ${todayStr}`, 'Today');
        result = result.replace(`Added On ${todayStr}`, 'Today');
        result = result.replace(todayStr, 'Today'); // Safety fallback
    } else if (result.includes(yesterdayStr)) {
        // Kal di entry
        result = result.replace(` Added on ${yesterdayStr}`, ' • Yesterday');
        result = result.replace(` Edited on ${yesterdayStr}`, ' (Edit) • Yesterday');
        result = result.replace(` Deleted on ${yesterdayStr}`, ' (Del) • Yesterday');
        result = result.replace(`Added on ${yesterdayStr}`, 'Yesterday');
        result = result.replace(`Added On ${yesterdayStr}`, 'Yesterday');
        result = result.replace(yesterdayStr, 'Yesterday'); // Safety fallback
    } else {
        // Purani entry (Saal hata deo te format chhota karo)
        result = result.replace(' Added on ', ' • ');
        result = result.replace(' Edited on ', ' (Edit) • ');
        result = result.replace(' Deleted on ', ' (Del) • ');
        result = result.replace('Added on ', '');
        result = result.replace('Added On ', '');
        result = result.replace(/, \d{4}/, ''); // Remove year (e.g., ", 2026")
    }
    
    return result;
}

// Render Customers & Update Net Balance
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

    // Assigning new master classes to container
    listContainer.className = "bg-card rounded-2xl overflow-hidden shadow-sm mb-4 transition-colors";
    listContainer.innerHTML = '';
    
    let totalNet = 0;

    customers.forEach((cust) => {
        const bal = parseFloat(cust.balance) || 0;
        totalNet += bal;
        
        // Main balance layi comma format
        const formattedBal = Math.abs(bal).toLocaleString('en-IN');
        
        let balClass = 'text-primary';
        let statusText = 'Settled';
        
        if (bal > 0) {
            balClass = 'text-green';
            statusText = 'Advance';
        } else if (bal < 0) {
            balClass = 'text-red';
            statusText = 'Due';
        }

        let subTextHTML = '';
        
        // Pehlan raw text kadd lao
        let rawText = '';
        let isPayment = false;

        if (cust.last_activity_text && cust.last_activity_text.includes('₹')) {
            rawText = cust.last_activity_text;
            isPayment = true;
        } else {
            rawText = cust.last_activity_text || `Added On ${cust.created_at || 'Recently'}`;
            isPayment = false;
        }

        // Text nu filter karke Today/Yesterday vich badlo
        const finalActivityText = formatRelativeActivityText(rawText);

        if (isPayment) {
            subTextHTML = `
                <div class="flex items-center gap-1 text-secondary min-w-0 flex-1 pr-2">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span class="text-[11.5px] tracking-tight truncate">${finalActivityText}</span>
                </div>`;
        } else {
            subTextHTML = `
                <div class="flex items-center gap-1 text-secondary min-w-0 flex-1 pr-2">
                    <svg class="w-3.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <span class="text-[11.5px] tracking-tight truncate">${finalActivityText}</span>
                </div>`;
        }


        const itemHTML = `
            <a href="pages/ledger.html?id=${cust.id}" class="group flex items-center pl-4 transition-all cursor-pointer active:scale-[0.98] active:opacity-70 block">
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
            // 3. Net Balance de thalle Account count de naal Profile SVG
            accountCountEl.innerHTML = `
                <div class="flex items-center gap-1 text-secondary mt-0.5">
                    <svg class="w-3.5 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <span class="text-[13px] tracking-tight">${customers.length} Accounts</span>
                </div>`;
        }
        if (totalBalanceEl && totalStatusEl) {
            // Net balance vich vi comma format apply kitta hai
            const formattedTotalNet = Math.abs(totalNet).toLocaleString('en-IN');
            totalBalanceEl.textContent = `₹${formattedTotalNet}`;
            
            if (totalNet > 0) {
                totalStatusEl.textContent = 'You Give';
                totalBalanceEl.className = 'text-[17px] font-semibold text-green';
            } else if (totalNet < 0) {
                totalStatusEl.textContent = 'You Get';
                totalBalanceEl.className = 'text-[17px] font-semibold text-red';
            } else {
                totalStatusEl.textContent = 'Settled';
                totalBalanceEl.className = 'text-[17px] font-semibold text-primary';
            }
        }
    }
}


// ===============================================
// 🟢 KEYBOARD DETECTION LOGIC (Hide Bottom Nav)
// ===============================================
const bottomNav = document.getElementById('bottom-nav');
let initialWindowHeight = window.innerHeight;

window.addEventListener('resize', () => {
    // If the window height decreases by more than 150px, keyboard is likely open
    if (window.innerHeight < initialWindowHeight - 150) {
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }
    } else {
        // Keyboard closed, show nav again
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }
        // Update initial height in case of device rotation
        initialWindowHeight = window.innerHeight; 
    }
});

// Also hide nav strictly when search input is focused
if (searchInput) {
    searchInput.addEventListener('focus', () => {
        if (bottomNav) bottomNav.style.display = 'none';
    });
    searchInput.addEventListener('blur', () => {
         // Use setTimeout to allow click events elsewhere to process before nav reappears
        setTimeout(() => {
             if (bottomNav) bottomNav.style.display = 'flex';
        }, 100);
    });
}
