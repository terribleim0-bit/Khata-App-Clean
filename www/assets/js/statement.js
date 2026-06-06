// assets/js/statement.js

let currentCustId = null;
let allTransactions = [];
let currentFilteredTxns = [];
let customerData = null;
let activeFilter = '10'; 
let customStart = 0;
let customEnd = 0;
let netBalanceGlobal = 0;

// Date pre-fill layi variables
let visibleStartDate = null; 
let visibleEndDate = null;

function showNativeNotification(title, message) {
    if (window.cordova && cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
        cordova.plugins.notification.local.requestPermission(function (granted) {
            if (granted) { cordova.plugins.notification.local.schedule({ title: title, text: message, foreground: true, vibrate: true }); } 
            else { alert(message); }
        });
    } else { alert(message); }
}

document.addEventListener('deviceready', initPage, false);
document.addEventListener('DOMContentLoaded', () => { if(!window.cordova) initPage(); });

function initPage() {
    const params = new URLSearchParams(window.location.search);
    currentCustId = params.get('id');
    
    if (!currentCustId || !window.db) return window.history.back();

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [currentCustId], function(tx, rs) {
            if (rs.rows.length === 0) return window.history.back();
            customerData = rs.rows.item(0);
            document.getElementById('cust-name').textContent = customerData.name;

            tx.executeSql('SELECT * FROM transactions WHERE customer_id = ? ORDER BY date DESC', [currentCustId], function(tx, txnRs) {
                allTransactions = []; 
                for(let i=0; i<txnRs.rows.length; i++) {
                    allTransactions.push(txnRs.rows.item(i));
                }
                applyFilterLogic();
            });
        });
    });

    document.getElementById('btn-download-html').addEventListener('click', downloadHTML);
    document.getElementById('btn-share-pdf').addEventListener('click', shareScreenshotAsPDF);
}

function setFilter(type) {
    activeFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn px-4 py-1.5 rounded-full text-[13px] font-bold border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 shrink-0 transition-colors";
    });
    const activeBtn = document.getElementById('filter-' + type);
    if(activeBtn) {
        activeBtn.className = "filter-btn px-4 py-1.5 rounded-full text-[13px] font-bold border border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shrink-0 transition-colors";
    }
    applyFilterLogic();
}

// 🟢 SMART PRE-FILL LOGIC: Modal khullan wele auto fill dates
function openCustomDate() { 
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    
    // Je list ch entries hain, oh dates pre-fill karo, nahi taan ajj di date
    if (visibleStartDate && visibleEndDate) {
        startInput.value = new Date(visibleStartDate).toISOString().split('T')[0];
        endInput.value = new Date(visibleEndDate).toISOString().split('T')[0];
    } else {
        const today = new Date().toISOString().split('T')[0];
        startInput.value = today; endInput.value = today;
    }
    document.getElementById('dateModal').classList.remove('hidden'); 
}

function closeCustomDate() { document.getElementById('dateModal').classList.add('hidden'); }

function applyCustomDate() {
    const sDate = document.getElementById('start-date').value;
    const eDate = document.getElementById('end-date').value;
    if(!sDate || !eDate) return alert("Dono dates chunna zaroori hai");
    customStart = new Date(sDate).setHours(0,0,0,0);
    customEnd = new Date(eDate).setHours(23,59,59,999);
    if(customStart > customEnd) return alert("Start date End date ton piche honi chahidi hai");
    closeCustomDate();
    setFilter('Custom');
}

function applyFilterLogic() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (activeFilter === '10') { currentFilteredTxns = allTransactions.slice(0, 10); } 
    else if (activeFilter === '1M') { currentFilteredTxns = allTransactions.filter(t => t.date >= (now - 30 * dayMs)); } 
    else if (activeFilter === '3M') { currentFilteredTxns = allTransactions.filter(t => t.date >= (now - 90 * dayMs)); } 
    else if (activeFilter === '6M') { currentFilteredTxns = allTransactions.filter(t => t.date >= (now - 180 * dayMs)); } 
    else if (activeFilter === '1Y') { currentFilteredTxns = allTransactions.filter(t => t.date >= (now - 365 * dayMs)); } 
    else if (activeFilter === 'Custom') { currentFilteredTxns = allTransactions.filter(t => t.date >= customStart && t.date <= customEnd); }
    
    renderTransactions(currentFilteredTxns);
}

function renderTransactions(txns) {
    const listEl = document.getElementById('txn-list');
    const dateLabelEl = document.getElementById('date-range-text');
    listEl.innerHTML = '';
    let totGiven = 0, totGot = 0;

    // 🟢 SMART HEADER LOGIC: Asli dates kadd ke dikhana
    if (txns.length === 0) {
        listEl.innerHTML = `<div class="text-center py-8 text-gray-500 text-sm font-bold">No entries found</div>`;
        dateLabelEl.textContent = "No Transactions";
        visibleStartDate = null; visibleEndDate = null;
    } else {
        const dates = txns.map(t => Number(t.date));
        visibleStartDate = Math.min(...dates);
        visibleEndDate = Math.max(...dates);
        
        const sStr = new Date(visibleStartDate).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).replace(/,/g, '');
        const eStr = new Date(visibleEndDate).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}).replace(/,/g, '');
        
        if (sStr === eStr) { dateLabelEl.textContent = sStr; } // Same day
        else { dateLabelEl.textContent = `${sStr} — ${eStr}`; } // Start to End
    }

    txns.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const isGive = t.type === 'given';
        if (isGive) totGiven += amt; else totGot += amt;

        const dateObj = new Date(Number(t.date));
        const day = dateObj.getDate().toString().padStart(2, '0');
        const monthYear = dateObj.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase();
        let colorClass = 'text-gray-500';
        if (amt > 0) colorClass = isGive ? 'text-[#ef4444]' : 'text-[#22c55e]';

        let actualNote = "";
        if (t.note && t.note.toLowerCase() !== "received" && t.note.toLowerCase() !== "given") {
            actualNote = t.note.trim();
        }

        const editHtml = t.is_edited ? `<div class="flex mt-1"><span class="flex items-center text-[9px] bg-gray-200 dark:bg-[#2a2a2e] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"><svg class="w-2.5 h-2.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Edited</span></div>` : '';

        const itemHtml = `
            <div class="flex items-center gap-3 py-1.5 border-b border-gray-200 dark:border-[#2a2a2e]/60 w-full">
                <div class="flex flex-col w-14 shrink-0">
                    <span class="text-lg font-black leading-none text-gray-800 dark:text-gray-300">${day}</span>
                    <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mt-1 tracking-wider">${monthYear}</span>
                </div>
                <div class="flex flex-col flex-1 pr-2 min-w-0">
                    <span class="text-[14px] font-bold text-gray-700 dark:text-gray-200 leading-snug break-words">${actualNote}</span>
                    ${editHtml}
                </div>
                <div class="text-[16px] font-bold ${colorClass} text-right shrink-0 whitespace-nowrap">
                    ${isGive ? '-' : '+'} ₹ ${amt}
                </div>
            </div>`;
        listEl.insertAdjacentHTML('beforeend', itemHtml);
    });

    netBalanceGlobal = totGot - totGiven; 
    const balLabelEl = document.getElementById('net-balance-label');
    const balValueEl = document.getElementById('net-balance-value');
    balValueEl.textContent = `₹ ${Math.abs(netBalanceGlobal)}`;
    
    if (netBalanceGlobal < 0) {
        balLabelEl.textContent = "Balance Due"; balValueEl.className = "text-[22px] font-bold tracking-tight text-[#ef4444]"; 
    } else if (netBalanceGlobal > 0) {
        balLabelEl.textContent = "Balance Advance"; balValueEl.className = "text-[22px] font-bold tracking-tight text-[#22c55e]"; 
    } else {
        balLabelEl.textContent = "Balance Settled"; balValueEl.className = "text-[22px] font-bold tracking-tight text-gray-400"; 
    }
}

// ==========================================
// 🟢 PROFESSIONAL HTML SHARE (Temp Folder -> Send To)
// ==========================================
function downloadHTML() {
    const isDark = document.documentElement.classList.contains('dark');
    // Screen wala dabba fadd ke HTML banani
    const receiptHtml = document.getElementById('receipt-box').outerHTML;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html class="${isDark ? 'dark' : ''}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Statement - ${customerData.name}</title>
        <script src="https://cdn.tailwindcss.com"><\/script>
        <script>tailwind.config = { darkMode: 'class' }<\/script>
        <style>body { background: ${isDark ? '#0a0a0a' : '#f2f2f7'}; display: flex; justify-content: center; padding: 20px; font-family: sans-serif; }</style>
    </head>
    <body class="${isDark ? 'bg-[#0a0a0a] text-gray-100' : 'bg-[#f2f2f7] text-gray-900'}">
        ${receiptHtml}
    </body>
    </html>`;

    const filename = `Khata_${customerData.name.replace(/\s+/g, '_')}.html`;
    const shareMessage = `Sat Sri Akaal ${customerData.name} ji, thuhada Khata statement (HTML) attach kitta hai.`;

    if (window.cordova && window.cordova.file) {
        const tempDir = cordova.file.cacheDirectory;
        window.resolveLocalFileSystemURL(tempDir, function(dirEntry) {
            dirEntry.getFile(filename, { create: true, exclusive: false }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwriteend = function() {
                        const tempPath = fileEntry.nativeURL;
                        if (window.plugins && window.plugins.socialsharing) {
                            window.plugins.socialsharing.shareViaWhatsApp(shareMessage, tempPath, null, null, () => { 
                                window.plugins.socialsharing.share(shareMessage, 'Khata Statement HTML', tempPath, null);
                            });
                        }
                    };
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    fileWriter.write(blob);
                });
            });
        });
    } else {
        // Computer / Browser Fallback
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
}

// ==========================================
// 🟢 PURE A4 PDF SHARE (OkCredit Style via Temp Folder)
// ==========================================
async function shareScreenshotAsPDF() {
    const btnText = document.getElementById('share-text');
    const originalText = btnText.textContent;
    btnText.textContent = "Generating...";

    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script'); script.src = "assets/js/html2pdf.bundle.min.js"; 
        script.onload = () => generateAndSharePDF(btnText, originalText);
        script.onerror = () => { showNativeNotification("Error", "PDF script missing!"); btnText.textContent = originalText; };
        document.head.appendChild(script);
    } else { generateAndSharePDF(btnText, originalText); }
}

async function generateAndSharePDF(btnText, originalText) {
    // 1. Data Parna A4 Panna Vich
    document.getElementById('a4-name').textContent = customerData.name;
    let rawPhone = customerData.cust_phone || customerData.phone || customerData.mobile || "";
    document.getElementById('a4-phone').textContent = "Mobile: " + (rawPhone ? rawPhone : "N/A");
    document.getElementById('a4-date').textContent = document.getElementById('date-range-text').textContent;
    
    document.getElementById('a4-balance').textContent = `₹ ${Math.abs(netBalanceGlobal)}`;
    const balLabel = document.getElementById('a4-bal-label');
    const balAmt = document.getElementById('a4-balance');
    if (netBalanceGlobal < 0) {
        balLabel.textContent = "Balance Due"; balAmt.style.color = "#dc2626"; 
    } else if (netBalanceGlobal > 0) {
        balLabel.textContent = "Balance Advance"; balAmt.style.color = "#16a34a"; 
    } else {
        balLabel.textContent = "Balance Settled"; balAmt.style.color = "#4b5563"; 
    }

    const tbody = document.getElementById('a4-tbody');
    tbody.innerHTML = '';
    currentFilteredTxns.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const isGive = t.type === 'given';
        const dateStr = new Date(Number(t.date)).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
        let noteStr = t.note && t.note.toLowerCase() !== "received" && t.note.toLowerCase() !== "given" ? t.note : "";
        
        let paymentTxt = !isGive ? `+ ₹${amt}` : "";
        let creditTxt = isGive ? `- ₹${amt}` : "";

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #f3f4f6";
        tr.innerHTML = `
            <td style="padding: 15px 10px; color: #111827; font-weight: bold;">${dateStr}</td>
            <td style="padding: 15px 10px; color: #4b5563;">${noteStr}</td>
            <td style="text-align: right; padding: 15px 10px; color: #16a34a; font-weight: bold;">${paymentTxt}</td>
            <td style="text-align: right; padding: 15px 10px; color: #dc2626; font-weight: bold;">${creditTxt}</td>
        `;
        tbody.appendChild(tr);
    });

    const a4Element = document.getElementById('hidden-a4-template');
    const filename = `Khata_${customerData.name.replace(/\s+/g, '_')}.pdf`;
    const shareMessage = `Sat Sri Akaal ${customerData.name} ji, thuhada Khata statement attach kitta hai.`;
    
    // A4 Format settings
    const opt = {
        margin: [0, 0, 0, 0], filename: filename, image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
        if (window.cordova && window.cordova.file) {
            const pdfBlob = await html2pdf().set(opt).from(a4Element).outputPdf('blob');
            const tempDir = cordova.file.cacheDirectory;

            window.resolveLocalFileSystemURL(tempDir, function(dirEntry) {
                dirEntry.getFile(filename, { create: true, exclusive: false }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        
                        fileWriter.onwriteend = function() {
                            const tempPath = fileEntry.nativeURL;
                            if (window.plugins && window.plugins.socialsharing) {
                                showNativeNotification("Sharing", "WhatsApp khul reha hai...");
                                window.plugins.socialsharing.shareViaWhatsApp(shareMessage, tempPath, null, 
                                    () => { btnText.textContent = originalText; }, 
                                    () => { 
                                        window.plugins.socialsharing.share(shareMessage, 'Khata Statement', tempPath, null);
                                        btnText.textContent = originalText; 
                                    }
                                );
                            } else { btnText.textContent = originalText; }
                        };
                        fileWriter.onerror = function() { btnText.textContent = originalText; };
                        fileWriter.write(pdfBlob);
                        
                    });
                }, function() { btnText.textContent = originalText; });
            }, function() { btnText.textContent = originalText; });

        } else {
            // Browser Test Fallback
            const pdfBlob = await html2pdf().set(opt).from(a4Element).outputPdf('blob');
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
            btnText.textContent = originalText;
        }
    } catch (err) {
        showNativeNotification("Error", "PDF fail ho gayi.");
        btnText.textContent = originalText;
    }
}
