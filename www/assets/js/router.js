// assets/js/router.js

const AppRouter = {
    history: [],
    currentParams: {},

    init: function() {
        this.history = ['screen-home'];

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
        this.history.push(screenId);
        this.currentParams = params; 
        this.showScreen(screenId, true, params);
    },

    goBack: function() {
        if (this.history.length > 1) {
            this.history.pop();
            const previousScreen = this.history[this.history.length - 1];
            this.showScreen(previousScreen, false, this.currentParams);
        }
    },

    showScreen: function(screenId, isForward, params = {}) {
        document.querySelectorAll('.app-screen').forEach(el => {
            el.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            // Data load karan layi custom event
            const event = new CustomEvent('screenChanged', { detail: { screenId, isForward, params } });
            document.dispatchEvent(event);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AppRouter.init();
});
