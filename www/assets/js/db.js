// assets/js/db.js

// Global db variable taaki baaki files isnu aaram naal labh sakan
window.db = null;

document.addEventListener('deviceready', function() {
    
    // 1. Database Connection (Naal Browser testing da jugaad)
    if (window.sqlitePlugin) {
        window.db = window.sqlitePlugin.openDatabase({
            name: 'khata.db',
            location: 'default'
        });
    } else {
        // Je kade computer browser ch test karna hove
        console.warn("SQLite plugin nahi mileya, WebSQL varat rahe haan.");
        window.db = window.openDatabase('khata.db', '1.0', 'Khata DB', 2 * 1024 * 1024);
    }

    // 2. Database Transaction with Error Handling
    window.db.transaction(function(tx) {
        
        // --- Asli Tables Create Karna ---
        tx.executeSql('CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, balance REAL)');
        tx.executeSql('CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, customer_id TEXT, amount REAL, type TEXT, note TEXT, date INTEGER, bill_paths TEXT)');

        // --- Naye Columns Add Karna (Bina Duplication de) ---
        // Je column pehla ton hai, taan eh chup karke error handle kar lega (return false) te app crash nahi hovegi.
        tx.executeSql("ALTER TABLE customers ADD COLUMN phone TEXT", [], function(){}, function(){ return false; });
        tx.executeSql("ALTER TABLE customers ADD COLUMN updated_at INTEGER", [], function(){}, function(){ return false; });
        tx.executeSql("ALTER TABLE customers ADD COLUMN last_activity_text TEXT", [], function(){}, function(){ return false; });
        
        tx.executeSql("ALTER TABLE transactions ADD COLUMN is_edited INTEGER DEFAULT 0", [], function(){}, function(){ return false; });
        tx.executeSql("ALTER TABLE transactions ADD COLUMN edited_on TEXT", [], function(){}, function(){ return false; });
        
        // 🟢 NAVI COLUMNS: Soft Delete Layi
        tx.executeSql("ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0", [], function(){}, function(){ return false; });
        tx.executeSql("ALTER TABLE transactions ADD COLUMN deleted_on TEXT", [], function(){}, function(){ return false; });

    }, function(error) {
        // 🟢 ERROR HANDLER: Je table banan ch koi dikkat aave
        console.error("Database Setup ch problem: " + error.message);
    }, function() {
        // 🟢 SUCCESS HANDLER: Jadon sab theek ho jave
        console.log("Database and Tables bilkul set ne paji!");
    });

}, false);
