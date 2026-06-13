// assets/js/router.js

const AppRouter = {
    history: [],

    init: function() {
        // App chalu thay etle pehli screen Home rakhvani
        this.history = ['screen-home'];
        history.replaceState({ screen: 'screen-home' }, '', '');

        // Android hardware Back Button control
        document.addEventListener("backbutton", (e) => {
            if (this.history.length > 1) {
                e.preventDefault();
                this.goBack(); // Pachla page par jao
            } else {
                navigator.app.exitApp(); // Jo home par hoy to app bandh karo
            }
        }, false);

        // Browser back button (for testing)
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.screen) {
                this.showScreen(e.state.screen, false);
            }
        });
    },

    // Nava page par javva mate
    navigate: function(screenId, params = {}) {
        this.history.push(screenId);
        history.pushState({ screen: screenId, params: params }, '', `#${screenId}`);
        this.showScreen(screenId, true);
    },

    // Pacha aavva mate (Back)
    goBack: function() {
        if (this.history.length > 1) {
            this.history.pop();
            const previousScreen = this.history[this.history.length - 1];
            history.pushState({ screen: previousScreen }, '', `#${previousScreen}`);
            this.showScreen(previousScreen, false);
        }
    },

    // Dabba (Divs) badlavanu main logic
    showScreen: function(screenId, isForward) {
        // 1. Badhi screen hide karo
        document.querySelectorAll('.app-screen').forEach(el => {
            el.classList.remove('active');
        });
        
        // 2. Tame je screen mangi che tene dekhao
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            
            // Custom Event: Tethi home.js ne khabar pade ke "Hu active thai gayo chu"
            const event = new CustomEvent('screenChanged', { detail: { screenId, isForward } });
            document.dispatchEvent(event);
        }
    }
};

// Jevo page load thay ke router chalu karo
document.addEventListener('DOMContentLoaded', () => {
    AppRouter.init();
});
