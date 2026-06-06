// assets/js/profile.js

let currentCustId = '';
let editType = ''; // 'name' or 'phone'

document.addEventListener('deviceready', () => {
    const params = new URLSearchParams(window.location.search);
    currentCustId = params.get('id');
    if(!currentCustId) return window.history.back();

    loadCustomerData();

    document.getElementById('delete-btn').onclick = () => {
        window.location.href = `delete_customer.html?id=${currentCustId}`;
    };
}, false);

function loadCustomerData() {
    if (!window.db) return;

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [currentCustId], function(tx, rs) {
            if (rs.rows.length === 0) return window.history.back();

            const customer = rs.rows.item(0);
            
            document.getElementById('display-name').textContent = customer.name;
            // SQLite vich jado data na hove ta oh 'null' dinda hai
            document.getElementById('display-phone').textContent = (customer.phone && customer.phone !== 'null') ? customer.phone : 'Number nahi add kitta';
            document.getElementById('prof-initial').textContent = customer.name.charAt(0).toUpperCase();
        });
    });
}

// Baki UI de functions (open modal, close modal, save) global scope ch chahide ne 
// kyunki tusi HTML vich onclick="openEditModal('name')" likheya hai

window.openEditModal = function(type) {
    editType = type;
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modal-title');
    const label = document.getElementById('modal-label');
    const input = document.getElementById('modal-input');

    db.transaction(function(tx) {
        tx.executeSql('SELECT * FROM customers WHERE id = ?', [currentCustId], function(tx, rs) {
            if (rs.rows.length === 0) return;
            const customer = rs.rows.item(0);

            if (type === 'name') {
                title.textContent = 'Edit Name';
                label.textContent = 'Name';
                input.value = customer.name;
                input.type = 'text';
            } else {
                title.textContent = 'Add Mobile Number';
                label.textContent = 'Phone Number';
                input.value = (customer.phone && customer.phone !== 'null') ? customer.phone : '';
                input.type = 'tel';
            }

            modal.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('translate-y-full');
                input.focus();
            }, 10);
        });
    });
};

window.closeModal = function() {
    const modal = document.getElementById('editModal');
    const content = document.getElementById('modalContent');
    content.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.saveChanges = function() {
    const newVal = document.getElementById('modal-input').value.trim();
    if(!newVal && editType === 'name') return alert("Naam likhna zaroori hai!");

    let updateQuery = '';
    
    if(editType === 'name') {
        updateQuery = 'UPDATE customers SET name = ? WHERE id = ?';
    } else {
        updateQuery = 'UPDATE customers SET phone = ? WHERE id = ?';
    }

    db.transaction(function(tx) {
        tx.executeSql(updateQuery, [newVal, currentCustId], function(tx, rs) {
            // Update successful
            loadCustomerData();
            closeModal();
        }, function(tx, error) {
            alert("Error updating: " + error.message);
        });
    });
};
