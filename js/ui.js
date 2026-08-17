/* ============================================================
   ui.js  –  Render & navigation helpers
   ============================================================ */
const UI = {
    currentPage: 'dashboard',
    deleteTargetId: null,

    _typeNames: {
        noun:        'Noun / İsim',
        verb:        'Verb / Fiil',
        adjective:   'Adjective / Sıfat',
        adverb:      'Adverb / Zarf',
        preposition: 'Preposition / Edat',
        conjunction: 'Conjunction / Bağlaç',
        pronoun:     'Pronoun / Zamir',
        phrase:      'Phrase / Kalıp',
        other:       'Other / Diğer',
    },

    wordTypeName(type) {
        return this._typeNames[type] || type;
    },

    /* Cümle içinde targetWord'ü <span> ile sarar */
    highlightWord(sentence, targetWord) {
        if (!targetWord || !sentence) return sentence || '';
        const esc = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return sentence.replace(
            new RegExp(`(${esc})`, 'gi'),
            '<span class="target-word">$1</span>'
        );
    },

    // -------- Navigation --------
    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        const navEl  = document.querySelector(`[data-page="${page}"]`);
        if (pageEl) pageEl.classList.add('active');
        if (navEl)  navEl.classList.add('active');

        const titles = {
            dashboard:   'Dashboard',
            'add-card':  'Kart Ekle',
            'card-list': 'Kartlarım',
            study:       'Çalış',
            stats:       'İstatistik',
            settings:    'Ayarlar',
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;
        this.currentPage = page;

        if (page === 'dashboard')  this.renderDashboard();
        if (page === 'card-list')  this.renderCardList();
        if (page === 'study')      Study.start();
        if (page === 'stats')      this.renderStats();

        this.closeSidebar();
    },

    // -------- Dashboard --------
    renderDashboard() {
        const s = Cards.getStats();
        document.getElementById('totalCards').textContent   = s.total;
        document.getElementById('dueCards').textContent     = s.due;
        document.getElementById('learnedCards').textContent = s.learned;
        document.getElementById('hardCards').textContent    = s.hard;
        document.getElementById('studyBadge').textContent   = s.due;

        const recentEl = document.getElementById('recentCards');
        const all = Cards.getAll().slice(0, 6);
        if (!all.length) {
            recentEl.innerHTML = `
                <div class="empty-state">
                    <p>Henüz kart eklenmemiş.</p>
                    <button class="btn btn-primary" onclick="navigateTo('add-card')">İlk Kartı Ekle</button>
                </div>`;
            return;
        }
        recentEl.innerHTML = all.map(card => `
            <div class="card-preview-item" onclick="navigateTo('card-list')">
                <div class="card-preview-sentence">${this.highlightWord(card.sentence, card.targetWord)}</div>
                <span class="card-preview-word">${this._esc(card.targetWord)}</span>
                <span class="word-type-pill type-badge-${card.wordType}">${card.wordType}</span>
            </div>`).join('');
    },

    // -------- Card List --------
    async renderCardList() {
        const search   = (document.getElementById('searchInput')?.value  || '').trim();
        const wordType =  document.getElementById('filterType')?.value   || '';
        const family   = (document.getElementById('filterFamily')?.value || '').trim();
        const page     = typeof _cardListPage !== 'undefined' ? _cardListPage : 0;
        const pageSize = 20;

        const container = document.getElementById('cardsList');
        if (!container) return;
        container.innerHTML = '<div class="empty-state"><p>Yükleniyor…</p></div>';

        const { cards, total } = await Sync.fetchCards({ search, wordType, family, page, pageSize });

        if (!cards.length) {
            container.innerHTML = '<div class="empty-state"><p>Kart bulunamadı.</p></div>';
            document.getElementById('cardListPagination').style.display = 'none';
            return;
        }

        const today = Algorithm.todayStr();
        container.innerHTML = cards.map(card => {
            const overdue = card.dueDate < today;
            const dueText = card.dueDate === today ? 'Bugün'
                          : overdue               ? 'Gecikmiş'
                          : card.dueDate;
            return `
            <div class="card-list-item">
                <div class="card-list-content">
                    <div class="card-list-sentence">${this.highlightWord(card.sentence, card.targetWord)}</div>
                    <div class="card-list-meta">
                        <span class="word-type-pill type-badge-${card.wordType}">${card.wordType}</span>
                        <span class="card-list-word">${this._esc(card.targetWord)}</span>
                        ${card.meaning ? `<span class="card-list-meaning">— ${this._esc(card.meaning)}</span>` : ''}
                        <span class="card-list-due ${overdue ? 'overdue' : ''}">${dueText}</span>
                        ${card.wordFamily ? `<span class="tag-pill" style="background:var(--accent,#6366f1);color:#fff;opacity:.85">🔗 ${this._esc(card.wordFamily)}</span>` : ''}
                        ${(card.tags || []).includes('leech') ? '<span class="tag-pill" style="background:var(--error,#ef4444);color:#fff">🐛 leech</span>' : ''}
                    </div>
                </div>
                <div class="card-list-actions">
                    <button class="btn-icon" onclick="viewCard('${card.id}')" title="Görüntüle">👁</button>
                    <button class="btn-icon" onclick="editCard('${card.id}')" title="Düzenle">✏️</button>
                    <button class="btn-icon delete" onclick="confirmDelete('${card.id}')" title="Sil">🗑️</button>
                </div>
            </div>`;
        }).join('');

        // Sayfalama
        const totalPages = Math.ceil(total / pageSize);
        const pagBar = document.getElementById('cardListPagination');
        if (totalPages > 1) {
            pagBar.style.display = 'flex';
            document.getElementById('paginationInfo').textContent =
                `${page + 1} / ${totalPages} sayfa  (${total} kart)`;
            document.getElementById('prevPageBtn').disabled = page === 0;
            document.getElementById('nextPageBtn').disabled = page >= totalPages - 1;
        } else {
            pagBar.style.display = 'none';
        }
    },

    // -------- Stats --------
    renderStats() {
        const s  = Cards.getStats();
        const ls = Storage.loadStats();
        document.getElementById('statTotal').textContent   = s.total;
        document.getElementById('statLearned').textContent = s.learned;
        document.getElementById('statHard').textContent    = s.hard;
        document.getElementById('statDue').textContent     = s.due;
        document.getElementById('statReviews').textContent = s.totalReviews;
        document.getElementById('statStreak').textContent  = ls.streak || 0;

        const all = Cards.getAll();
        const counts = {};
        all.forEach(c => { counts[c.wordType] = (counts[c.wordType] || 0) + 1; });
        const max = Math.max(...Object.values(counts), 1);
        const chartEl = document.getElementById('wordTypeChart');

        if (!Object.keys(counts).length) {
            chartEl.innerHTML = '<p style="color:var(--text-muted)">Henüz kart yok.</p>';
            return;
        }
        chartEl.innerHTML = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, n]) => `
                <div class="chart-bar-item">
                    <div class="chart-label">${this._typeNames[type] || type}</div>
                    <div class="chart-bar-container">
                        <div class="chart-bar-fill" style="width:${(n/max)*100}%">${n}</div>
                    </div>
                </div>`).join('');
    },

    // -------- Modal --------
    openModal(id) {
        this.deleteTargetId = id;
        document.getElementById('modalOverlay').style.display = 'flex';
    },
    closeModal() {
        this.deleteTargetId = null;
        document.getElementById('modalOverlay').style.display = 'none';
    },

    // -------- Sidebar --------
    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('visible');
    },
    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('visible');
    },

    // -------- Toast --------
    showToast(msg, type = 'success') {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className   = `toast ${type} show`;
        setTimeout(() => { t.className = 'toast'; }, 3000);
    },

    // -------- Theme --------
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const s = Storage.loadSettings();
        s.theme = theme;
        Storage.saveSettings(s);
        document.getElementById('darkModeBtn').classList.toggle('active', theme === 'dark');
        document.getElementById('lightModeBtn').classList.toggle('active', theme === 'light');
    },

    // -------- util --------
    _esc(str) {
        return String(str || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },
};
