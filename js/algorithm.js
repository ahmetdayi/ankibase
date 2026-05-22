/* ============================================================
   algorithm.js  –  SM-2 tabanlı spaced repetition
   ============================================================ */
const Algorithm = {
    /*
     * rating: 'again' | 'hard' | 'good' | 'easy'
     * Dönen obje: { interval, easeFactor, repetitions, dueDate }
     */
    calculate(card, rating) {
        let { interval, easeFactor, repetitions } = card;

        // q: 0=again, 1=hard, 2=good, 3=easy
        const q = { again: 0, hard: 1, good: 2, easy: 3 }[rating];

        if (q < 2) {
            // Başarısız → sıfırla
            repetitions = 0;
            interval = 1;
        } else {
            if (repetitions === 0)      interval = 1;
            else if (repetitions === 1) interval = 6;
            else                        interval = Math.round(interval * easeFactor);
            repetitions += 1;
        }

        // Ease factor güncelle (SM-2 formülü)
        easeFactor = easeFactor + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
        easeFactor = Math.max(1.3, Math.round(easeFactor * 1000) / 1000);

        // Rating'e göre interval düzeltmesi
        if (rating === 'hard')  interval = Math.max(1, Math.round(interval * 0.6));
        if (rating === 'easy')  interval = Math.round(interval * 1.3);

        // Minimum interval
        if (interval < 1) interval = 1;

        const due = new Date();
        due.setDate(due.getDate() + interval);

        return {
            interval,
            easeFactor,
            repetitions,
            dueDate: due.toISOString().split('T')[0],
        };
    },

    todayStr() {
        return new Date().toISOString().split('T')[0];
    },

    isDue(card) {
        return card.dueDate <= this.todayStr();
    },
};
