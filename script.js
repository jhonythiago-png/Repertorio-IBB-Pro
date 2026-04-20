// Configurações Supabase
const SUPABASE_URL = "https://rxcfnwhgkdauzyuekjxf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y2Zud2hna2RhdXp5dWVranhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTAyODAsImV4cCI6MjA5MjIyNjI4MH0.QewcMlTw0L6gXkz-WXwQvSu-vZXtO3vR48X2a_-FH9g";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Controle de Acesso de Líderes ───────────────────────────────────
const TEAM_PASSWORDS = {
    'ibbadm': 'Master', 
    'start123': 'Start',
    'amarelo123': 'Amarelo',
    'laranja123': 'Laranja',
    'azul123': 'Azul',
    'verde123': 'Verde',
    'branco123': 'Branco'
};

const AUTH_KEY = 'ibb_leader_auth';
const TEAM_KEY = 'ibb_leader_team';

function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function getLoggedTeam() {
    return sessionStorage.getItem(TEAM_KEY) || 'Master';
}

const pwGateModal  = document.getElementById('passwordGateModal');
const pwInput      = document.getElementById('leaderPasswordInput');
const pwError      = document.getElementById('passwordError');
const pwSubmitBtn  = document.getElementById('submitPasswordBtn');
const closePwModal = document.querySelector('.close-password-modal');

if (closePwModal) closePwModal.onclick = () => {
    pwGateModal.style.display = 'none';
    pwInput.value = '';
    pwError.style.display = 'none';
};

// Ativa/desativa modo ADM na interface
function setAdminMode(active, teamName) {
    const admBtnEl  = document.getElementById('admBtn');
    const addNavItem = document.getElementById('addSongNavItem');
    const editBtn   = document.getElementById('editUrlBtn');
    const editorPanel = document.getElementById('urlEditorPanel');
    const addToSetlistBtn = document.getElementById('addToSetlistBtn');
    const teamAdminActions = document.getElementById('teamAdminActions');
    const teamAdminStatus = document.getElementById('teamAdminStatus');

    if (active) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        if (teamName) sessionStorage.setItem(TEAM_KEY, teamName);
        const loggedTeam = getLoggedTeam();
        
        if (admBtnEl) {
            admBtnEl.innerHTML = `<i class="fas fa-unlock"></i> ${loggedTeam}`;
            admBtnEl.classList.add('active');
        }
        if (addNavItem) addNavItem.style.display = 'list-item';
        if (editBtn)   editBtn.style.display = 'flex';
        if (addToSetlistBtn) addToSetlistBtn.style.display = 'flex';
        
        const setlistTeamSelect = document.getElementById('setlistTeamSelect');
        if (setlistTeamSelect) {
            setlistTeamSelect.innerHTML = '';
            if (loggedTeam === 'Master') { // Master
                ['Start', 'Amarelo', 'Laranja', 'Azul', 'Verde', 'Branco'].forEach(t => {
                    setlistTeamSelect.innerHTML += `<option value="${t}">${t}</option>`;
                });
            } else {
                setlistTeamSelect.innerHTML = `<option value="${loggedTeam}" selected>${loggedTeam}</option>`;
            }
        }
    } else {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TEAM_KEY);
        if (admBtnEl) {
            admBtnEl.innerHTML = '<i class="fas fa-lock"></i> ADM';
            admBtnEl.classList.remove('active');
        }
        if (addNavItem) addNavItem.style.display = 'none';
        if (editBtn)   editBtn.style.display = 'none';
        if (addToSetlistBtn) addToSetlistBtn.style.display = 'none';
        if (editorPanel) editorPanel.style.display = 'none';
        
        const setlistPanel = document.getElementById('setlistEditorPanel');
        if (setlistPanel) setlistPanel.style.display = 'none';
        if (teamAdminActions) teamAdminActions.style.display = 'none';
        if (teamAdminStatus) teamAdminStatus.style.display = 'none';
    }
}

// Inicializa estado ADM ao carregar
function initAdminState() {
    setAdminMode(isAuthenticated(), sessionStorage.getItem(TEAM_KEY));
}

// Botão ADM no menu
const admBtn = document.getElementById('admBtn');
if (admBtn) {
    admBtn.onclick = () => {
        if (isAuthenticated()) {
            if (confirm('Sair do modo de liderança?')) {
                setAdminMode(false);
            }
            return;
        }
        pwGateModal.style.display = 'block';
        pwInput.value = '';
        pwError.style.display = 'none';
        setTimeout(() => pwInput.focus(), 100);

        const handleSubmit = async () => {
            const pwd = pwInput.value.trim().toLowerCase();
            if (TEAM_PASSWORDS[pwd]) {
                pwGateModal.style.display = 'none';
                pwError.style.display = 'none';
                setAdminMode(true, TEAM_PASSWORDS[pwd]);
                
                // Refresh atual visualização se tiver na aba de equipes
                const currentTeamSelect = document.getElementById('teamSelector');
                if (currentTeamSelect && document.getElementById('teamsContainer').style.display !== 'none') {
                    currentTeamSelect.dispatchEvent(new Event('change'));
                }
                
                pwSubmitBtn.removeEventListener('click', handleSubmit);
                pwInput.removeEventListener('keydown', handleKey);
            } else {
                pwError.style.display = 'block';
                pwInput.value = '';
                pwInput.focus();
            }
        };

        const handleKey = (e) => { if (e.key === 'Enter') handleSubmit(); };
        pwSubmitBtn.addEventListener('click', handleSubmit);
        pwInput.addEventListener('keydown', handleKey);
    };
}
// ─────────────────────────────────────────────────────────────────────

let repertoireData = [];
const categoriesContainer = document.getElementById('categoriesContainer');
const searchResultsGrid = document.getElementById('searchResults');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('videoModal');
const closeModal = document.querySelector('.close-modal');
const videoIframe = document.getElementById('videoIframe');
const header = document.getElementById('header');
const categoryOverlay = document.getElementById('categoryOverlay');
const categoryList = document.getElementById('categoryList');

// ─── MODO LOUVOR STATE ───────────────────────────────────────────────────
const praiseState = {
    song: null,
    mode: 'vocal',       // 'vocal' | 'musician'
    semitones: 0,
    capo: 0,
    fontSize: 20,
    scrolling: false,
    scrollRaf: null,
    scrollSpeed: 3,
    headerVisible: true
};

// Escala cromática (preferência por sustenidos)
const CHROMATIC_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHROMATIC_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function transposeNote(note, steps) {
    let idx = CHROMATIC_SHARP.indexOf(note);
    if (idx === -1) idx = CHROMATIC_FLAT.indexOf(note);
    if (idx === -1) return note;
    return CHROMATIC_SHARP[((idx + steps) % 12 + 12) % 12];
}

function transposeChordSymbol(chord, steps) {
    if (steps === 0) return chord;
    // Match a nota raiz [A-G][#b]? seguida de sufixo (m, 7, maj, dim, aug, sus...)
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;
    return transposeNote(match[1], steps) + match[2];
}

function transposeCifraText(text, steps) {
    if (steps === 0) return text;
    return text.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) =>
        '[' + transposeChordSymbol(chord, steps) + ']'
    );
}

function cifraTextToHtml(text) {
    // Escapa HTML e destaca acordes [ACORDE] em amber
    const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc.replace(/\[([^\]]+)\]/g, '<span class="praise-chord">$1</span>');
}

// ─── Fetch da Cifra Club via CORS Proxy ───────────────────────────────
async function fetchCifraFromCifraClub(url) {
    const cleanUrl = url.split('#')[0].split('?')[0].replace(/\/$/, '') + '/';
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error('Proxy indisponível (status ' + resp.status + ')');
    const json = await resp.json();
    if (!json.contents) throw new Error('Nenhum conteúdo retornado pelo proxy');
    return parseCifraClubHtml(json.contents);
}

function parseCifraClubHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Seletores possíveis para o bloco de cifra
    const selectors = [
        '#cifra_input pre', '.g-song-media pre',
        '.cifra_cnt pre', '.cifra-print pre', 'pre'
    ];
    for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (!el) continue;
        const clone = el.cloneNode(true);
        // Converte <b>ACORDE</b> para [ACORDE]
        clone.querySelectorAll('b').forEach(b => {
            const txt = b.textContent.trim();
            if (/^[A-G]/.test(txt)) b.replaceWith(`[${txt}]`);
            else b.replaceWith(txt);
        });
        const result = clone.textContent || '';
        if (result.includes('[') && result.length > 100) return result;
    }
    return null;
}

// ─── Abertura / Fechamento do Modo Louvor ──────────────────────────────
function openPraiseMode(song, mode = 'vocal') {
    praiseState.song = song;
    praiseState.mode = mode;
    praiseState.semitones = 0;
    praiseState.capo = 0;
    praiseState.headerVisible = true;
    stopPraiseScroll();

    // Info da música
    document.getElementById('praiseSongTitle').textContent = song.title || '';
    document.getElementById('praiseSongArtist').textContent = song.artist || 'Vários';

    // Fonte inicial
    praiseState.fontSize = mode === 'vocal' ? 20 : 16;
    document.getElementById('praiseFontSize').textContent = praiseState.fontSize;

    // Toggle modo
    document.getElementById('praiseModeVocalBtn').classList.toggle('active', mode === 'vocal');
    document.getElementById('praiseModeMusBtn').classList.toggle('active', mode === 'musician');
    document.getElementById('praiseMusiciansControls').style.display = mode === 'musician' ? 'flex' : 'none';

    // Resetar transpose / capo
    document.getElementById('praiseTransposeValue').textContent = '0';
    document.getElementById('praiseCapoSelect').value = '0';

    // Header visível
    const hdr = document.getElementById('praiseHeader');
    hdr.classList.remove('hidden');
    document.getElementById('praiseToggleHeader').innerHTML = '<i class="fas fa-sliders-h"></i>';

    // Abrir modal
    document.getElementById('praiseModeModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    renderPraiseContent();
}

function closePraiseMode() {
    stopPraiseScroll();
    document.getElementById('praiseModeModal').classList.remove('active');
    document.body.style.overflow = '';
}

function renderPraiseContent() {
    const { song, mode, semitones, capo, fontSize } = praiseState;
    const contentEl = document.getElementById('praiseModeContent');

    if (mode === 'vocal') {
        const lyrics = song.lyrics || '';
        if (!lyrics.trim()) {
            contentEl.innerHTML = `
                <div class="praise-no-cifra">
                    <i class="fas fa-microphone-slash"></i>
                    <p>Letra não cadastrada para esta música.</p>
                    <p style="font-size:0.82rem;color:#444;margin-top:8px;">Um ADM pode adicionar a letra nas configurações da música.</p>
                </div>`;
            return;
        }
        const esc = lyrics.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        contentEl.innerHTML = `<div class="praise-lyrics" style="font-size:${fontSize}px">${esc.replace(/\n/g,'<br>')}</div>`;
    } else {
        const cifraText = song.cifra_text;
        if (!cifraText || !cifraText.trim()) {
            contentEl.innerHTML = `
                <div class="praise-no-cifra">
                    <i class="fas fa-guitar"></i>
                    <p>Cifra não cadastrada para esta música.</p>
                    <p style="font-size:0.82rem;color:#444;margin-top:8px;">Um ADM pode adicionar o link do Cifra Club nas edições da música.</p>
                </div>`;
            return;
        }
        // Transposição: semitones escolhidos pelo usuário, menos capo para facilitar o músico
        const effectiveSemitones = semitones - capo;
        const transposed = transposeCifraText(cifraText, effectiveSemitones);
        const html = cifraTextToHtml(transposed);
        contentEl.innerHTML = `<div class="praise-cifra" style="font-size:${fontSize}px">${html}</div>`;
    }
    contentEl.scrollTop = 0;
}

// ─── Auto-scroll ────────────────────────────────────────────────────────
function startPraiseScroll() {
    stopPraiseScroll();
    praiseState.scrolling = true;
    const btn = document.getElementById('praiseScrollToggle');
    btn.classList.add('active');
    btn.innerHTML = '<i class="fas fa-pause"></i> Rolando...';
    const contentEl = document.getElementById('praiseModeContent');
    let lastTime = null;
    function step(ts) {
        if (!praiseState.scrolling) return;
        if (lastTime === null) lastTime = ts;
        const delta = ts - lastTime;
        lastTime = ts;
        contentEl.scrollTop += (praiseState.scrollSpeed * delta) / 1000 * 10;
        praiseState.scrollRaf = requestAnimationFrame(step);
    }
    praiseState.scrollRaf = requestAnimationFrame(step);
}

function stopPraiseScroll() {
    praiseState.scrolling = false;
    if (praiseState.scrollRaf) { cancelAnimationFrame(praiseState.scrollRaf); praiseState.scrollRaf = null; }
    const btn = document.getElementById('praiseScrollToggle');
    if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fas fa-play"></i> Auto-scroll'; }
}

// ─── Bind de todos os controles do Modo Louvor (chamado após DOM pronto) ───
function setupPraiseModeControls() {
    document.getElementById('praiseModeClose').onclick = closePraiseMode;

    // Toggle Vocal / Músico
    document.getElementById('praiseModeVocalBtn').onclick = () => {
        praiseState.mode = 'vocal';
        praiseState.fontSize = 20;
        document.getElementById('praiseFontSize').textContent = praiseState.fontSize;
        document.getElementById('praiseModeVocalBtn').classList.add('active');
        document.getElementById('praiseModeMusBtn').classList.remove('active');
        document.getElementById('praiseMusiciansControls').style.display = 'none';
        renderPraiseContent();
    };
    document.getElementById('praiseModeMusBtn').onclick = () => {
        praiseState.mode = 'musician';
        praiseState.fontSize = 16;
        document.getElementById('praiseFontSize').textContent = praiseState.fontSize;
        document.getElementById('praiseModeMusBtn').classList.add('active');
        document.getElementById('praiseModeVocalBtn').classList.remove('active');
        document.getElementById('praiseMusiciansControls').style.display = 'flex';
        renderPraiseContent();
    };

    // Fonte
    document.getElementById('praiseFontDec').onclick = () => {
        if (praiseState.fontSize > 10) {
            praiseState.fontSize -= 2;
            document.getElementById('praiseFontSize').textContent = praiseState.fontSize;
            const el = document.querySelector('#praiseModeContent .praise-lyrics, #praiseModeContent .praise-cifra');
            if (el) el.style.fontSize = praiseState.fontSize + 'px';
        }
    };
    document.getElementById('praiseFontInc').onclick = () => {
        if (praiseState.fontSize < 60) {
            praiseState.fontSize += 2;
            document.getElementById('praiseFontSize').textContent = praiseState.fontSize;
            const el = document.querySelector('#praiseModeContent .praise-lyrics, #praiseModeContent .praise-cifra');
            if (el) el.style.fontSize = praiseState.fontSize + 'px';
        }
    };

    // Transposição
    document.getElementById('praiseTransposeDown').onclick = () => {
        praiseState.semitones--;
        document.getElementById('praiseTransposeValue').textContent =
            praiseState.semitones === 0 ? '0' : (praiseState.semitones > 0 ? '+' + praiseState.semitones : praiseState.semitones);
        renderPraiseContent();
    };
    document.getElementById('praiseTransposeUp').onclick = () => {
        praiseState.semitones++;
        document.getElementById('praiseTransposeValue').textContent =
            praiseState.semitones === 0 ? '0' : (praiseState.semitones > 0 ? '+' + praiseState.semitones : praiseState.semitones);
        renderPraiseContent();
    };

    // Capo
    document.getElementById('praiseCapoSelect').onchange = (e) => {
        praiseState.capo = parseInt(e.target.value);
        renderPraiseContent();
    };

    // Auto-scroll
    document.getElementById('praiseScrollToggle').onclick = () => {
        praiseState.scrolling ? stopPraiseScroll() : startPraiseScroll();
    };
    document.getElementById('praiseScrollSpeed').oninput = (e) => {
        praiseState.scrollSpeed = parseInt(e.target.value);
    };

    // Toggle header
    document.getElementById('praiseToggleHeader').onclick = () => {
        praiseState.headerVisible = !praiseState.headerVisible;
        document.getElementById('praiseHeader').classList.toggle('hidden', !praiseState.headerVisible);
        document.getElementById('praiseToggleHeader').innerHTML =
            praiseState.headerVisible ? '<i class="fas fa-sliders-h"></i>' : '<i class="fas fa-sliders-h" style="opacity:0.4"></i>';
    };

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('praiseModeModal').classList.contains('active')) {
            closePraiseMode();
        }
    });
}
// Inicializa os controles imediatamente
setupPraiseModeControls();
// ─────────────────────────────────────────────────────────────────────────

// Categorias Fixas e Ordem Desejada
const FIXED_CATEGORIES = [
    "Novos",
    "Convite", 
    "Celebração/Adoração/Louvor", 
    "Consagração", 
    "Busca", 
    "Contemplação/Adoração e Louvor", 
    "Ceia", 
    "Comunhão", 
    "Fé", 
    "Clássicas"
];

let ALL_CATEGORIES = [...FIXED_CATEGORIES];

// Carregar dados do Supabase
async function fetchData() {
    try {
        const { data, error } = await _supabase
            .from('songs')
            .select('*')
            .neq('status', 'DELETED')
            .order('title', { ascending: true });

        if (error) throw error;

        ALL_CATEGORIES = [...FIXED_CATEGORIES];
        const grouped = {};

        data.forEach(song => {
            if (song.categories && Array.isArray(song.categories)) {
                song.categories.forEach(cat => {
                    if (!ALL_CATEGORIES.includes(cat)) {
                        ALL_CATEGORIES.push(cat);
                    }
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(song);
                });
            }
        });

        // Ordenar mantendo a prioridade das FIXAS e depois as DINAMICAS
        const sortedGrouped = {};
        ALL_CATEGORIES.forEach(cat => {
            if (grouped[cat]) sortedGrouped[cat] = grouped[cat];
        });

        // Montar estrutura final apenas com categorias que têm músicas
        repertoireData = Object.keys(sortedGrouped)
            .filter(name => sortedGrouped[name].length > 0)
            .map(name => ({
                category: name,
                items: sortedGrouped[name]
            }));

        renderRepertoire(repertoireData);
        populateCategoryMenu();
        updateFooter();
        initAdminState(); // Respeita estado de auth entre navegações
    } catch (error) {
        console.error("Erro ao carregar dados do Supabase:", error);
        // Fallback para JSON local se o banco falhar (opcional)
    }
}

// Extrair Thumbnail
function getYouTubeThumbnail(song, quality = 'hqdefault') {
    if (song.vid_id) {
        return `https://img.youtube.com/vi/${song.vid_id}/${quality}.jpg`;
    }
    const url = song.url;
    if (!url) return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=600&auto=format&fit=crop';
    
    const idMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
    if (idMatch && !url.includes('listType=search')) {
        return `https://img.youtube.com/vi/${idMatch[1]}/${quality}.jpg`;
    }
    return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=600&auto=format&fit=crop';
}

function renderRepertoire(data) {
    categoriesContainer.innerHTML = '';
    categoriesContainer.style.display = 'block';
    searchResultsGrid.style.display = 'none';
    categoryOverlay.style.display = 'none';

    data.forEach(category => {
        if (category.items.length === 0) return;
        
        const row = document.createElement('div');
        row.className = 'category-row';
        row.innerHTML = `<h2>${category.category}</h2>`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'row-wrapper';
        
        const container = document.createElement('div');
        container.className = 'row-container';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn prev-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => container.scrollBy({ left: -600, behavior: 'smooth' });
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn next-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => container.scrollBy({ left: 600, behavior: 'smooth' });
        
        category.items.forEach(song => {
            container.appendChild(createSongCard(song));
        });
        
        wrapper.appendChild(prevBtn);
        wrapper.appendChild(container);
        wrapper.appendChild(nextBtn);
        row.appendChild(wrapper);
        categoriesContainer.appendChild(row);
    });
}

function createSongCard(song) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
        <img src="${getYouTubeThumbnail(song)}" alt="${song.title}" loading="lazy">
        <div class="card-info">
            <h4>${song.title}</h4>
            <p>${song.artist || 'Vários'} ${song.status ? '• ' + song.status : ''}</p>
        </div>
    `;
    card.onclick = () => openVideo(song);
    return card;
}

function renderGrid(songs, title) {
    categoriesContainer.style.display = 'none';
    searchResultsGrid.innerHTML = `
        <div style="grid-column: 1/-1; margin-bottom: 20px;">
            <h2>${title}</h2>
        </div>
    `;
    searchResultsGrid.style.display = 'grid';
    document.getElementById('hero').style.display = 'none';
    categoryOverlay.style.display = 'none';

    songs.forEach(song => {
        searchResultsGrid.appendChild(createSongCard(song));
    });
}

// Preencher Menu de Categorias e Checkboxes
function populateCategoryMenu() {
    categoryList.innerHTML = '';
    const checkboxGrid = document.getElementById('categoryCheckboxes');
    if (checkboxGrid) checkboxGrid.innerHTML = '';

    ALL_CATEGORIES.forEach(catName => {
        // Menu Overlay
        const item = document.createElement('div');
        item.className = 'category-item';
        item.textContent = catName;
        item.onclick = () => {
            const songs = repertoireData.find(c => c.category === catName)?.items || [];
            renderGrid(songs, catName);
            categoryOverlay.style.display = 'none';
        };
        categoryList.appendChild(item);

        // Cadastro Modal
        if (checkboxGrid) {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `<input type="checkbox" name="category" value="${catName}"> ${catName}`;
            checkboxGrid.appendChild(label);
        }
    });
}

// Abrir Vídeo
function openVideo(song) {
    document.getElementById('modalTitle').textContent = song.title;
    document.getElementById('modalArtist').textContent = song.artist || 'Vários';
    document.getElementById('modalObs').textContent = song.obs ? `Obs: ${song.obs}` : '';
    videoIframe.src = song.url || '';
    modal.style.display = 'block';

    // Resetar painel de edição
    const urlEditorPanel = document.getElementById('urlEditorPanel');
    const newUrlInput    = document.getElementById('newUrlInput');
    const newArtistInput = document.getElementById('newArtistInput');
    const newTitleInput  = document.getElementById('newTitleInput');
    urlEditorPanel.style.display = 'none';
    newUrlInput.value    = song.url    || '';
    newArtistInput.value = song.artist || '';
    newTitleInput.value  = song.title  || '';
    const newObsInput = document.getElementById('newObsInput');
    if (newObsInput) newObsInput.value = song.obs || '';

    // Letra e Cifra Club
    const newLyricsInput = document.getElementById('newLyricsInput');
    if (newLyricsInput) newLyricsInput.value = song.lyrics || '';
    const newCifraUrlInput = document.getElementById('newCifraUrlInput');
    if (newCifraUrlInput) newCifraUrlInput.value = song.cifraclub_url || '';
    const cifraStatus = document.getElementById('cifraStatus');
    if (cifraStatus) cifraStatus.textContent = song.cifra_text ? '✅ Cifra disponível nesta música.' : '⚠️ Nenhuma cifra cadastrada ainda.';

    // Resetar zona de exclusão
    const deleteConfirmStep = document.getElementById('deleteConfirmStep');
    if (deleteConfirmStep) deleteConfirmStep.style.display = 'none';

    // ── Preencher checkboxes de categorias ──────────────────────────────────
const editCatGrid = document.getElementById('editCategoryCheckboxes');
    if (editCatGrid) {
        editCatGrid.innerHTML = '';
        ALL_CATEGORIES.forEach(cat => {
            const checked = (song.categories || []).includes(cat) ? 'checked' : '';
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" name="editCat" value="${cat}" ${checked}> ${cat}`;
            editCatGrid.appendChild(label);
        });
    }

    // ── Botão Editar Versão (toggle painel) ─────────────────────────────────
    const editBtn = document.getElementById('editUrlBtn');
    editBtn.onclick = () => {
        const isVisible = urlEditorPanel.style.display !== 'none';
        urlEditorPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) newUrlInput.focus();
    };

    // ── Fechar painel ────────────────────────────────────────────────
    document.getElementById('cancelUrlBtn').onclick = () => {
        urlEditorPanel.style.display = 'none';
    };

    // ── Salvar URL ─────────────────────────────────────────────────────
    document.getElementById('saveUrlBtn').onclick = async () => {
        const newUrl = newUrlInput.value.trim();
        if (!newUrl) { alert('Cole uma URL válida!'); return; }

        const idMatch = newUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
        const newVidId = idMatch ? idMatch[1] : null;
        const finalUrl = newVidId ? `https://www.youtube.com/embed/${newVidId}` : newUrl;

        const btn = document.getElementById('saveUrlBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ url: finalUrl, vid_id: newVidId })
                .eq('title', song.title);
            if (error) throw error;
            videoIframe.src = finalUrl;
            song.url = finalUrl;
            song.vid_id = newVidId;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar URL';
            alert('✅ URL atualizada!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar URL';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Nome do Louvor ─────────────────────────────────────────────
    document.getElementById('saveTitleBtn').onclick = async () => {
        const newTitle = newTitleInput.value.trim();
        if (!newTitle) { alert('Digite o nome do louvor!'); return; }
        if (newTitle === song.title) { alert('O nome não foi alterado.'); return; }

        const btn = document.getElementById('saveTitleBtn');
        btn.textContent = 'Salvando...';
        try {
            const filter = song.id ? _supabase.from('songs').update({ title: newTitle }).eq('id', song.id)
                                   : _supabase.from('songs').update({ title: newTitle }).eq('title', song.title);
            const { error } = await filter;
            if (error) throw error;
            song.title = newTitle;
            document.getElementById('modalTitle').textContent = newTitle;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Nome';
            alert('✅ Nome do louvor atualizado!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Nome';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Artista ──────────────────────────────────────────────────
    document.getElementById('saveArtistBtn').onclick = async () => {
        const newArtist = newArtistInput.value.trim();
        if (!newArtist) { alert('Digite o nome do artista!'); return; }

        const btn = document.getElementById('saveArtistBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ artist: newArtist })
                .eq('title', song.title);
            if (error) throw error;
            song.artist = newArtist;
            document.getElementById('modalArtist').textContent = newArtist;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Artista';
            alert('✅ Artista atualizado!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Artista';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Observações ────────────────────────────────────────────────
    document.getElementById('saveObsBtn').onclick = async () => {
        const newObsInput = document.getElementById('newObsInput');
        const newObs = newObsInput ? newObsInput.value.trim() : '';
        const btn = document.getElementById('saveObsBtn');
        btn.textContent = 'Salvando...';
        try {
            const filter = song.id ? _supabase.from('songs').update({ obs: newObs }).eq('id', song.id)
                                   : _supabase.from('songs').update({ obs: newObs }).eq('title', song.title);
            const { error } = await filter;
            if (error) throw error;
            song.obs = newObs;
            document.getElementById('modalObs').textContent = newObs ? `Obs: ${newObs}` : '';
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Obs';
            alert('✅ Observação atualizada!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Obs';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Letra ─────────────────────────────────────────────────────
    document.getElementById('saveLyricsBtn').onclick = async () => {
        const lyricsInput = document.getElementById('newLyricsInput');
        const lyrics = lyricsInput ? lyricsInput.value.trim() : '';
        const btn = document.getElementById('saveLyricsBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ lyrics })
                .eq('id', song.id);
            if (error) throw error;
            song.lyrics = lyrics;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Letra';
            alert('✅ Letra salva!');
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Letra';
            alert('Erro: ' + err.message);
        }
    };

    // ── Salvar Cifra Club URL + Buscar ─────────────────────────────────────
    document.getElementById('saveCifraBtn').onclick = async () => {
        const cifraUrlInput = document.getElementById('newCifraUrlInput');
        const cifraUrl = cifraUrlInput ? cifraUrlInput.value.trim() : '';
        const cifraStatusEl = document.getElementById('cifraStatus');
        const btn = document.getElementById('saveCifraBtn');
        if (!cifraUrl) { alert('Cole a URL do Cifra Club!'); return; }
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando cifra...';
        if (cifraStatusEl) cifraStatusEl.textContent = '🔄 Tentando buscar no Cifra Club...';
        try {
            // Salva URL
            await _supabase.from('songs').update({ cifraclub_url: cifraUrl }).eq('id', song.id);
            song.cifraclub_url = cifraUrl;
            // Tenta buscar a cifra
            const cifraText = await fetchCifraFromCifraClub(cifraUrl);
            if (cifraText) {
                await _supabase.from('songs').update({ cifra_text: cifraText }).eq('id', song.id);
                song.cifra_text = cifraText;
                if (cifraStatusEl) cifraStatusEl.textContent = '✅ Cifra buscada e salva com sucesso!';
                alert('✅ Cifra do Cifra Club salva!');
            } else {
                if (cifraStatusEl) cifraStatusEl.textContent = '⚠️ URL salva, mas a cifra não pôde ser extraída automaticamente. Tente novamente mais tarde.';
            }
        } catch (err) {
            if (cifraStatusEl) cifraStatusEl.textContent = '❌ Erro: ' + err.message;
            alert('Erro ao buscar cifra: ' + err.message);
        }
        btn.innerHTML = '<i class="fas fa-download"></i> Salvar e Buscar Cifra';
    };

    // ── Salvar Categorias ────────────────────────────────────────────────
    document.getElementById('saveCategoriesBtn').onclick = async () => {
        const selected = Array.from(
            document.querySelectorAll('input[name="editCat"]:checked')
        ).map(cb => cb.value);

        if (selected.length === 0) {
            alert('Selecione pelo menos uma categoria!');
            return;
        }

        const btn = document.getElementById('saveCategoriesBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ categories: selected })
                .eq('title', song.title);
            if (error) throw error;
            song.categories = selected;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Categorias';
            alert('✅ Categorias atualizadas!');
            fetchData();
        } catch (err) {
  }
��──
    document.getElementById('saveCategoriesBtn').onclick = async () => {
        const selected = Array.from(
            document.querySelectorAll('input[name="editCat"]:checked')
        ).map(cb => cb.value);

        if (selected.length === 0) {
            alert('Selecione pelo menos uma categoria!');
            return;
        }

        const btn = document.getElementById('saveCategoriesBtn');
        btn.textContent = 'Salvando...';
        try {
            const { error } = await _supabase.from('songs')
                .update({ categories: selected })
                .eq('title', song.title);
            if (error) throw error;
            song.categories = selected;
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Categorias';
            alert('✅ Categorias atualizadas!');
            fetchData();
        } catch (err) {
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Categorias';
            alert('Erro: ' + err.message);
        }
    };

    // ── Excluir Música (2 etapas) ────────────────────────────────────────
    document.getElementById('deleteSongBtn').onclick = () => {
        deleteConfirmStep.style.display = 'block';
    };

    document.getElementById('cancelDeleteBtn').onclick = () => {
        deleteConfirmStep.style.display = 'none';
    };

    document.getElementById('confirmDeleteBtn').onclick = async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        const oldText = btn.innerHTML;
        btn.textContent = 'Excluindo...';
        
        console.log('Arquivando música (Soft Delete):', { id: song.id, title: song.title });

        try {
            // Soft delete: Apenas marca como DELETED para o sincronizador respeitar a exclusão
            const { data, error } = await _supabase.from('songs')
                .update({ status: 'DELETED' })
                .eq('id', song.id)
                .select();
            
            if (error) {
                console.error('Erro ao arquivar música:', error);
                throw error;
            }

            console.log('Música arquivada:', data);

            modal.style.display = 'none';
            videoIframe.src = '';
            alert(`✅ "${song.title}" foi removido do repertório.`);
            
            // Força a recarga total dos dados
            setTimeout(async () => {
                await fetchData();
            }, 300);
            
        } catch (err) {
            console.error('Erro fatal na exclusão:', err);
            btn.innerHTML = oldText;
            alert('Erro ao excluir: ' + err.message);
        }
    };
}

// Cadastro de Música
const addSongModal = document.getElementById('addSongModal');
const addSongBtn = document.getElementById('addSongBtn');
const closeAddModal = document.querySelector('.close-add-modal');
const addSongForm = document.getElementById('addSongForm');

if (addSongBtn) {
    addSongBtn.onclick = () => {
        addSongModal.style.display = 'block';
    };
}

if (closeAddModal) {
    closeAddModal.onclick = () => {
        addSongModal.style.display = 'none';
    };
}

if (addSongForm) {
    addSongForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('addTitle').value;
        const artist = document.getElementById('addArtist').value;
        const addObsInput = document.getElementById('addObs');
        const obs = addObsInput ? addObsInput.value.trim() : null;
        const url = document.getElementById('addUrl').value;
        const addCifraUrlInput = document.getElementById('addCifraUrl');
        const cifraUrl = addCifraUrlInput ? addCifraUrlInput.value.trim() : null;
        const addLyricsInput = document.getElementById('addLyrics');
        const lyrics = addLyricsInput ? addLyricsInput.value.trim() : null;
        const checkedCats = Array.from(document.querySelectorAll('input[name="category"]:checked')).map(cb => cb.value);

        if (checkedCats.length === 0) {
            alert("Selecione pelo menos uma categoria!");
            return;
        }

        const idMatch = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
        const vidId = idMatch ? idMatch[1] : null;

        try {
            const trimmedTitle = title.trim();
            const trimmedArtist = artist.trim();
            const { error } = await _supabase
                .from('songs')
                .upsert({ 
                    title: trimmedTitle, 
                    artist: trimmedArtist, 
                    obs,
                    lyrics: lyrics || null,
                    cifraclub_url: cifraUrl || null,
                    url: url ? `https://www.youtube.com/embed/${vidId}` : null, 
                    vid_id: vidId, 
                    categories: checkedCats,
                    status: checkedCats.includes('Novos') ? 'NOVA' : ''
                }, { onConflict: 'title' });

            if (error) throw error;

            // Tenta buscar cifra automaticamente se tiver URL
            if (cifraUrl) {
                try {
                    const cifraText = await fetchCifraFromCifraClub(cifraUrl);
                    if (cifraText) {
                        await _supabase.from('songs').update({ cifra_text: cifraText }).eq('title', trimmedTitle);
                    }
                } catch (ce) {
                    console.warn('Auto-fetch da cifra falhou (pode tentar depois no edit):', ce);
                }
            }

            alert("Louvor cadastrado!");
            addSongModal.style.display = 'none';
            addSongForm.reset();
            fetchData();
        } catch (err) {
            alert("Erro ao cadastrar: " + err.message);
        }
    };
}

// Menu Mobile
const menuToggle = document.getElementById('menuToggle');
const navbar = document.getElementById('navbar');

if (menuToggle) {
    menuToggle.onclick = () => {
        navbar.classList.toggle('active');
    };
}

// Fechar menu mobile ao clicar em qualquer opção
document.querySelectorAll('#navbar a, #navbar button').forEach(item => {
    item.addEventListener('click', () => {
        navbar.classList.remove('active');
    });
});

// Search Logic
searchInput.oninput = (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term === "") {
        resetView();
        return;
    }
    const allSongs = repertoireData.flatMap(cat => cat.items);
    
    // Lista de termos para bloqueio agressivo de duplicatas
    const blockList = ['ao vivo', '( ao vivo )', '(ao vivo)'];

    // Garantir unicidade total por título (trim para evitar espaços diferentes)
    const uniqueSongsMap = new Map();
    allSongs.forEach(s => {
        const titleLower = s.title.toLowerCase().trim();
        const artistLower = (s.artist || '').toLowerCase().trim();
        
        // Se estiver na blocklist e já houver uma versão limpa, ou for apenas indesejada, pula
        const isBlacklisted = blockList.some(term => titleLower.includes(term) || artistLower.includes(term));
        if (isBlacklisted) return;

        if (!uniqueSongsMap.has(titleLower)) {
            uniqueSongsMap.set(titleLower, s);
        }
    });
    const uniqueSongs = Array.from(uniqueSongsMap.values());

    const filtered = uniqueSongs.filter(song => 
        song.status !== 'DELETED' && (
            song.title.toLowerCase().includes(term) || 
            (song.artist && song.artist.toLowerCase().includes(term))
        )
    );
    renderGrid(filtered, `Resultados para: "${term}"`);
};

function resetView() {
    renderRepertoire(repertoireData);
    document.getElementById('hero').style.display = 'flex';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('homeNav').classList.add('active');
    searchInput.value = '';
    categoryOverlay.style.display = 'none';
    const teamsCont = document.getElementById('teamsContainer');
    if(teamsCont) teamsCont.style.display = 'none';
}

function updateFooter() {
    const footer = document.querySelector('footer');
    if (footer) {
        footer.innerHTML = `<p class="footer-dev">Desenvolvido por Jhony Beraldo</p>`;
    }
}

// Nav Listeners
document.getElementById('homeNav').onclick = (e) => { e.preventDefault(); resetView(); };
document.getElementById('categoriesNav').onclick = (e) => {
    e.preventDefault();
    categoryOverlay.style.display = 'block';
    document.getElementById('hero').style.display = 'none';
    categoriesContainer.style.display = 'none';
    searchResultsGrid.style.display = 'none';
    const teamsCont = document.getElementById('teamsContainer');
    if(teamsCont) teamsCont.style.display = 'none';
};
document.getElementById('newNav').onclick = (e) => {
    e.preventDefault();
    const teamsCont = document.getElementById('teamsContainer');
    if(teamsCont) teamsCont.style.display = 'none';
    const songs = repertoireData.find(c => c.category === "Novos")?.items || [];
    renderGrid(songs, "Novos Lançamentos");
};

// --- Setlist Logic ---

function applyTeamColorToSelector(teamName) {
    const TS = document.getElementById('teamSelector');
    if (!TS) return;
    
    // Remover classes de cores anteriores
    TS.classList.remove('team-selected-Start', 'team-selected-Amarelo', 'team-selected-Laranja', 'team-selected-Azul', 'team-selected-Verde', 'team-selected-Branco');
    
    // Adiciona classe de cor para o atual, se houver
    if (teamName) {
        TS.classList.add('team-selected-' + teamName);
    }
}

document.getElementById('teamsNav').onclick = (e) => {
    e.preventDefault();
    document.getElementById('hero').style.display = 'none';
    categoriesContainer.style.display = 'none';
    searchResultsGrid.style.display = 'none';
    categoryOverlay.style.display = 'none';
    document.getElementById('teamsContainer').style.display = 'block';
    
    const activeTeam = sessionStorage.getItem(TEAM_KEY);
    const TS = document.getElementById('teamSelector');
    if(activeTeam && activeTeam !== 'Master' && !TS.value) {
        TS.value = activeTeam;
    }

    const currentTeam = TS.value;
    if(currentTeam) {
        applyTeamColorToSelector(currentTeam);
        loadSetlist(currentTeam);
    }
};

document.getElementById('teamSelector').onchange = (e) => {
    const teamName = e.target.value;
    applyTeamColorToSelector(teamName);
    loadSetlist(teamName);
};

async function loadSetlist(teamName) {
    const grid = document.getElementById('teamSetlistGrid');
    grid.style.display = 'grid';
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Carregando escala...</p>';

    const loggedTeam = sessionStorage.getItem(TEAM_KEY);
    const auth = sessionStorage.getItem(AUTH_KEY) === 'true';
    const actions = document.getElementById('teamAdminActions');
    const status = document.getElementById('teamAdminStatus');
    
    if(auth && (loggedTeam === 'Master' || loggedTeam === teamName)) {
         if(actions) actions.style.display = 'flex';
         if(status) status.style.display = 'block';
    } else {
         if(actions) actions.style.display = 'none';
         if(status) status.style.display = 'none';
    }

    try {
        const { data, error } = await _supabase
            .from('setlists')
            .select('*')
            .eq('team', teamName)
            .order('id', { ascending: true });
            
        if(error) throw error;

        grid.innerHTML = '';
        if(!data || data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ccc;">Nenhum louvor escalado para esta equipe.</p>';
            return;
        }

        data.forEach(setItem => {
            let originalSong = null;
            for(const cat of repertoireData) {
                const found = cat.items.find(s => s.title === setItem.song_title);
                if(found) { originalSong = found; break; }
            }

            const songForCard = originalSong
                ? { ...originalSong, obs: setItem.obs }
                : { title: setItem.song_title, artist: 'Excluída da base', obs: setItem.obs, vid_id: '' };

            const card = createSongCard(songForCard);
            card.classList.add('setlist-card');

            if (setItem.obs) {
                const infoDiv = card.querySelector('.card-info');
                if (infoDiv) infoDiv.innerHTML += `<p class="setlist-obs">[ ${setItem.obs} ]</p>`;
            }

            // Botões Modo Louvor
            const praiseBtns = document.createElement('div');
            praiseBtns.className = 'setlist-praise-btns';
            praiseBtns.innerHTML = `
                <button class="setlist-praise-btn vocal-btn">
                    <i class="fas fa-microphone"></i> Vocal
                </button>
                <button class="setlist-praise-btn musician-btn">
                    <i class="fas fa-guitar"></i> Músico
                </button>`;

            const songRef = originalSong || songForCard;
            praiseBtns.querySelector('.vocal-btn').onclick = (e) => {
                e.stopPropagation();
                openPraiseMode(songRef, 'vocal');
            };
            praiseBtns.querySelector('.musician-btn').onclick = (e) => {
                e.stopPropagation();
                openPraiseMode(songRef, 'musician');
            };
            card.appendChild(praiseBtns);

            grid.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="grid-column: 1/-1; color:red; text-align:center;">Erro ao carregar escala.</p>';
    }
}

const addToSetlistBtn = document.getElementById('addToSetlistBtn');
if(addToSetlistBtn) {
    addToSetlistBtn.onclick = () => {
        const panel = document.getElementById('setlistEditorPanel');
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
        document.getElementById('urlEditorPanel').style.display = 'none';
        
        let obsModal = document.getElementById('modalObs').textContent.replace('Obs: ', '').trim();
        document.getElementById('setlistObsInput').value = obsModal;
    };
}

const cancelSetlistBtn = document.getElementById('cancelSetlistBtn');
if(cancelSetlistBtn) {
    cancelSetlistBtn.onclick = () => {
         document.getElementById('setlistEditorPanel').style.display = 'none';
    };
}

const saveSetlistBtn = document.getElementById('saveSetlistBtn');
if(saveSetlistBtn) {
    saveSetlistBtn.onclick = async () => {
         const songTitle = document.getElementById('modalTitle').textContent;
         const teamSelect = document.getElementById('setlistTeamSelect');
         const team = teamSelect ? teamSelect.value : null;
         const obs = document.getElementById('setlistObsInput').value.trim();

         if(!team) {
             alert('Selecione uma equipe!');
             return;
         }

         const btn = document.getElementById('saveSetlistBtn');
         btn.textContent = 'Adicionando...';

         try {
             const { error } = await _supabase.from('setlists').insert([
                 { team, song_title: songTitle, obs }
             ]);

             if(error) throw error;
             
             alert(`Adicionado com sucesso à escala do ${team}!`);
             document.getElementById('setlistEditorPanel').style.display = 'none';
             
             const teamsCont = document.getElementById('teamsContainer');
             const TS = document.getElementById('teamSelector');
             if(teamsCont && teamsCont.style.display !== 'none' && TS && TS.value === team) {
                  loadSetlist(team);
             }
         } catch(err) {
             alert('Erro ao adicionar à escala: ' + err.message);
         } finally {
             btn.innerHTML = '<i class="fas fa-plus"></i> Confirmar na Escala';
         }
    };
}

const clearSetlistBtn = document.getElementById('clearSetlistBtn');
if(clearSetlistBtn) {
    clearSetlistBtn.onclick = async () => {
        const team = document.getElementById('teamSelector').value;
        if(!team) return;

        if(!confirm(`⚠️ Tem certeza que deseja LIMPAR TODA A ESCALA do ${team}?`)) return;

        try {
             const { error } = await _supabase.from('setlists').delete().eq('team', team);
             if(error) throw error;

             alert(`A escala do ${team} foi limpa!`);
             loadSetlist(team);
        } catch(err) {
             alert('Erro ao limpar a escala: ' + err.message);
        }
    };
}


// Modal Close logic
closeModal.onclick = () => {
    modal.style.display = 'none';
    videoIframe.src = '';
};

window.onclick = (event) => {
    if (event.target == modal) closeModal.onclick();
    if (event.target == categoryOverlay) { categoryOverlay.style.display = 'none'; resetView(); }
    if (event.target == addSongModal) addSongModal.style.display = 'none';
};

window.onscroll = () => {
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
};

// Start
// --- Sincronização Automática e Real-time ---

// 1. Atualizar ao voltar para o app (Foco)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log("App visível, atualizando dados...");
        fetchData();
        
        // Se estiver na aba de equipes, recarrega a escala também
        const teamsCont = document.getElementById('teamsContainer');
        const TS = document.getElementById('teamSelector');
        if (teamsCont && teamsCont.style.display !== 'none' && TS && TS.value) {
            loadSetlist(TS.value);
        }
    }
});

// 2. Atualizar a cada 2 minutos (Polling)
setInterval(() => {
    console.log("Executando atualização periódica (2 min)...");
    fetchData();
    
    // Se estiver na aba de equipes, recarrega a escala também
    const teamsCont = document.getElementById('teamsContainer');
    const TS = document.getElementById('teamSelector');
    if (teamsCont && teamsCont.style.display !== 'none' && TS && TS.value) {
        loadSetlist(TS.value);
    }
}, 120000); // 120.000ms = 2 minutos

// 3. Supabase Real-time (Inscrição em mudanças no Banco)
const songsChannel = _supabase
    .channel('db-changes')
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        (payload) => {
            console.log('Mudança detectada na tabela songs:', payload);
            fetchData();
        }
    )
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'setlists' },
        (payload) => {
            console.log('Mudança detectada na tabela setlists:', payload);
            const teamsCont = document.getElementById('teamsContainer');
            const TS = document.getElementById('teamSelector');
            if (teamsCont && teamsCont.style.display !== 'none' && TS && TS.value === payload.new.team) {
                loadSetlist(TS.value);
            }
        }
    )
    .subscribe();

// Botão de Atualização Forçada (Manual) - Útil para Standalone/App
document.getElementById('forceRefreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('forceRefreshBtn');
    btn.classList.add('spinning');
    
    // Pequeno delay para mostrar a animação antes de recarregar
    setTimeout(() => {
        window.location.reload(true);
    }, 500);
});

// Inicialização
fetchData();

