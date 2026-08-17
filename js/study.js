/* ============================================================
   study.js  –  Tekrar oturumu yönetimi
   ============================================================ */
const Study = {
    queue:        [],
    currentIndex: 0,
    isAnswerShown: false,

    start() {
        const settings = Storage.loadSettings();
        const limit    = settings.dailyLimit || 20;
        const newLimit = settings.newPerDay  || 5;

        // Vacation mode: uzun aradan sonra limiti geçici artır
        const stats   = Storage.loadStats();
        const today   = Algorithm.todayStr();
        const lastDay = stats.lastStudyDate;
        const gapDays = lastDay
            ? Math.floor((new Date(today) - new Date(lastDay)) / 86400000)
            : 0;

        let effectiveLimit = limit;
        if (gapDays >= 3) {
            effectiveLimit = Math.min(Math.round(limit * (1 + gapDays * 0.15)), 50);
            setTimeout(() => {
                if (typeof UI !== 'undefined') {
                    UI.showToast(`${gapDays} günlük aradan sonra hoş geldin! Bugün ${effectiveLimit} kart.`);
                }
            }, 500);
        }

        const allDue    = Cards.getDue();
        const newCards  = allDue.filter(c => c.repetitions === 0);
        const reviewCards = allDue.filter(c => c.repetitions > 0);

        // En uzun bekleyen review kartları önce gelsin
        reviewCards.sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);

        const newSlots    = Math.min(newCards.length, newLimit);
        const reviewSlots = effectiveLimit - newSlots;

        const picked = [
            ...newCards.slice(0, newSlots),
            ...reviewCards.slice(0, reviewSlots),
        ];

        this.queue        = picked;
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

        const reviewed = Cards.review(this.current.id, rating);
        if (typeof Sync !== 'undefined' && Sync.user) Sync.pushCard(reviewed).catch(console.warn);

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

        // Arka yüz — her zaman görünen
        document.getElementById('backTargetWord').textContent = card.targetWord;
        document.getElementById('backWordType').textContent   = UI.wordTypeName(card.wordType);

        // Arka yüz — tıkla-göster alanları
        const meaningEl = document.getElementById('backMeaning');
        meaningEl.innerHTML = '';
        let hasMeaning = false;
        // Geriye dönük uyumluluk: eski kartlarda tek alan EN dilinde olabilir
        const trMeaning = (card.meaningLang === 'en' && !card.meaningEn) ? null : card.meaning;
        const enMeaning = card.meaningEn || (card.meaningLang === 'en' && !card.meaningEn ? card.meaning : null);
        if (trMeaning) {
            hasMeaning = true;
            meaningEl.appendChild(this._makeRevealable('🇹🇷 Türkçe anlam var', el => { el.textContent = trMeaning; }));
        }
        if (enMeaning) {
            hasMeaning = true;
            meaningEl.appendChild(this._makeRevealable('🇬🇧 İngilizce anlam var', el => { el.textContent = enMeaning; }));
        }
        meaningEl.style.cssText = hasMeaning ? 'display:flex;flex-direction:column;gap:6px' : 'display:none';

        const expEl = document.getElementById('backExplanation');
        if (card.explanation) {
            expEl.innerHTML = '';
            expEl.appendChild(this._makeRevealable('📖 Açıklama var', el => { el.textContent = card.explanation; }));
            expEl.style.display = 'block';
        } else { expEl.style.display = 'none'; }

        const exEl = document.getElementById('backExample');
        if (card.extraExample) {
            exEl.innerHTML = '';
            exEl.appendChild(this._makeRevealable('✦ Örnek cümle var', el => { el.textContent = '✦ ' + card.extraExample; }));
            exEl.style.display = 'block';
        } else { exEl.style.display = 'none'; }

        const notesEl = document.getElementById('backNotes');
        if (card.notes) {
            notesEl.innerHTML = '';
            notesEl.appendChild(this._makeRevealable('📝 Not var', el => { el.textContent = '📝 ' + card.notes; }));
            notesEl.style.display = 'block';
        } else { notesEl.style.display = 'none'; }

        const tagsEl = document.getElementById('backTags');
        if (card.tags && card.tags.length) {
            tagsEl.innerHTML = '';
            tagsEl.appendChild(this._makeRevealable('🏷 Etiketler var', el => {
                el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
                el.innerHTML = card.tags.map(t => `<span class="tag-pill">${UI._esc(t)}</span>`).join('');
            }));
            tagsEl.style.display = 'block';
        } else { tagsEl.style.display = 'none'; }

        const familyEl = document.getElementById('backFamily');
        if (card.wordFamily) {
            const siblings = Cards.getAll().filter(c => c.wordFamily === card.wordFamily && c.id !== card.id);
            if (siblings.length) {
                familyEl.innerHTML = '';
                familyEl.appendChild(this._makeRevealable('🔗 Kelime ailesi var', el => {
                    el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;flex-direction:column';
                    el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">🔗 ${UI._esc(card.wordFamily)} ailesi</div>` +
                        siblings.map(s => `<span class="tag-pill" style="background:var(--accent,#6366f1);color:#fff;opacity:.85">${UI._esc(s.targetWord)} <small style="opacity:.75">${UI.wordTypeName(s.wordType)}</small></span>`).join('');
                }));
                familyEl.style.display = 'block';
            } else { familyEl.style.display = 'none'; }
        } else { familyEl.style.display = 'none'; }
    },

    _makeRevealable(label, renderFn) {
        const wrapper = document.createElement('div');
        wrapper.className = 'reveal-wrapper';

        const hint = document.createElement('div');
        hint.className = 'reveal-hint';
        hint.textContent = label + ' — tıkla';

        const content = document.createElement('div');
        content.className = 'reveal-content';
        renderFn(content);

        wrapper.appendChild(hint);
        wrapper.appendChild(content);
        wrapper.addEventListener('click', () => wrapper.classList.add('revealed'));
        return wrapper;
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
