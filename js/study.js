/* ============================================================
   study.js  –  Tekrar oturumu yönetimi
   ============================================================ */
const Study = {
    queue:        [],
    currentIndex: 0,
    isAnswerShown: false,

    start() {
        this.queue        = Cards.getDue();
        this.currentIndex = 0;
        this.isAnswerShown = false;
        this._render();
    },

    get current() {
        return this.queue[this.currentIndex] || null;
    },

    showAnswer() {
        if (this.isAnswerShown || !this.current) return;
        this.isAnswerShown = true;
        document.getElementById('flashcard').classList.add('flipped');
        document.getElementById('showAnswerBtn').style.display  = 'none';
        document.getElementById('ratingButtons').style.display  = 'flex';
    },

    rate(rating) {
        if (!this.isAnswerShown || !this.current) return;

        Cards.review(this.current.id, rating);

        if (rating === 'again') {
            // Kartı kuyruğun biraz ilerisine koy
            const card = this.queue.splice(this.currentIndex, 1)[0];
            const at   = Math.min(this.currentIndex + 3, this.queue.length);
            this.queue.splice(at, 0, card);
        } else {
            this.currentIndex++;
        }

        this.isAnswerShown = false;
        this._render();
    },

    // -------- private --------
    _render() {
        if (!this.current) {
            this._showEmpty();
            return;
        }
        this._showCard(this.current);
        this._updateProgress();
    },

    _showCard(card) {
        const emptyEl   = document.getElementById('studyEmptyState');
        const contentEl = document.getElementById('studyContent');
        emptyEl.style.display   = 'none';
        contentEl.style.display = 'block';

        // Flip sıfırla
        document.getElementById('flashcard').classList.remove('flipped');
        document.getElementById('showAnswerBtn').style.display = 'inline-flex';
        document.getElementById('ratingButtons').style.display = 'none';

        // Ön yüz
        const badge = document.getElementById('studyWordType');
        badge.textContent = UI.wordTypeName(card.wordType);
        badge.className   = `word-type-badge type-badge-${card.wordType}`;
        document.getElementById('studySentence').innerHTML =
            UI.highlightWord(card.sentence, card.targetWord);

        // Arka yüz
        document.getElementById('backTargetWord').textContent = card.targetWord;
        document.getElementById('backWordType').textContent   = UI.wordTypeName(card.wordType);

        this._setOrHide('backMeaning',     card.meaning);
        document.getElementById('backExplanation').textContent = card.explanation || '';
        this._setOrHide('backExample', card.extraExample ? '✦ ' + card.extraExample : '');
        this._setOrHide('backNotes',   card.notes        ? '📝 ' + card.notes       : '');

        const tagsEl = document.getElementById('backTags');
        if (card.tags && card.tags.length) {
            tagsEl.innerHTML     = card.tags.map(t => `<span class="tag-pill">${t}</span>`).join('');
            tagsEl.style.display = 'flex';
        } else {
            tagsEl.style.display = 'none';
        }
    },

    _setOrHide(id, text) {
        const el = document.getElementById(id);
        if (text) { el.textContent = text; el.style.display = 'block'; }
        else       { el.style.display = 'none'; }
    },

    _updateProgress() {
        const total     = this.queue.length;
        const done      = this.currentIndex;
        const remaining = total - done;
        document.getElementById('studyProgress').textContent  = `${done} / ${total}`;
        document.getElementById('studyRemaining').textContent = `${remaining} kart kaldı`;
        const pct = total > 0 ? (done / total) * 100 : 0;
        document.getElementById('progressFill').style.width   = `${pct}%`;
    },

    _showEmpty() {
        document.getElementById('studyEmptyState').style.display = 'block';
        document.getElementById('studyContent').style.display    = 'none';
    },
};
