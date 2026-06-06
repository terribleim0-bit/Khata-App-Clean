// ==========================================
// KHATA APP - MANUAL THEME ENGINE
// ==========================================

(function() {
    function applyAppTheme(mode) {
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    function initTheme() {
        let savedTheme = localStorage.getItem('app_theme');
        
        if (!savedTheme) {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                savedTheme = 'dark';
            } else {
                savedTheme = 'light';
            }
            localStorage.setItem('app_theme', savedTheme);
        }
        applyAppTheme(savedTheme);
    }

    initTheme();

    // Sirf Header de toggle button layi function
    window.toggleTheme = function() {
        let currentTheme = localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light';
        let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        localStorage.setItem('app_theme', newTheme);
        applyAppTheme(newTheme);
    };
})();
