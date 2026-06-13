// assets/js/router.js

const AppRouter = {
    history: [], 

    init: function() {
        // App start hon te Home screen nu 0 parameters naal save karo
        this.history = [{ screenId: 'screen-home', params: {} }];

        // Android hardware Back Button control
        document.addEventListener("backbutton", (e) => {
            
            // 🟢 NAYA FIX: Modal Aware Logic (Bug Fix)
            // Router check karega ki current screen te koi modal open taan nahi hai?
            const activeScreen = document.querySelector('.app-screen.active');
            if (activeScreen) {
                // Koi vi element jisde ID vich "Modal" hai aur oh "hidden" nahi hai, usnu labho
                const openModals = activeScreen.querySelectorAll('.fixed[id*="Modal"]:not(.hidden)');
                
                if (openModals.length > 0) {
                    // Je modal open hai, taan router pichhe nahi jayega!
                    // Screen da apna personal JS code us modal nu band karega.
                    e.preventDefault();
                    return;
                }
            }

            // Normal Router Logic
            if (this.history.length > 1) {
                e.preventDefault();
                this.goBack(); 
            } else {
                navigator.app.exitApp(); 
            }
        }, false);
    },

    navigate: function(screenId, params = {}) {
        this.history.push({ screenId: screenId, params: params });
        this.showScreen(screenId, true, params);
    },

    goBack: function() {
        if (this.history.length > 1) {
            this.history.pop();
            const previousState = this.history[this.history.length - 1];
            this.showScreen(previousState.screenId, false, previousState.params);
        }
    },

    showScreen: function(screenId, isForward, params = {}) {
        document.querySelectorAll('.app-screen').forEach(el => {
            el.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            
            const event = new CustomEvent('screenChanged', { detail: { screenId, isForward, params } });
            document.dispatchEvent(event);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppRouter.init();
});
