/* ============================================================
   sync.js  –  Supabase auth + multi-device sync
   ============================================================ */

const SUPABASE_URL  = 'https://ahcejabtkpdrvmkrewvl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoY2VqYWJ0a3BkcnZta3Jld3ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA1OTAsImV4cCI6MjEwMTk1NjU5MH0.RkmYFcqEcnjklFIxov_1q67HnKOJ9sRo_BC_8xrwCTQ';

const Sync = {
    client:     null,
    user:       null,
    lastSynced: null,
    _channel:   null,
    _pollTimer: null,

    init() {
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    },

    // Realtime: karttaki her değişikliği dinle, UI'ı güncelle
    subscribeToChanges() {
        if (!this.user || !this.client) return;
        if (this._channel) this.client.removeChannel(this._channel);

        const handler = async () => {
            await this.pullAndMerge();
            if (typeof UI !== 'undefined') UI.renderDashboard();
        };

        this._channel = this.client
            .channel('cards-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' }, handler)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards' }, handler)
            .on('broadcast', { event: 'card_deleted' }, handler)
            .subscribe();

        // DELETE Realtime güvenilir değil — 10sn'de bir poll ile yakala
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = setInterval(async () => {
            await this.pullAndMerge();
            if (typeof UI !== 'undefined') UI.renderDashboard();
        }, 10000);
    },

    // ── Auth ─────────────────────────────────────────────────

    async signUp(email, password) {
        const { data, error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    },

    async signIn(email, password) {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.user = data.user;
        return data;
    },

    async updatePassword(newPassword) {
        const { error } = await this.client.auth.updateUser({ password: newPassword });
        if (error) throw error;
    },

    async signOut() {
        await this.client.auth.signOut();
        this.user = null;
    },

    async getSession() {
        const { data } = await this.client.auth.getSession();
        this.user = data.session?.user ?? null;
        return this.user;
    },

    // ── Card sync ─────────────────────────────────────────────

    async pushCard(card) {
        if (!this.user || !this.client || !card) return;
        try {
            const { error } = await this.client
                .from('cards')
                .upsert(this._toRow(card), { onConflict: 'id' });
            if (error) console.warn('[Sync] pushCard:', error.message);
        } catch (e) { console.warn('[Sync] pushCard exception:', e); }
    },

    async removeCard(id) {
        if (!this.user || !this.client) return;
        try {
            const { error } = await this.client.from('cards').delete().eq('id', id);
            if (error) { console.warn('[Sync] removeCard error:', error.message); return; }
            // DELETE Realtime RLS tarafından bloke edildiğinden broadcast gönder
            if (this._channel) {
                await this._channel.send({ type: 'broadcast', event: 'card_deleted', payload: { id } });
            }
        } catch (e) { console.warn('[Sync] removeCard exception:', e); }
    },

    async removeAllCards() {
        if (!this.user || !this.client) return;
        try {
            await this.client.from('cards').delete().eq('user_id', this.user.id);
        } catch (e) { console.warn('[Sync] removeAllCards:', e); }
    },

    async pushAll() {
        if (!this.user || !this.client) return;
        const cards = Cards.getAll();
        if (!cards.length) return;
        const rows = cards.map(c => this._toRow(c));
        for (let i = 0; i < rows.length; i += 500) {
            try {
                const { error } = await this.client
                    .from('cards')
                    .upsert(rows.slice(i, i + 500), { onConflict: 'id' });
                if (error) console.warn('[Sync] pushAll chunk:', error.message);
            } catch (e) { console.warn('[Sync] pushAll exception:', e); }
        }
        this._markSynced();
    },

    // Pull from Supabase and merge with local
    async pullAndMerge() {
        if (!this.user || !this.client) return false;
        try {
            const { data, error } = await this.client
                .from('cards')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) { console.warn('[Sync] pull error:', error.message); return false; }

            const remote = (data || []).map(r => this._fromRow(r));
            const local  = Storage.loadCards();
            console.log(`[Sync] pullAndMerge → remote: ${remote.length}, local: ${local.length}`);

            if (remote.length > 0) {
                // Remote her zaman kaynak — silinen kartların geri gelmesini önler
                Storage.saveCards(remote);
                Cards.init();
                console.log('[Sync] ← remote kullanıldı');
            } else if (local.length && !localStorage.getItem('ankibase_synced')) {
                // Remote boş ve hiç sync edilmemiş: ilk girişte local kartları yükle
                console.log('[Sync] → ilk giriş: local kartlar Supabase\'e yükleniyor');
                const rows = local.map(c => this._toRow(c));
                for (let i = 0; i < rows.length; i += 500)
                    await this.client.from('cards').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
            } else {
                console.log('[Sync] ← remote boş, local üzerine yazılmadı');
            }

            localStorage.setItem('ankibase_synced', '1');
            this._markSynced();
            return true;
        } catch (e) { console.warn('[Sync] pullAndMerge exception:', e); return false; }
    },

    _markSynced() {
        this.lastSynced = new Date();
        const el = document.getElementById('syncStatus');
        if (!el) return;
        const t = this.lastSynced.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `✅ Senkronize – ${t}`;
        el.style.color = 'var(--success, #10b981)';
    },

    // ── Field mapping ─────────────────────────────────────────

    _toRow(card) {
        return {
            id:              card.id,
            user_id:         this.user.id,
            sentence:        card.sentence       || '',
            target_word:     card.targetWord     || '',
            word_type:       card.wordType       || 'other',
            meaning:         card.meaning        || '',
            meaning_lang:    card.meaningLang    || 'tr',
            explanation:     card.explanation    || '',
            extra_example:   card.extraExample   || '',
            notes:           card.notes          || '',
            tags:            card.tags           || [],
            difficulty:      card.difficulty     || 'normal',
            interval:        card.interval       || 1,
            ease_factor:     card.easeFactor     || 2.5,
            repetitions:     card.repetitions    || 0,
            due_date:        card.dueDate,
            last_reviewed_at: card.lastReviewedAt || null,
            review_count:    card.reviewCount    || 0,
            created_at:      card.createdAt      || new Date().toISOString(),
        };
    },

    _fromRow(r) {
        return {
            id:             r.id,
            sentence:       r.sentence,
            targetWord:     r.target_word,
            wordType:       r.word_type,
            meaning:        r.meaning,
            meaningLang:    r.meaning_lang    || 'tr',
            explanation:    r.explanation,
            extraExample:   r.extra_example,
            notes:          r.notes,
            tags:           Array.isArray(r.tags) ? r.tags : [],
            difficulty:     r.difficulty,
            interval:       r.interval,
            easeFactor:     parseFloat(r.ease_factor),
            repetitions:    r.repetitions,
            dueDate:        r.due_date,
            lastReviewedAt: r.last_reviewed_at,
            reviewCount:    r.review_count,
            createdAt:      r.created_at,
        };
    },
};
