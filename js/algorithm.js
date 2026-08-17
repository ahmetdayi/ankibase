/* ============================================================
   algorithm.js  –  SM-2 tabanlı spaced repetition
   ============================================================ */

function _getMaxInterval() {
    const matureCount = typeof Cards !== 'undefined'
        ? Cards.getAll().filter(c => c.interval >= 21).length
        : 0;
    if (matureCount < 100) return 30;
    if (matureCount < 300) return 45;
    return 60;
}

const Algorithm = {
    /*
     * rating: 'again' | 'hard' | 'good' | 'easy'
     * Dönen obje: { interval, easeFactor, repetitions, dueDate }
     *
     * again → sıfırla, interval=1, EF-0.20
     * hard  → repetitions sabit, interval×0.5, EF-0.15
     * good  → SM-2 adımı, repetitions+1
     * easy  → SM-2 adımı×1.3, repetitions+1, EF+0.10
     * Jitter ±10% (good/easy): review fırtınasını önler
     * Max interval: mature kart sayısına göre 30/45/60 gün
     */
    calculate(card, rating) {
        let { interval, easeFactor, repetitions } = card;

        if (rating === 'again') {
            repetitions = 0;
            interval    = 1;
            easeFactor  = Math.max(1.3, easeFactor - 0.20);
        } else if (rating === 'hard') {
            interval   = Math.max(1, Math.round(interval * 0.5));
            easeFactor = Math.max(1.3, easeFactor - 0.15);
            // repetitions değişmez
        } else {
            // good veya easy
            if (repetitions === 0)      interval = 1;
            else if (repetitions === 1) interval = 4;
            else                        interval = Math.round(interval * easeFactor);
            repetitions += 1;

            if (rating === 'easy') {
                interval   = Math.round(interval * 1.3);
                easeFactor = Math.min(2.5, easeFactor + 0.10);
            }

            // Jitter: ±10% sapma (review fırtınasını önler)
            interval = Math.round(interval * (0.9 + Math.random() * 0.2));
        }

        const maxInterval = _getMaxInterval();
        interval = Math.min(maxInterval, Math.max(1, interval));

        easeFactor = Math.round(easeFactor * 1000) / 1000;

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
