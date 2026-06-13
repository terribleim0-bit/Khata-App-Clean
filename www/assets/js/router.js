// assets/js/router.js

const AppRouter = {
    // Hun history sirf string nahi, objects store karegi: { screenId, params }
    history: [], 

    init: function() {
        // App start hon te Home screen nu 0 parameters naal save karo
        this.history = [{ screenId: 'screen-home', params: {} }];

        // Android hardware Back Button control
        document.addEventListener("backbutton", (e) => {
            if (this.history.length > 1) {
                e.preventDefault();
                this.goBack(); 
            } else {
                navigator.app.exitApp(); 
            }
        }, false);
    },

    navigate: function(screenId, params = {}) {
        // Nayi screen te jaan lage, usda naam te params dono history ch push karo
        this.history.push({ screenId: screenId, params: params });
        this.showScreen(screenId, true, params);
    },

    goBack: function() {
        if (this.history.length > 1) {
            // 1. Current screen nu history cho kadd deo (Pop)
            this.history.pop();
            
            // 2. Pichli bachi hoyi screen da data labho
            const previousState = this.history[this.history.length - 1];
            
            // 3. Pichli screen nu usde apne purane params de naal load karo
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
            
            // Data load karan layi custom event (Hun hamesha sahi params jaan ge)
            const event = new CustomEvent('screenChanged', { detail: { screenId, isForward, params } });
            document.dispatchEvent(event);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppRouter.init();
});
