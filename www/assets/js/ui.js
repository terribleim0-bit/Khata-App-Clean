// ==========================================
// 🎨 UI.JS - GLOBAL APP UI COMPONENTS
// ==========================================
// 🟢 GLOBAL HELPER: Get Formatted Date (e.g., "2 May, 2026")
window.getFormattedDate = function(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
};

// 1. 🟢 GLOBAL BOTTOM TOAST (Soft Inverse Colors, Chores Gol, Left Aligned)
window.showAppToast = function(message, type = 'success') {
    const existingToast = document.getElementById('global-app-toast');
    if (existingToast) existingToast.remove();

    const toastCont = document.createElement('div');
    toastCont.id = 'global-app-toast';
    // Native slide animation classes
    toastCont.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[9999] transition-all duration-300 ease-out translate-y-full opacity-0 pointer-events-none flex justify-center w-full px-4';

    const toastMsg = document.createElement('div');
    // Soft inverse colors te chores gol (rounded-xl)
    toastMsg.className = 'bg-[#2c2c2e] dark:bg-[#f2f2f7] text-white dark:text-black px-4 py-3.5 rounded-xl text-[14px] font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15)] w-full max-w-[380px] flex items-center gap-3';

    // SVG Icons (Emoji di jagah)
    let svgIcon = '';
    if (type === 'error' || type === 'warning') {
        svgIcon = `<svg class="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else {
        svgIcon = `<svg class="w-5 h-5 shrink-0 text-green-500 dark:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    }

    toastMsg.innerHTML = `${svgIcon}<span class="flex-1 text-left leading-tight">${message}</span>`;

    toastCont.appendChild(toastMsg);
    document.body.appendChild(toastCont);

    // Tuhada Masterstroke logic (Smooth animation trigger)
    requestAnimationFrame(() => {
        setTimeout(() => {
            toastCont.classList.remove('translate-y-full', 'opacity-0');
            toastCont.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    });

    if (window.appToastTimeout) clearTimeout(window.appToastTimeout);
    window.appToastTimeout = setTimeout(() => {
        toastCont.classList.remove('translate-y-0', 'opacity-100');
        toastCont.classList.add('translate-y-full', 'opacity-0');
        
        setTimeout(() => {
            if (document.body.contains(toastCont)) toastCont.remove();
        }, 300);
    }, 3000);
};

// 2. 🔴 GLOBAL APPLE-STYLE ACTION MODAL (Confirm Box)
window.showConfirmModal = function(title, message, actionText, onConfirmCallback) {
    const existing = document.getElementById('global-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'global-confirm-modal';
    overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 opacity-0';

    const box = document.createElement('div');
    box.className = 'bg-[#f2f2f7] dark:bg-[#2c2c2e] w-[280px] rounded-[16px] flex flex-col text-center shadow-2xl transform scale-95 transition-transform duration-300';
    
    const content = document.createElement('div');
    content.className = 'p-5 flex flex-col items-center';
    content.innerHTML = `
        <h3 class="text-[17px] font-semibold text-black dark:text-white mb-1.5">${title}</h3>
        <p class="text-[13px] text-gray-500 dark:text-gray-400 leading-snug">${message}</p>
    `;

    const buttons = document.createElement('div');
    buttons.className = 'flex flex-col w-full border-t border-gray-300/80 dark:border-gray-600/50';

    // ⚠️ Action Button (Red color)
    const btnAction = document.createElement('button');
    btnAction.className = 'w-full py-3.5 text-[17px] font-normal text-[#ff3b30] border-b border-gray-300/80 dark:border-gray-600/50 active:bg-gray-200/50 dark:active:bg-gray-700/50 transition-colors rounded-none outline-none';
    btnAction.textContent = actionText;
    btnAction.onclick = () => {
        closeModal();
        if (onConfirmCallback) onConfirmCallback(); 
    };

    // ❌ Cancel Button (Blue color)
    const btnCancel = document.createElement('button');
    btnCancel.className = 'w-full py-3.5 text-[17px] font-semibold text-[#007aff] dark:text-[#0a84ff] active:bg-gray-200/50 dark:active:bg-gray-700/50 transition-colors rounded-b-[16px] outline-none';
    btnCancel.textContent = 'Cancel';
    btnCancel.onclick = closeModal;

    buttons.appendChild(btnAction);
    buttons.appendChild(btnCancel);
    box.appendChild(content);
    box.appendChild(buttons);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };


    // Modal lai vi tuhada smooth delay wala hack varta gaya hai
    requestAnimationFrame(() => {
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }, 10);
    });

    function closeModal() {
        overlay.classList.add('opacity-0');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 300);
    }
};
