/* ============================================================
   app.js  –  Bootstrap & global event handlers
   ============================================================ */

// ── Auth state ──────────────────────────────────────────────
let _appInitialized = false;

function _showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
}

function _hideAuthScreen() {
    document.getElementById('authScreen').style.display = 'none';
}

async function _startApp() {
    _hideAuthScreen();
    UI.showToast('Yükleniyor…');
    await Sync.pullAndMerge();
    Sync.subscribeToChanges();
    if (!_appInitialized) {
        initApp();
        _appInitialized = true;
    } else {
        Cards.init();
        UI.renderDashboard();
    }
    _updateAccountUI();
}

function _updateAccountUI() {
    const emailEl = document.getElementById('accountEmail');
    if (emailEl && Sync.user) emailEl.textContent = Sync.user.email;
}

// ── Auth UI handlers ────────────────────────────────────────
function switchAuthTab() {} // login-only — no tabs

function _authMsg(text, type = 'error') {
    const el = document.getElementById('authMessage');
    el.className = `auth-message ${type}`;
    el.textContent = text;
    el.style.display = 'block';
}

function _translateAuthError(msg) {
    if (!msg) return 'Bilinmeyen hata.';
    if (msg.includes('Invalid login credentials'))  return 'E-posta veya şifre hatalı.';
    if (msg.includes('Email not confirmed'))         return 'E-posta doğrulanmamış.';
    if (msg.includes('Password should be at least')) return 'Şifre en az 6 karakter olmalı.';
    return msg;
}

async function submitAuth(e) {
    e.preventDefault();
    const email     = document.getElementById('authEmail').value.trim();
    const password  = document.getElementById('authPassword').value;
    const submitBtn = document.getElementById('authSubmitBtn');

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Giriş yapılıyor…';
    document.getElementById('authMessage').style.display = 'none';

    try {
        await Sync.signIn(email, password);
        await _startApp();
    } catch (err) {
        _authMsg(_translateAuthError(err.message));
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Giriş Yap';
    }
}

async function logOut() {
    if (!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;
    await Sync.signOut();
    Storage.clearAll();
    Cards.init();
    _appInitialized = false;
    document.getElementById('authEmail').value    = '';
    document.getElementById('authPassword').value = '';
    _showAuthScreen();
}

async function changePassword() {
    const input = document.getElementById('newPassword');
    const pw    = input.value.trim();
    if (pw.length < 6) { UI.showToast('Şifre en az 6 karakter olmalı.', 'error'); return; }
    try {
        await Sync.updatePassword(pw);
        input.value = '';
        UI.showToast('Şifre güncellendi!');
    } catch (err) {
        UI.showToast('Hata: ' + err.message, 'error');
    }
}

async function manualSync() {
    const btn = document.getElementById('syncBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Senkronize ediliyor…'; }
    try {
        await Sync.pullAndMerge();
        UI.renderDashboard();
        UI.showToast('Senkronizasyon tamamlandı!');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Şimdi Senkronize Et'; }
    }
}

// ── Meaning language toggle ──────────────────────────────────
function setMeaningLang(lang) {
    document.getElementById('meaningLangInput').value = lang;
    document.getElementById('meaningLangTR').classList.toggle('active', lang === 'tr');
    document.getElementById('meaningLangEN').classList.toggle('active', lang === 'en');
    document.getElementById('meaningInput').placeholder =
        lang === 'tr' ? 'hızlıca, çabucak' : 'quickly, swiftly';
}

// ── Global helpers (HTML onclick'ler için) ──────────────────
function navigateTo(page)    { UI.navigateTo(page); }
function showAnswer()        { Study.showAnswer(); }
function rateCard(rating)    { Study.rate(rating); }
function closeModal()        { UI.closeModal(); }
function setTheme(theme)     { UI.setTheme(theme); }
function confirmDelete(id)   { UI.openModal(id); }

// ── Kart düzenleme ──────────────────────────────────────────
function editCard(id) {
    const card = Cards.getById(id);
    if (!card) return;

    document.getElementById('editCardId').value        = card.id;
    document.getElementById('formTitle').textContent   = 'Kartı Düzenle';
    document.getElementById('sentenceInput').value     = card.sentence;
    document.getElementById('targetWordInput').value   = card.targetWord;
    document.getElementById('wordTypeSelect').value    = card.wordType;
    document.getElementById('meaningInput').value      = card.meaning      || '';
    setMeaningLang(card.meaningLang || 'tr');
    document.getElementById('explanationInput').value  = card.explanation  || '';
    document.getElementById('extraExampleInput').value = card.extraExample || '';
    document.getElementById('notesInput').value        = card.notes        || '';
    document.getElementById('tagsInput').value         = (card.tags || []).join(', ');
    document.getElementById('difficultySelect').value  = card.difficulty   || 'normal';
    document.getElementById('wordFamilyInput').value   = card.wordFamily   || '';

    _buildClickablePreview(card.sentence, card.targetWord);
    navigateTo('add-card');
}

// ── Formu sıfırla ───────────────────────────────────────────
function resetForm() {
    document.getElementById('cardForm').reset();
    document.getElementById('editCardId').value      = '';
    document.getElementById('formTitle').textContent = 'Yeni Kart Ekle';
    document.getElementById('clickablePreviewGroup').style.display = 'none';
    document.getElementById('clickablePreview').innerHTML = '';
    setMeaningLang('tr');
    navigateTo('dashboard');
}

function _csvBlob(csvString) {
    const bom     = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const encoded = new TextEncoder().encode(csvString);
    return new Blob([bom, encoded], { type: 'text/csv;charset=utf-8;' });
}

function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── CSV export ──────────────────────────────────────────────
function exportCSV() {
    const blob = _csvBlob(Cards.toCSV());
    _triggerDownload(blob, `ankibase_${Algorithm.todayStr()}.csv`);
    UI.showToast('CSV indirildi!');
}

// ── CSV template ────────────────────────────────────────────
function downloadTemplate() {
    const headers = ['sentence','targetWord','wordType','meaning','explanation',
                     'extraExample','notes','tags','difficulty'];
    const examples = [
        ['She quickly understood the problem.',
         'quickly','adverb','hızlıca',
         'In a quick or speedy manner.',
         'He quickly left the room.',
         'quickly = hız zarfı',
         'adverb|B2','normal'],
        ['The agreement was reached after long negotiations.',
         'negotiations','noun','müzakereler',
         'Formal discussions to reach an agreement.',
         'Peace negotiations lasted three days.',
         '','noun|business|C1','normal'],
        ['She has a profound understanding of the subject.',
         'profound','adjective','derin, köklü',
         'Very great or intense; showing deep knowledge.',
         'His speech had a profound effect on the audience.',
         '','adjective|C1','hard'],
    ];

    const q   = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...examples].map(r => r.map(q).join(';')).join('\r\n');
    _triggerDownload(_csvBlob(csv), 'ankibase_template.csv');
    UI.showToast('Template indirildi!');
}

// ── CSV import ──────────────────────────────────────────────
function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        const count = Cards.fromCSV(e.target.result);
        UI.showToast(`${count} kart içe aktarıldı!`);
        UI.renderDashboard();
        event.target.value = '';
        if (count > 0) Sync.pushAll().catch(console.warn);
    };
    reader.readAsText(file, 'UTF-8');
}

// ── Anki .apkg / .colpkg import ─────────────────────────────

function _loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = Object.assign(document.createElement('script'), { src });
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

function _stripHtml(html) {
    return (html || '')
        .replace(/\[sound:[^\]]+\]/g, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<div>/gi, ' ').replace(/<\/div>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function _ankiExtract(fields, isCloze) {
    if (isCloze) {
        const raw = fields[0] || '';
        const m   = raw.match(/\{\{c\d+::([^:}]+)/);
        return {
            sentence:     _stripHtml(raw.replace(/\{\{c\d+::([^:}]+)(?:::[^}]*)?\}\}/g, '$1')),
            targetWord:   m ? _stripHtml(m[1]) : '',
            explanation:  _stripHtml(fields[1] || ''),
            extraExample: _stripHtml(fields[2] || ''),
        };
    }

    const clean = fields.map(f => _stripHtml(f || ''));
    const f0 = clean[0], f1 = clean[1] || '', f2 = clean[2] || '', f3 = clean[3] || '';
    const wordCount = s => (s ? s.split(/\s+/).filter(Boolean).length : 0);

    if (f0 && wordCount(f0) <= 3 && wordCount(f1) > wordCount(f0)) {
        const example = [f2, f3].find(f => wordCount(f) > 3) || '';
        return {
            sentence:     example || f1 || f0,
            targetWord:   f0,
            explanation:  f1,
            extraExample: (example && example !== f1) ? example : '',
        };
    }

    const rawFront = fields[0] || '';
    const bold = rawFront.match(/<b[^>]*>([\s\S]*?)<\/b>/i);

    if (f0) {
        const targetWord = bold
            ? _stripHtml(bold[1])
            : (f0.split(/\s+/).filter(Boolean)[0] || '');
        return { sentence: f0, targetWord, explanation: f1, extraExample: f2 };
    } else {
        const targetWord = f1.split(/\s+/).filter(Boolean)[0] || '';
        return { sentence: f1, targetWord, explanation: f2, extraExample: f3 };
    }
}

async function importAnkiFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    let db = null;
    try {
        UI.showToast('Kütüphaneler yükleniyor…');
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js');

        UI.showToast('Dosya açılıyor…');
        const buffer = await file.arrayBuffer();
        const zip    = await JSZip.loadAsync(buffer);

        const zipFiles = Object.keys(zip.files).join(', ');
        console.log('[Anki Import] ZIP içeriği:', zipFiles);

        const compressedEntry = zip.file('collection.anki21b');
        const legacyEntry     = zip.file('collection.anki21') || zip.file('collection.anki2');

        if (!compressedEntry && !legacyEntry) {
            UI.showToast(`Geçersiz dosya. ZIP içeriği: ${zipFiles.slice(0, 100)}`, 'error');
            return;
        }

        let dbBytes;
        if (compressedEntry) {
            UI.showToast('Sıkıştırılmış format açılıyor…');
            await _loadScript('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js');
            const compressed = await compressedEntry.async('uint8array');
            console.log('[Anki Import] Sıkıştırılmış:', compressed.length, 'bayt');
            dbBytes = fzstd.decompress(compressed);
            console.log('[Anki Import] Açılmış:', dbBytes.length, 'bayt');
        } else {
            UI.showToast('Veritabanı okunuyor…');
            dbBytes = await legacyEntry.async('uint8array');
        }

        const SQL = await initSqlJs({
            locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
        });
        db = new SQL.Database(dbBytes);

        let crt = 0, models = {};
        try {
            const colRes = db.exec('SELECT crt, models FROM col LIMIT 1');
            crt    = Number(colRes[0]?.values[0]?.[0]) || 0;
            models = JSON.parse(colRes[0]?.values[0]?.[1] || '{}') || {};
        } catch (_) {
            try {
                const r = db.exec('SELECT crt FROM col LIMIT 1');
                crt = Number(r[0]?.values[0]?.[0]) || 0;
            } catch (_2) {}
        }
        console.log('[Anki Import] crt:', crt, '| model sayısı:', Object.keys(models).length);

        if (!Object.keys(models).length) {
            try {
                const ntRes = db.exec('SELECT id, name FROM notetypes');
                (ntRes[0]?.values || []).forEach(([id, name]) => {
                    const entry = { name, type: (name || '').toLowerCase().includes('cloze') ? 1 : 0 };
                    models[id] = models[String(id)] = entry;
                });
                console.log('[Anki Import] notetypes tablosundan model sayısı:', Object.keys(models).length / 2);
            } catch (_) {
                console.warn('[Anki Import] notetypes tablosu okunamadı');
            }
        }

        let noteRows = [];
        try {
            const res = db.exec(`
                SELECT n.id, n.mid, n.tags, n.flds,
                       COALESCE(c.ivl, 0), COALESCE(c.factor, 0),
                       COALESCE(c.reps, 0), COALESCE(c.due, 0), COALESCE(c.type, 0)
                FROM notes n
                LEFT JOIN cards c ON c.nid = n.id AND c.ord = 0
            `);
            noteRows = res[0]?.values || [];
        } catch (sqlErr) {
            console.warn('[Anki Import] Ana sorgu başarısız:', sqlErr.message);
            try {
                const res = db.exec('SELECT id, mid, tags, flds FROM notes');
                noteRows = (res[0]?.values || []).map(r => [...r, 0, 0, 0, 0, 0]);
            } catch (fallbackErr) {
                throw new Error('notes tablosu okunamadı: ' + fallbackErr.message);
            }
        }

        console.log('[Anki Import] Toplam not satırı:', noteRows.length);

        if (!noteRows.length) {
            UI.showToast('Koleksiyonda hiç not bulunamadı.', 'error');
            db.close(); return;
        }

        const todayStr = Algorithm.todayStr();
        let count = 0, skipped = 0;
        const skipReasons = {};

        Cards._suppressSave = true;

        for (const row of noteRows) {
            try {
                const [, mid, rawTags, flds, ivl, factor, reps, due, ctype] = row;
                const fields = String(flds || '').split('\x1f');

                const model     = models[mid] || models[String(mid)];
                const modelName = model ? (model.name || '').toLowerCase() : '';
                const isCloze   = modelName.includes('cloze') || (model?.type === 1);

                const { sentence, targetWord, explanation, extraExample } =
                    _ankiExtract(fields, isCloze);

                if (!sentence || !targetWord) {
                    const reason = !sentence ? 'cümle_boş' : 'kelime_boş';
                    skipReasons[reason] = (skipReasons[reason] || 0) + 1;
                    skipped++;
                    if (skipped <= 3) console.log('[Anki Import] Atlandı:', reason, '| fields[0]:', (fields[0] || '').slice(0, 80));
                    continue;
                }

                const tags    = (rawTags || '').trim().split(/\s+/).filter(Boolean);
                const cardIvl = (ivl > 0) ? Number(ivl) : 1;
                const cardEF  = (factor > 0) ? Math.round(Number(factor)) / 1000 : 2.5;
                const cardRep = Number(reps) || 0;

                let dueDate = todayStr;
                if (ctype === 2 && ivl > 0 && crt > 0) {
                    const d = new Date((crt + Number(due) * 86400) * 1000);
                    dueDate = d.toISOString().split('T')[0];
                }

                Cards.add({
                    sentence, targetWord,
                    wordType: 'other', meaning: '',
                    explanation, extraExample, notes: '',
                    tags: tags.join(','), difficulty: 'normal',
                });

                const c = Cards._list[0];
                c.interval    = cardIvl;
                c.easeFactor  = cardEF;
                c.repetitions = cardRep;
                c.dueDate     = dueDate;
                c.reviewCount = cardRep;

                count++;
            } catch (noteErr) {
                skipped++;
                console.warn('[Anki Import] Kart işleme hatası:', noteErr.message);
            }
        }

        Cards._suppressSave = false;
        Cards._save();
        db.close();

        console.log('[Anki Import] Sonuç — aktarılan:', count, '| atlanılan:', skipped, '| nedenler:', skipReasons);

        const msg = skipped
            ? `${count} kart aktarıldı, ${skipped} atlandı.`
            : `${count} Anki kartı başarıyla içe aktarıldı!`;
        UI.showToast(msg);
        UI.renderDashboard();

        if (count > 0) Sync.pushAll().catch(console.warn);

    } catch (err) {
        Cards._suppressSave = false;
        Cards._save();
        if (db) try { db.close(); } catch(_) {}
        console.error('[Anki Import] Hata:', err);
        UI.showToast('Hata: ' + (err.message || 'Dosya okunamadı'), 'error');
    }
}

// ── Tüm veriyi sil ──────────────────────────────────────────
async function clearAllData() {
    if (!confirm('Tüm veriler silinecek. Bu işlem geri alınamaz. Emin misiniz?')) return;
    Sync.removeAllCards().catch(console.warn);
    Storage.clearAll();
    Cards.init();
    UI.showToast('Tüm veriler silindi.', 'error');
    navigateTo('dashboard');
}

// ── Clickable sentence preview ──────────────────────────────
function _buildClickablePreview(sentence, preSelectedWord) {
    if (!sentence || !sentence.trim()) {
        document.getElementById('clickablePreviewGroup').style.display = 'none';
        return;
    }
    const preview = document.getElementById('clickablePreview');
    const group   = document.getElementById('clickablePreviewGroup');

    // Kelimelere sıra numarası ver
    let wordIdx = 0;
    const tokens = sentence.match(/\S+|\s+/g) || [];
    preview.innerHTML = tokens.map(token => {
        if (/^\s+$/.test(token)) return token;
        const m = token.match(/^([^a-zA-Z]*)([a-zA-Z'-]+)([^a-zA-Z]*)$/);
        if (!m || !m[2]) return `<span>${token}</span>`;
        const [, pre, word, post] = m;
        const idx = wordIdx++;
        return `${pre}<span class="clickable-word" data-word="${word}" data-idx="${idx}">${word}</span>${post}`;
    }).join('');

    group.style.display = 'block';

    const getSpans = () => [...preview.querySelectorAll('.clickable-word')];

    // Önceden seçili kelime: tek veya çok kelimeli ("depend on" gibi)
    if (preSelectedWord) {
        const words = preSelectedWord.trim().split(/\s+/).filter(Boolean);
        const spans = getSpans();
        if (words.length === 1) {
            spans.forEach(el => {
                if (el.dataset.word.toLowerCase() === words[0].toLowerCase())
                    el.classList.add('selected');
            });
        } else {
            for (let i = 0; i <= spans.length - words.length; i++) {
                if (words.every((w, j) => spans[i + j]?.dataset.word.toLowerCase() === w.toLowerCase())) {
                    words.forEach((_, j) => spans[i + j].classList.add('selected'));
                    break;
                }
            }
        }
    }

    // Toggle seçimi: her tık kelimeyi seçer/kaldırır
    // Birden fazla kelime seçilebilir (cümlede geçiş sırasına göre birleştirilir)
    const updateTargetFromSelection = () => {
        const selected = getSpans().filter(w => w.classList.contains('selected'));
        document.getElementById('targetWordInput').value = selected.map(w => w.dataset.word).join(' ');
    };

    getSpans().forEach(el => {
        el.addEventListener('click', () => {
            el.classList.toggle('selected');
            updateTargetFromSelection();
        });
    });
}

// ── App başlatma ────────────────────────────────────────────
function initApp() {
    Cards.init();

    const settings = Storage.loadSettings();
    UI.setTheme(settings.theme || 'dark');
    const limitEl = document.getElementById('dailyLimitInput');
    if (limitEl) limitEl.value = settings.dailyLimit || 20;
    const newPerDayEl = document.getElementById('newPerDayInput');
    if (newPerDayEl) newPerDayEl.value = settings.newPerDay || 5;

    // ── Navigasyon ──
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // ── Sidebar ──
    document.getElementById('menuBtn').addEventListener('click', () => UI.toggleSidebar());
    document.getElementById('sidebarClose').addEventListener('click', () => UI.closeSidebar());
    document.getElementById('sidebarOverlay').addEventListener('click', () => UI.closeSidebar());

    // ── Kart formu ──
    document.getElementById('cardForm').addEventListener('submit', e => {
        e.preventDefault();
        const id   = document.getElementById('editCardId').value;
        const data = {
            sentence:     document.getElementById('sentenceInput').value,
            targetWord:   document.getElementById('targetWordInput').value,
            wordType:     document.getElementById('wordTypeSelect').value,
            meaning:      document.getElementById('meaningInput').value,
            meaningLang:  document.getElementById('meaningLangInput').value || 'tr',
            explanation:  document.getElementById('explanationInput').value,
            extraExample: document.getElementById('extraExampleInput').value,
            notes:        document.getElementById('notesInput').value,
            tags:         document.getElementById('tagsInput').value,
            difficulty:   document.getElementById('difficultySelect').value,
            wordFamily:   document.getElementById('wordFamilyInput').value,
        };
        if (id) {
            const updated = Cards.update(id, data);
            UI.showToast('Kart güncellendi!');
            Sync.pushCard(updated).catch(console.warn);
        } else {
            const card = Cards.add(data);
            UI.showToast('Kart eklendi!');
            Sync.pushCard(card).catch(console.warn);
        }
        resetForm();
    });

    // ── Cümle input → clickable preview ──
    document.getElementById('sentenceInput').addEventListener('input', e => {
        _buildClickablePreview(e.target.value);
    });

    // ── Hedef kelime input ↔ preview sync ──
    document.getElementById('targetWordInput').addEventListener('input', e => {
        const typed = e.target.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        document.getElementById('clickablePreview')
            .querySelectorAll('.clickable-word')
            .forEach(el => el.classList.toggle('selected', typed.includes(el.dataset.word.toLowerCase())));
    });

    // ── Arama + filtre ──
    document.getElementById('searchInput')?.addEventListener('input', () => UI.renderCardList());
    document.getElementById('filterType')?.addEventListener('change', () => UI.renderCardList());

    // ── Silme onayı ──
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (!UI.deleteTargetId) return;
        const id  = UI.deleteTargetId;
        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled    = true;
        btn.textContent = 'Siliniyor…';
        Cards.delete(id);
        await Sync.removeCard(id).catch(console.warn);
        UI.closeModal();
        btn.disabled    = false;
        btn.textContent = 'Sil';
        UI.renderCardList();
        UI.showToast('Kart silindi.', 'error');
    });

    // ── Aile filtresi ──
    document.getElementById('filterFamily')?.addEventListener('input', () => UI.renderCardList());

    // ── Günlük limit ayarı ──
    document.getElementById('dailyLimitInput')?.addEventListener('change', e => {
        const s = Storage.loadSettings();
        s.dailyLimit = parseInt(e.target.value) || 20;
        Storage.saveSettings(s);
    });

    // ── Günlük yeni kart ayarı ──
    document.getElementById('newPerDayInput')?.addEventListener('change', e => {
        const s = Storage.loadSettings();
        s.newPerDay = parseInt(e.target.value) || 5;
        Storage.saveSettings(s);
    });

    // ── Klavye kısayolları ──
    document.addEventListener('keydown', e => {
        const tag = document.activeElement.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        if (UI.currentPage !== 'study') return;

        if (e.code === 'Space') {
            e.preventDefault();
            Study.showAnswer();
            return;
        }
        if (!Study.isAnswerShown) return;
        if (e.key === '1') rateCard('again');
        if (e.key === '2') rateCard('hard');
        if (e.key === '3') rateCard('good');
        if (e.key === '4') rateCard('easy');
    });

    // ── İlk render ──
    UI.renderDashboard();

    // ── Kalıcı depolama ──
    _initPersistentStorage();
}

// ── Kalıcı depolama yönetimi ────────────────────────────────
async function _initPersistentStorage() {
    if (!navigator.storage) return;
    try {
        const already = await navigator.storage.persisted();
        if (!already) await navigator.storage.persist();
    } catch (_) {}
    _updateStorageStatus();
    try {
        const persisted = await navigator.storage.persisted();
        if (!persisted && Cards.getAll().length > 0 && !Sync.user) {
            setTimeout(() => {
                UI.showToast('⚠️ Veriler korunmuyor! Ayarlar\'dan CSV yedek alın.', 'error');
            }, 2000);
        }
    } catch (_) {}
}

async function _updateStorageStatus() {
    const el = document.getElementById('storageStatus');
    if (!el || !navigator.storage) return;
    try {
        const [persisted, estimate] = await Promise.all([
            navigator.storage.persisted(),
            navigator.storage.estimate(),
        ]);
        const usedKB = Math.round((estimate.usage || 0) / 1024);
        if (persisted) {
            el.textContent = `✅ Korumalı (${usedKB} KB)`;
            el.style.color = 'var(--success, #10b981)';
        } else {
            el.textContent = `⚠️ Korumasız – yedek alın (${usedKB} KB)`;
            el.style.color = 'var(--danger, #ef4444)';
        }
    } catch (_) {
        el.textContent = 'Bilinmiyor';
    }
}

// Yeni Service Worker aktif olduğunda sayfayı otomatik yenile
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SW_UPDATED') window.location.reload();
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    Sync.init();
    const user = await Sync.getSession();
    if (!user) {
        _showAuthScreen();
    } else {
        await _startApp();
    }
});
