document.addEventListener('DOMContentLoaded', () => {
    
    // DOM Elements
    const viewContacts = document.getElementById('view-contacts');
    const viewManual = document.getElementById('view-manual');
    const fabContainer = document.getElementById('fab-container');
    const bottomBar = document.getElementById('bottom-bar');
    
    const searchInput = document.getElementById('search-input');
    const btnBack = document.getElementById('btn-back');
    
    // Header States & Search Controls
    const headerNormal = document.getElementById('header-normal');
    const headerSearch = document.getElementById('header-search');
    const btnOpenSearch = document.getElementById('btn-open-search');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const btnCancelSearch = document.getElementById('btn-cancel-search');
    
    // Empty State Controls
    const searchEmptyState = document.getElementById('search-empty-state');
    const btnSmartAdd = document.getElementById('btn-smart-add');
    const smartAddText = document.getElementById('smart-add-text');

    const btnFloatingManual = document.getElementById('btn-floating-manual');
    const btnManualPickContact = document.getElementById('btn-manual-pick-contact');
    
    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const confirmBtn = document.getElementById('confirm-btn');
    const contactsWrapper = document.getElementById('contacts-list-wrapper');

    // Phone Wrapper for animation
    const phoneWrapper = document.getElementById('phone-input-wrapper');

    let allDeviceContacts = []; 
    let currentActiveView = 'contacts'; 
    
    // --- Core Action (SQLITE UPDATE) ---
    function saveCustomerAndGoBack(name, phone) {
        const cleanName = name.trim();
        const custId = 'cust_' + Date.now();
        
        // Error handling if database is not loaded
        if (!window.db) {
            window.showAppToast("Database not ready", "error");
            return;
        }

        db.transaction(function(tx) {
            tx.executeSql('INSERT INTO customers (id, name, phone, balance) VALUES (?, ?, ?, ?)', [custId, cleanName, phone, 0]);
        }, function(error) {
            window.showAppToast("Save failed!", "error");
            console.log('Insert Error: ' + error.message);
        }, function() {
            // On Success
            window.showAppToast(`Profile created for ${cleanName}`);
            setTimeout(() => { window.location.replace('../index.html'); }, 800);
        });
    }

    // --- Header Search Animation Logic ---
    if(btnOpenSearch && btnCancelSearch) {
        
        // Open Search
        btnOpenSearch.addEventListener('click', () => {
            headerNormal.classList.add('opacity-0', 'pointer-events-none');
            headerSearch.classList.remove('opacity-0', 'pointer-events-none');
            
            if(typeof fabContainer !== 'undefined' && fabContainer) {
                fabContainer.classList.add('scale-0');
            }
            
            setTimeout(() => { searchInput.focus(); }, 100);
        });

        // Cancel Search
        btnCancelSearch.addEventListener('click', () => {
            headerSearch.classList.add('opacity-0', 'pointer-events-none');
            headerNormal.classList.remove('opacity-0', 'pointer-events-none');
            
            if(typeof fabContainer !== 'undefined' && fabContainer) {
                fabContainer.classList.remove('scale-0');
            }
            
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        });
    }

    // --- Smart Search Logic ---
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            
            if(btnClearSearch) {
                if(query.length > 0) btnClearSearch.classList.remove('hidden');
                else btnClearSearch.classList.add('hidden');
            }
            
            filterContactsList(query);
        });
    }

    if(btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();
        });
    }

    function filterContactsList(query) {
        const lowerQuery = query.toLowerCase().trim();
        const items = contactsWrapper.getElementsByClassName('contact-item-node');

        if (!lowerQuery) {
            contactsWrapper.style.display = 'flex';
            if(searchEmptyState) {
                searchEmptyState.classList.add('hidden');
                searchEmptyState.classList.remove('flex');
            }
            
            for (let item of items) {
                item.style.display = 'flex';
                item.style.order = '0';
            }
            return;
        }

        let matchCount = 0;

        for (let item of items) {
            const cName = item.getAttribute('data-name').toLowerCase();
            const cPhone = item.getAttribute('data-phone').toLowerCase();
            
            if (cName.startsWith(lowerQuery)) {
                item.style.display = 'flex';
                item.style.order = '-1';
                matchCount++;
            } 
            else if (cName.includes(lowerQuery) || cPhone.includes(lowerQuery)) {
                item.style.display = 'flex';
                item.style.order = '1';
                matchCount++;
            } 
            else {
                item.style.display = 'none';
            }
        }

        if (matchCount === 0 && searchEmptyState) {
            contactsWrapper.style.display = 'none';
            searchEmptyState.classList.remove('hidden');
            searchEmptyState.classList.add('flex');
            
            if(smartAddText) smartAddText.textContent = `Add "${query}"`;
            
            if(btnSmartAdd) {
                btnSmartAdd.onclick = () => {
                    if(btnCancelSearch) btnCancelSearch.click();
                    nameInput.value = query;
                    switchViews('manual');
                    nameInput.dispatchEvent(new Event('input'));
                };
            }
        } else {
            contactsWrapper.style.display = 'flex';
            if(searchEmptyState) {
                searchEmptyState.classList.add('hidden');
                searchEmptyState.classList.remove('flex');
            }
        }
    }

    // --- Smooth View Swapping ---
    function switchViews(targetView) {
        if (targetView === 'manual') {
            viewContacts.classList.add('hidden-state');
            fabContainer.classList.add('scale-0'); 
            
            if(btnOpenSearch) btnOpenSearch.style.display = 'none';
            
            setTimeout(() => {
                viewContacts.style.display = 'none';
                viewManual.style.display = 'block';
                bottomBar.style.display = 'block';
                
                void viewManual.offsetWidth; 
                
                viewManual.classList.remove('hidden-state');
                bottomBar.classList.remove('hidden-state');
                currentActiveView = 'manual';
                nameInput.focus();
            }, 250);
        } else {
            viewManual.classList.add('hidden-state');
            bottomBar.classList.add('hidden-state');
            
            setTimeout(() => {
                viewManual.style.display = 'none';
                bottomBar.style.display = 'none';
                viewContacts.style.display = 'flex';
                
                if(btnOpenSearch) btnOpenSearch.style.display = 'block';
                
                void viewContacts.offsetWidth; 
                
                viewContacts.classList.remove('hidden-state');
                fabContainer.classList.remove('scale-0');
                currentActiveView = 'contacts';
            }, 250);
        }
    }

    btnBack.addEventListener('click', () => {
        if (currentActiveView === 'manual') {
            switchViews('contacts');
        } else {
            window.location.replace('../index.html');
        }
    });

    btnFloatingManual.addEventListener('click', () => {
        switchViews('manual');
    });

    // --- Form Handlers ---
    nameInput.addEventListener('input', () => {
        if (nameInput.value.trim().length > 0) {
            confirmBtn.removeAttribute('disabled');
            
            if(phoneWrapper) {
                phoneWrapper.classList.remove('max-h-0', 'opacity-0', 'scale-95');
                phoneWrapper.classList.add('max-h-[150px]', 'opacity-100', 'scale-100');
            }
        } else {
            confirmBtn.setAttribute('disabled', 'true');
            
            if(phoneWrapper) {
                phoneWrapper.classList.remove('max-h-[150px]', 'opacity-100', 'scale-100');
                phoneWrapper.classList.add('max-h-0', 'opacity-0', 'scale-95');
            }
        }
    });

    confirmBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        if (!name) return;
        saveCustomerAndGoBack(name, phone);
    });

    // 🟢 REMOVED phoneInput focus/blur events that were destroying the HTML classes.
    // Button will now naturally sit inside the phone wrapper.

    // --- Cordova Contact Engine ---
    btnManualPickContact.addEventListener('click', (e) => {
        e.preventDefault();
        if (navigator.contacts && navigator.contacts.pickContact) {
            navigator.contacts.pickContact(function(contact) {
                
                let cName = contact.displayName;
                if (!cName && contact.name) {
                    cName = contact.name.formatted || contact.name.givenName || "";
                    if (contact.name.familyName && cName.indexOf(contact.name.familyName) === -1) {
                        cName += " " + contact.name.familyName;
                    }
                }
                cName = cName ? cName.trim() : "";

                let cPhone = "";
                if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                    cPhone = contact.phoneNumbers[0].value.replace(/[^0-9+]/g, '');
                }
                
                if (cPhone) phoneInput.value = cPhone;
                if (cName) nameInput.value = cName;
                
                nameInput.dispatchEvent(new Event('input'));
                window.showAppToast("Contact details attached.");
            }, function(err) {
                window.showAppToast("Contact picker closed.", "error");
            });
        } else {
            window.showAppToast("Native API unavailable in engine.", "error");
        }
    });

    // Smart Fetch Logic to get ALL contacts
    function loadDeviceContactsSystem() {
        if (navigator.contacts && navigator.contacts.find) {
            const options = new ContactFindOptions();
            options.filter = "";
            options.multiple = true;
            options.hasPhoneNumber = true; 
            
            const fields = ["*"]; 
            
            navigator.contacts.find(fields, function(contacts) {
                let uniqueContacts = new Map();

                contacts.forEach(c => {
                    let cName = c.displayName || (c.name ? c.name.formatted || c.name.givenName : null);
                    let cPhone = "";

                    if (c.phoneNumbers && c.phoneNumbers.length > 0) {
                        cPhone = c.phoneNumbers[0].value;
                    }

                    if (cName && cPhone) {
                        let cleanPhone = cPhone.replace(/[^0-9+]/g, '');
                        if(!uniqueContacts.has(cleanPhone)) {
                            uniqueContacts.set(cleanPhone, { name: cName, phone: cPhone });
                        }
                    }
                });

                allDeviceContacts = Array.from(uniqueContacts.values()).sort((a, b) => {
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });

                renderPhonebookInterface(allDeviceContacts);
            }, function(err) {
                fallbackBrowserMockDataLauncher();
            }, options);
        } else {
            fallbackBrowserMockDataLauncher();
        }
    }

    // 🟢 ASLI MASTER DHANCHA: JavaScript de andar lishkarda HTML render
    function renderPhonebookInterface(contactsArray) {
        contactsWrapper.innerHTML = '';
        
        contactsWrapper.className = "flex-1 overflow-y-auto min-h-0 bg-card rounded-2xl overflow-x-hidden shadow-sm transition-colors flex flex-col pb-24";
        contactsWrapper.classList.remove('hidden');

        if (contactsArray.length === 0) {
            contactsWrapper.className = "";
            contactsWrapper.innerHTML = `<div class="text-center py-12 text-xs font-bold text-gray-400 uppercase tracking-widest">No profiles found</div>`;
            return;
        }

        contactsArray.forEach((contact, index) => {
            const node = document.createElement('div');
            
            // 🟢 FIX: Added active:scale-[0.98] and transition-all for touch animation
            node.className = "contact-item-node flex flex-col cursor-pointer active:scale-[0.98] active:opacity-70 transition-all shrink-0 group";
            node.setAttribute('data-name', contact.name);
            node.setAttribute('data-phone', contact.phone);
            
            // 16px Font Normal, Grey Icon, te perfect Right-spaced Divider
            // 🟢 FIX: group-last:hidden class is used instead of static isLastItem to support filtering correctly
            node.innerHTML = `
                <div class="flex items-center pl-4 w-full">
                    <div class="w-10 h-10 rounded-full bg-avatar text-white flex items-center justify-center font-semibold text-[17px] shrink-0 uppercase">
                        ${contact.name.charAt(0)}
                    </div>
                    <div class="flex-1 flex flex-col justify-center ml-3 overflow-hidden">
                        <div class="py-3 pr-4">
                            <p class="text-[16px] font-normal text-primary truncate antialiased">${contact.name}</p>
                            <p class="text-[13px] text-secondary mt-0.5 tracking-wide antialiased truncate">${contact.phone}</p>
                        </div>
                        <div class="h-[1px] bg-line mr-4 group-last:hidden"></div>
                    </div>
                </div>
            `;

            node.addEventListener('click', () => {
                saveCustomerAndGoBack(contact.name, contact.phone);
            });
            
            contactsWrapper.appendChild(node);
        });
    }

    function fallbackBrowserMockDataLauncher() {
        const mock = [
            { name: "Amrinder Singh", phone: "+91 98765-43210" },
            { name: "Arjan Dhillon", phone: "+91 91234-56789" },
            { name: "Balkar Sidhu", phone: "+91 94631-00234" },
            { name: "Gurmeet Singh", phone: "+91 99144-88211" },
            { name: "Harbhajan Mann", phone: "+91 98123-55432" },
            { name: "Jagjit Singh", phone: "+91 98882-11109" },
            { name: "Manmohan Waris", phone: "+91 94640-77123" },
            { name: "Satinder Sartaaj", phone: "+91 75081-22456" }
        ];
        allDeviceContacts = mock;
        setTimeout(() => { renderPhonebookInterface(mock); }, 600);
    }

    // Initialize
    if (window.cordova) {
        document.addEventListener('deviceready', () => {
            // Hardware Back Button Integration
            document.addEventListener("backbutton", function (e) {
                e.preventDefault();
                // Check view state before exiting
                if (currentActiveView === 'manual') {
                    switchViews('contacts');
                } else {
                    window.location.replace('../index.html');
                }
            }, false);
            
            // 🟢 FIX: Call system contacts load function here
            loadDeviceContactsSystem();
            
        }, false);
    } else {
        loadDeviceContactsSystem();
    }
});
