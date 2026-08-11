/* ============================================================
   cards.js  –  Kart CRUD + istatistik + CSV
   ============================================================ */
const Cards = {
    _list: [],
    _suppressSave: false,   // toplu import sırasında ara save'leri atla

    init() {
        this._list = [];
    },

    getAll() { return [...this._list]; },

    getById(id) { return this._list.find(c => c.id === id); },

    add(data) {
        const card = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            sentence:     data.sentence.trim(),
            targetWord:   data.targetWord.trim(),
            wordType:     data.wordType,
            meaning:      (data.meaning    || '').trim(),
            meaningLang:  data.meaningLang || 'tr',
            explanation:  data.explanation.trim(),
            extraExample: (data.extraExample || '').trim(),
            notes:        (data.notes       || '').trim(),
            tags:         this._parseTags(data.tags),
            difficulty:   data.difficulty || 'normal',
            // SM-2 alanları
            interval:     1,
            easeFactor:   2.5,
            repetitions:  0,
            dueDate:      Algorithm.todayStr(),
            lastReviewedAt: null,
            reviewCount:  0,
            createdAt:    new Date().toISOString(),
        };
        this._list.unshift(card);
        if (!this._suppressSave) this._save();
        return card;
    },

    update(id, data) {
        const idx = this._list.findIndex(c => c.id === id);
        if (idx === -1) return null;
        this._list[idx] = {
            ...this._list[idx],
            sentence:     data.sentence.trim(),
            targetWord:   data.targetWord.trim(),
            wordType:     data.wordType,
            meaning:      (data.meaning    || '').trim(),
            meaningLang:  data.meaningLang || 'tr',
            explanation:  data.explanation.trim(),
            extraExample: (data.extraExample || '').trim(),
            notes:        (data.notes       || '').trim(),
            tags:         this._parseTags(data.tags),
            difficulty:   data.difficulty || 'normal',
        };
        this._save();
        return this._list[idx];
    },

    delete(id) {
        this._list = this._list.filter(c => c.id !== id);
        this._save();
    },

    review(id, rating) {
        const card = this.getById(id);
        if (!card) return;
        const result = Algorithm.calculate(card, rating);
        const idx = this._list.findIndex(c => c.id === id);
        this._list[idx] = {
            ...card,
            ...result,
            lastReviewedAt: new Date().toISOString(),
            reviewCount: (card.reviewCount || 0) + 1,
        };
        this._save();

        // Streak güncelle
        this._updateStreak();
        return this._list[idx];
    },

    getDue() {
        const today = Algorithm.todayStr();
        return this._list.filter(c => c.dueDate <= today);
    },

    getStats() {
        const all  = this._list;
        const today = Algorithm.todayStr();
        return {
            total:        all.length,
            due:          all.filter(c => c.dueDate <= today).length,
            learned:      all.filter(c => c.interval >= 7).length,
            hard:         all.filter(c => c.reviewCount > 0 && c.easeFactor < 2.4).length,
            totalReviews: all.reduce((s, c) => s + (c.reviewCount || 0), 0),
        };
    },

    // -------- CSV --------
    toCSV() {
        const h = ['sentence','targetWord','wordType','meaning','meaningLang','explanation',
                   'extraExample','notes','tags','difficulty',
                   'interval','easeFactor','repetitions','dueDate','reviewCount'];
        const rows = this._list.map(c =>
            h.map(k => {
                // Etiketler | ile ayrılır — ; artık sütun ayırıcısı
                const v = k === 'tags' ? (c.tags || []).join('|') : (c[k] ?? '');
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(';')
        );
        // sep= yok: Türk Excel zaten ; bekliyor, BOM encoding için yeterli
        return [h.join(';'), ...rows].join('\r\n');
    },

    fromCSV(text) {
        // BOM ve satır sonu normalizasyonu
        const stripped = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        const cleaned  = stripped
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
        const lines = cleaned.trim().split('\n')
            .filter(l => l.trim() && !l.trim().toLowerCase().startsWith('sep='));
        if (lines.length < 2) return 0;

        // Ayırıcıyı header satırından otomatik tespit et
        const delim = lines[0].includes(';') ? ';' : ',';

        // Başlık → sütun indeksi haritası (sıra bağımsız)
        const headers = this._parseCSVLine(lines[0], delim).map(h => h.toLowerCase().trim());
        const col = {};
        headers.forEach((h, i) => { col[h] = i; });

        if (col['sentence'] === undefined || col['targetword'] === undefined) return 0;

        const get = (row, key) => (row[col[key]] || '').trim();

        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = this._parseCSVLine(lines[i], delim);
            const sentence   = get(row, 'sentence');
            const targetWord = get(row, 'targetword');
            if (!sentence || !targetWord) continue;

            this.add({
                sentence,
                targetWord,
                wordType:     get(row, 'wordtype')   || 'other',
                meaning:      get(row, 'meaning'),
                explanation:  get(row, 'explanation'),
                extraExample: get(row, 'extraexample'),
                notes:        get(row, 'notes'),
                // | veya ; ile ayrılmış etiketleri virgüle çevir
                tags:         get(row, 'tags').replace(/[|;]/g, ','),
                difficulty:   get(row, 'difficulty') || 'normal',
            });
            count++;
        }
        return count;
    },

    // -------- helpers --------
    _parseTags(raw) {
        if (!raw) return [];
        return raw.split(',').map(t => t.trim()).filter(Boolean);
    },

    _parseCSVLine(line, delim = ',') {
        const res = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i+1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (ch === delim && !inQ) { res.push(cur); cur = ''; }
            else cur += ch;
        }
        res.push(cur);
        return res;
    },

    _updateStreak() {
        const s = Storage.loadStats();
        const today = Algorithm.todayStr();
        if (s.lastStudyDate === today) return;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yd = yesterday.toISOString().split('T')[0];
        s.streak = s.lastStudyDate === yd ? (s.streak || 0) + 1 : 1;
        s.lastStudyDate = today;
        Storage.saveStats(s);
    },

    _save() { /* localStorage kullanılmıyor — Supabase kaynak */ },
};
