/* ============================================================
   storage.js  –  LocalStorage wrapper
   ============================================================ */
const Storage = {
    KEYS: {
        CARDS:    'ankibase_cards',
        SETTINGS: 'ankibase_settings',
        STATS:    'ankibase_stats',
    },

    saveCards(cards) {
        localStorage.setItem(this.KEYS.CARDS, JSON.stringify(cards));
    },
    loadCards() {
        const d = localStorage.getItem(this.KEYS.CARDS);
        return d ? JSON.parse(d) : [];
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },
    loadSettings() {
        const d = localStorage.getItem(this.KEYS.SETTINGS);
        return d ? JSON.parse(d) : { theme: 'dark', dailyLimit: 20, newPerDay: 5 };
    },

    saveStats(stats) {
        localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
    },
    loadStats() {
        const d = localStorage.getItem(this.KEYS.STATS);
        return d ? JSON.parse(d) : { totalReviews: 0, lastStudyDate: null, streak: 0 };
    },

    clearAll() {
        Object.values(this.KEYS).forEach(k => localStorage.removeItem(k));
    },
};
