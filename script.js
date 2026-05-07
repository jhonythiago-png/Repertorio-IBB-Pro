// Configurações Supabase PRO
const SUPABASE_URL = "https://rxcfnwhgkdauzyuekjxf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y2Zud2hna2RhdXp5dWVranhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTAyODAsImV4cCI6MjA5MjIyNjI4MH0.QewcMlTw0L6gXkz-WXwQvSu-vZXtO3vR48X2a_-FH9g";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Controle de Acesso de Líderes ───────────────────────────────────
const AUTH_KEY = 'ibb_leader_auth';
const TEAM_KEY = 'ibb_leader_team';

// Fallback local (usado se tabela Supabase não existir)
const _LOCAL_PWD = {
    'ibbadm':'Master','start123':'Start','amarelo123':'Amarelo',
    'laranja123':'Laranja','azul123':'Azul','verde123':'Verde','branco123':'Branco'
};

async function validatePassword(pwd) {
    const key = pwd.trim().toLowerCase();
    try {
        const { data } = await _supabase
            .from('app_passwords').select('team')
            .eq('password_hash', key).maybeSingle();
        if (data && data.team) return data.team;
    } catch(e) { /* tabela não existe, usa fallback */ }
    return _LOCAL_PWD[key] || null;
}

// --- MODO PERFORMANCE E CIFRAS ---
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let currentPerformanceSong = null;
let currentPerformanceMode = 'vocal'; // 'vocal' ou 'musician'
let currentTransposeSemitones = 0;
let autoScrollInterval = null;
let currentZoomLevel = 1.0;
let currentFontSize = 15;
let _setlistSongs = [];       // lista de músicas da escala atual
let _setlistIndex  = -1;      // índice da música aberta
// ---------------------------------

// --- Motores de Captura e Transposição ---

async function fetchCifraClubContent(url) {
    if (!url.includes('cifraclub.com.br')) {
        alert('Por favor, insira um link válido do Cifra Club.');
        return null;
    }

    // ── EXPERT STEP 1: Transformação para link de impressão ──────────────
    // A página de impressão (/imprimir.html) é muito mais fácil de capturar
    let printUrl = url.trim();
    if (!printUrl.endsWith('/imprimir.html') && !printUrl.endsWith('/imprimir.html/')) {
        printUrl = printUrl.replace(/\/$/, ""); // Remove barra final se houver
        printUrl += '/imprimir.html';
    }

    // ── EXPERT STEP 2: Motor de Rotação de Proxies (4 estratégias) ───────
    const rotation = [
        { name: 'AllOrigins JSON', url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&ts=${Date.now()}`, type: 'json' },
        { name: 'AllOrigins Raw',  url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&ts=${Date.now()}`, type: 'text' },
        { name: 'CodeTabs',        url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, type: 'text' },
        { name: 'CORSProxy.io',    url: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`, type: 'text' }
    ];

    console.log('🚀 Iniciando Motor Expert para:', printUrl);

    for (const strategy of rotation) {
        try {
            const proxyUrl = strategy.url(printUrl);
            console.log(`📡 Tentando Estratégia [${strategy.name}]...`);
            
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                console.warn(`❌ [${strategy.name}] falhou com status: ${response.status}`);
                continue;
            }

            let html = '';
            if (strategy.type === 'json') {
                const data = await response.json();
                html = data.contents;
            } else {
                html = await response.text();
            }

            if (!html || html.length < 500) {
                console.warn(`❌ [${strategy.name}] retornou conteúdo vazio ou inválido.`);
                continue;
            }

            // ── EXPERT STEP 3: Extração Cirúrgica ────────────────────────
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Na página de impressão (/imprimir.html), a cifra costuma estar em #cifra_pre
            // ou em um <pre> direto
            let cifraElement = doc.querySelector('#cifra_pre') || 
                               doc.querySelector('.cifra_cnt pre') || 
                               doc.querySelector('pre');
            
            if (cifraElement) {
                console.log(`✅ SUCESSO via [${strategy.name}]!`);
                
                // ── STEP A: extrair Tom e Capo do HTML ANTES de pegar o <pre> ─
                // (o Cifra Club às vezes coloca essas infos fora do bloco <pre>)
                let injectedHeader = '';

                // Capo: busca no body inteiro (aparece como texto "Capotraste na 3ª casa")
                const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent) : '';
                const capoRx = bodyText.match(/Capotraste\s+na\s+(\d+)[aª°]?\s*casa/i);
                if (capoRx) injectedHeader += `Capotraste na ${capoRx[1]}ª casa\n`;

                // ── STEP B: limpar o texto da cifra ──────────────────────────
                let cleanedText = (cifraElement.innerText || cifraElement.textContent)
                    // Remove propaganda
                    .replace(/Ainda não sabe tocar essa música\?[\s\S]*?Aprenda aqui/gi, '')
                    // Remove lixo de UI do Cifra Club que vaza pro <pre>
                    .replace(/^\s*(Anterior|Próximo|cancelar|ok|Mudar todos.*da cifra)\s*$/gim, '')
                    // Remove linhas de Tom/Capo do <pre> (vamos usar o injectedHeader limpo)
                    .replace(/^\s*Tom\s*:.*$/gim, '')
                    .replace(/^\s*Capotraste.*$/gim, '')
                    // Colapsa mais de 2 linhas vazias consecutivas
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

                // ── STEP C: montar texto final com header limpo no topo ──────
                if (injectedHeader) {
                    // Só injeta se o <pre> não já tinha Tom/Capo limpos
                    cleanedText = injectedHeader.trim() + '\n\n' + cleanedText;
                }

                return cleanedText;
            }
        } catch (err) {
            console.warn(`⚠️ Erro na estratégia [${strategy.name}]:`, err.message);
        }
    }

    // Se todos falharem, tentamos a URL ORIGINAL sem /imprimir como último recurso
    if (printUrl !== url) {
        console.log('🔄 Tentativa final com URL original...');
        // (Isso é recursivo mas só roda uma vez por causa da condição if)
        // Por simplicidade, vamos apenas avisar o erro aqui para evitar loop infinito
    }

    const isLocalFile = window.location.protocol === 'file:';
    let msg = 'O motor Expert não conseguiu furar o bloqueio automaticamente.';
    
    if (isLocalFile) {
        msg += '\n\nO navegador bloqueia essa função em arquivos locais. Tente quando o site estiver online no GitHub.';
    } else {
        msg += '\n\nO Cifra Club bloqueou todas as tentativas de captura. \n\nSOLUÇÃO: Abra o link, copie a letra e cole manualmente.';
    }
    
    alert(msg);
    return null;
}

function transposeChord(chord, semitones) {
    if (semitones === 0) return chord;

    const regex = /^([A-G][b#]?)(.*)$/;
    const match = chord.match(regex);
    if (!match) return chord;

    const root = match[1];
    const suffix = match[2];

    const isSharp = root.includes('#') || (!root.includes('b') && semitones > 0);
    const scale = isSharp ? NOTES_SHARP : NOTES_FLAT;
    
    // Normalizar root (Ex: Db -> C# se estivermos usando escala Sharp)
    let index = NOTES_FLAT.indexOf(root);
    if (index === -1) index = NOTES_SHARP.indexOf(root);
    
    if (index === -1) return chord;

    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    return scale[newIndex] + suffix;
}

function processTransposition(text, semitones) {
    if (semitones === 0) return text;
    
    // Expressão regular robusta (a mesma da heurística) para capturar APENAS acordes reais, 
    // garantindo a captura do espaço anterior para não quebrar o layout.
    const chordRegex = /(^|\s)([A-G][b#]?(?:m(?:aj|in)?|maj|dim|aug|sus|add|min|°|ø|-)?-?(?:\d{1,2})?(?:M)?(?:[+])?(?:\((?:[b#]?\d+[+\-]?(?:\/[b#]?\d+[+\-]?)*)\))?(?:\/[A-G][b#]?(?:\d{0,2})?)?)(?=\s|$)/g;
    
    const lines = text.split('\n');
    return lines.map(line => {
        // CORREÇÃO CRÍTICA: Só transpõe se a heurística confirmar que a linha é puramente de acordes.
        // Isso impede que palavras da letra da música (ex: "A", "E") sejam acidentalmente transpostas e apareçam na tela Vocal.
        if (!isChordLineByHeuristic(line)) return line;
        
        return line.replace(chordRegex, (match, space, chord) => {
            if (chord.includes('/')) {
                const parts = chord.split('/');
                return space + transposeChord(parts[0], semitones) + '/' + transposeChord(parts[1], semitones);
            }
            return space + transposeChord(chord, semitones);
        });
    }).join('\n');
}

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
    const admBtnEl        = document.getElementById('admBtn');
    const addNavItem      = document.getElementById('addSongNavItem');
    const editBtn         = document.getElementById('editUrlBtn');
    const editorPanel     = document.getElementById('urlEditorPanel');
    const addToSetlistBtn = document.getElementById('addToSetlistBtn');
    const teamAdminActions = document.getElementById('teamAdminActions');
    const teamAdminStatus  = document.getElementById('teamAdminStatus');
    const exportBtn        = document.getElementById('exportCronogramaBtn');

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
        if (exportBtn) exportBtn.style.display = 'flex';
        
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
        if (exportBtn) exportBtn.style.display = 'none';
        
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

// Função Única de Submissão de Senha
async function handlePasswordSubmit() {
    const rawValue = pwInput.value || '';
    const btn = document.getElementById('submitPasswordBtn');
    if (btn) btn.textContent = 'Verificando...';

    const team = await validatePassword(rawValue);

    if (btn) btn.innerHTML = '<i class="fas fa-unlock-alt"></i> Entrar';

    if (team) {
        pwGateModal.style.display = 'none';
        pwError.style.display = 'none';
        sessionStorage.removeItem(TEAM_KEY);
        setAdminMode(true, team);
        const currentTeamSelect = document.getElementById('teamSelector');
        if (currentTeamSelect && document.getElementById('teamsContainer').style.display !== 'none') {
            currentTeamSelect.dispatchEvent(new Event('change'));
        }
    } else {
        pwError.style.display = 'block';
        pwInput.value = '';
        pwInput.focus();
    }
}

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
    };
}

// Listeners fixos (evita duplicação)
if (pwSubmitBtn) {
    pwSubmitBtn.onclick = handlePasswordSubmit;
}
if (pwInput) {
    pwInput.onkeydown = (e) => {
        if (e.key === 'Enter') handlePasswordSubmit();
    };
}

// --- LÓGICA DE PERFORMANCE E INTERAÇÕES ---

function openPerformance(song, mode) {
    currentPerformanceSong = song;
    currentPerformanceMode = mode;
    currentTransposeSemitones = 0;
    currentZoomLevel = 1.0;
    currentFontSize = 15;
    scrollSpeed = 3;
    const fontLabel = document.getElementById('fontSizeLabel');
    if (fontLabel) fontLabel.textContent = '15';
    const scrollLabel = document.getElementById('scrollSpeedLabel');
    if (scrollLabel) scrollLabel.textContent = '3';

    // Sincroniza botões de modo (Vocal/Músicos) na tela de performance
    document.querySelectorAll('.perf-mode-btn[data-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Botões ADM na tela de performance
    const perfAdminActions = document.getElementById('perfAdminActions');
    const isAdminNow = sessionStorage.getItem(AUTH_KEY) === 'true';
    if (perfAdminActions) perfAdminActions.style.display = isAdminNow ? 'flex' : 'none';

    // Botões de navegação: visíveis só quando aberto da escala
    const nextBtn = document.getElementById('nextPerfBtn');
    const prevBtn = document.getElementById('prevPerfBtn');
    if (nextBtn) nextBtn.style.display = (_setlistIndex >= 0 && _setlistIndex + 1 < _setlistSongs.length) ? 'inline-flex' : 'none';
    if (prevBtn) prevBtn.style.display = (_setlistIndex > 0) ? 'inline-flex' : 'none';

    const screen = document.getElementById('performanceScreen');
    const content = document.getElementById('performanceContent');
    const title = document.getElementById('perfTitle');
    const artist = document.getElementById('perfArtist');
    const keyIndicator = document.getElementById('perfKeyDisplay');

    screen.classList.remove('vocal-mode');
    const keyControlGroup = document.getElementById('keyControlGroup');

    if (mode === 'vocal') {
        screen.classList.add('vocal-mode');
        if (keyControlGroup) keyControlGroup.style.display = 'none';
    } else {
        if (keyControlGroup) keyControlGroup.style.display = 'flex';
    }

    title.textContent = song.title;
    artist.textContent = song.artist || 'Artista Desconhecido';
    
    // ── Tom e Capotraste ─────────────────────────────────────────────
    const textContent = song.cifra_text || '';
    const capoGroup   = document.getElementById('capoControlGroup');
    const capoDisplay = document.getElementById('perfCapoDisplay');
    const tomSubLabel = document.getElementById('perfTomSubLabel');

    // 1) Extrai tom da linha "Tom: Bb (forma dos acordes no tom de G)"
    const tomLineMatch = textContent.match(/^Tom:\s*(.+)$/im);
    const tomLine      = tomLineMatch ? tomLineMatch[1].trim() : null;

    // 2) Extrai capo da linha "Capotraste na 3ª casa"
    const capoMatch    = textContent.match(/Capotraste\s+na\s+(\d+)[aª°]?\s*casa/i) ||
                         textContent.match(/Capo\s*(\d+)/i);
    let capoOriginal = capoMatch ? parseInt(capoMatch[1]) : 0;

    // Helper: detecta o tom da PRIMEIRA PARTE (ignora intro)
    function detectFormaKey(txt) {
        const lines = txt.split('\n');
        let passedIntro = false;
        let introChords = null; // fallback se não achar seção nomeada

        for (let i = 0; i < lines.length; i++) {
            const t = lines[i].trim();
            if (!t) continue;

            // Marcador de seção: [Intro], [Primeira Parte], [Verso], etc.
            if (/^\[.+\]/.test(t)) {
                if (/^\[(Intro|Tab|Instrumen)/i.test(t)) {
                    passedIntro = false; // ainda na intro
                } else {
                    passedIntro = true; // entrou numa seção real
                }
                continue;
            }

            // Ignora linhas de metadado
            if (/^(Tom|Capotraste|Parte\s+\d)/i.test(t)) continue;

            // Testa se é linha de acordes
            const tokens = t.split(/\s+/).filter(Boolean);
            if (tokens.length === 0) continue;
            const allChords = tokens.every(tk =>
                /^[A-G][b#]?(?:m(?:aj|in)?|maj|dim|aug|sus|add|min|°|ø|-)?-?(?:\d{1,2})?(?:M)?(?:[+])?(?:\((?:[b#]?\d+[+\-]?(?:\/[b#]?\d+[+\-]?)*)\))?(?:\/[A-G][b#]?(?:\d{0,2})?)?$/.test(tk)
            );

            if (allChords) {
                const baseChord = tokens[0].split('/')[0];
                const match = baseChord.match(/^([A-G][b#]?m?)/i);
                const root = match ? match[1] : baseChord;
                if (passedIntro) return root; // ✅ acorde da seção real
                if (!introChords) introChords = root; // guarda da intro como fallback
            }
        }
        return introChords; // fallback: usa intro se não achou seção real
    }

    // 3) Determina displayKey (tom exibido no botão) e formaKey (notas da cifra)
    let displayKey   = null;
    let formaKey     = null;
    let subLabelText = null;

    if (tomLine) {
        // Tem linha "Tom: Bb (forma dos acordes no tom de G)"
        const tomRealMatch = tomLine.match(/^([A-G][b#]?m?)/i);
        if (tomRealMatch) displayKey = tomRealMatch[1]; // "Bb"

        const formaMatch = tomLine.match(/tom\s+de\s+([A-G][b#]?m?)/i) ||
                           tomLine.match(/\(forma\s+([A-G][b#]?m?)\)/i);
        
        if (formaMatch) {
            formaKey = formaMatch[1]; // "G"
        } else {
            // Se não diz a forma explicitamente, confiamos no Tom declarado.
            // Só tentamos adivinhar pelos acordes se houver CAPO sem forma especificada.
            if (capoOriginal > 0) {
                const detected = detectFormaKey(textContent);
                formaKey = detected || displayKey;
            } else {
                formaKey = displayKey;
            }
        }

        const parenMatch = tomLine.match(/(\(.+\))/);
        if (parenMatch) subLabelText = parenMatch[1];

    } else if (capoOriginal > 0) {
        // Sem linha Tom: mas tem capo → calcula tom real = formaKey + capo semitones
        formaKey = detectFormaKey(textContent);
        if (formaKey) {
            const idx = SCALE.indexOf(normalizeKey(formaKey));
            if (idx !== -1) {
                const quality = formaKey.toLowerCase().endsWith('m') ? 'm' : '';
                displayKey   = SCALE[(idx + capoOriginal) % 12] + quality;
                subLabelText = `(forma dos acordes no tom de ${formaKey})`;
            }
        }

    } else {
        // Sem capo, sem linha Tom: → mostra a nota detectada diretamente
        formaKey   = detectFormaKey(textContent);
        displayKey = formaKey;
    }

    // Fallback final: nunca mostra "Original" — usa 'C' como base desconhecida
    if (!formaKey)   formaKey   = 'C';
    if (!displayKey) displayKey = formaKey;

    // ── Override: tom e capo definidos pelo ADM na escala ────────────
    const setlistTomKey   = song._setlistTomKey   || null;
    const setlistCapoFret = song._setlistCapoFret != null ? song._setlistCapoFret : null;

    if (setlistTomKey) {
        displayKey = setlistTomKey;
        const newCapo = setlistCapoFret !== null ? setlistCapoFret : capoOriginal;
        
        const originalChordsIdx = SCALE.indexOf(normalizeKey(formaKey));
        const newSoundingIdx    = SCALE.indexOf(normalizeKey(setlistTomKey));
        
        if (originalChordsIdx !== -1 && newSoundingIdx !== -1) {
            // A nota que o músico precisa tocar (forma) para alcançar o novo tom com o novo capo
            const newChordsIdx = (newSoundingIdx - newCapo + 12) % 12;
            currentTransposeSemitones = (newChordsIdx - originalChordsIdx + 12) % 12;
        }
    }

    if (setlistCapoFret !== null) {
        // ADM definiu um capo específico — sobrescreve o original da cifra
        capoOriginal = setlistCapoFret;
    }
    // ─────────────────────────────────────────────────────────────────

    keyIndicator.textContent        = displayKey;
    keyIndicator.dataset.original   = formaKey;
    keyIndicator.dataset.displayKey = displayKey;
    keyIndicator.dataset.initialTranspose = currentTransposeSemitones;
    // currentTransposeSemitones já foi ajustado acima se há override

    // Sublabel abaixo do botão de tom
    if (tomSubLabel) {
        if (subLabelText) {
            tomSubLabel.textContent = subLabelText;
            tomSubLabel.style.display = 'block';
        } else {
            tomSubLabel.style.display = 'none';
        }
    }

    // 4) Capotraste — sempre visível para músico
    if (capoDisplay) {
        capoDisplay.dataset.capo         = capoOriginal;
        capoDisplay.dataset.capoOriginal  = capoOriginal;
        const capoText = document.getElementById('perfCapoText');
        if (capoText) capoText.textContent = capoOriginal === 0 ? 'S/Capo' : `${capoOriginal}ª casa`;
        document.querySelectorAll('.capo-btn-item').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.capo) === capoOriginal);
        });
    }
    if (capoGroup) capoGroup.style.display = (mode === 'musician') ? 'flex' : 'none';

    // Tom: visível só no modo músico
    const keyGroup = document.getElementById('keyControlGroup');
    if (keyGroup) keyGroup.style.display = (mode === 'musician') ? 'flex' : 'none';
    // ─────────────────────────────────────────────────────────────────

    // ── Player YouTube: sempre configura ao abrir (modal ou escala) ──
    const _playerWrapper  = document.getElementById('perfPlayerWrapper');
    const _playerIframe   = document.getElementById('perfPlayerIframe');
    const _playerToggle   = document.getElementById('perfPlayerToggle');

    if (song.vid_id) {
        if (_playerIframe)  _playerIframe.src = `https://www.youtube.com/embed/${song.vid_id}?autoplay=0`;
        // Da página inicial: player já abre visível. Da escala: começa oculto.
        const startVisible = song._autoOpenPlayer === true;
        if (_playerWrapper) _playerWrapper.style.display = startVisible ? 'block' : 'none';
        if (_playerToggle)  {
            _playerToggle.style.display = 'flex';
            _playerToggle.innerHTML = startVisible ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-music"></i>';
            _playerToggle.title = startVisible ? 'Ocultar player' : 'Mostrar player';
            _playerToggle.onclick = () => {
                const vis = _playerWrapper.style.display !== 'none';
                _playerWrapper.style.display = vis ? 'none' : 'block';
                _playerToggle.title = vis ? 'Mostrar player' : 'Ocultar player';
                _playerToggle.innerHTML = vis
                    ? '<i class="fas fa-music"></i>'
                    : '<i class="fas fa-eye-slash"></i>';
            };
        }
    } else {
        if (_playerIframe)  _playerIframe.src = '';
        if (_playerWrapper) _playerWrapper.style.display = 'none';
        if (_playerToggle)  { _playerToggle.style.display = 'none'; _playerToggle.onclick = null; }
    }
    // ─────────────────────────────────────────────────────────────────

    renderPerformanceContent();

    screen.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Fechar grade se estiver aberta
    document.getElementById('keySelectorGrid').style.display = 'none';
}

function renderPerformanceContent() {
    const content = document.getElementById('performanceContent');
    
    // ── CORREÇÃO CRÍTICA: Limpar o conteúdo ANTES de redesenhar ──
    content.innerHTML = '';

    let text = currentPerformanceSong.cifra_text || 'Sem letra ou cifra cadastrada.';
    
    // Aplicar Transposição
    if (currentTransposeSemitones !== 0) {
        text = processTransposition(text, currentTransposeSemitones);
    }

    const lines = text.split('\n');
    const isVocal = currentPerformanceMode === 'vocal';

    // No modo vocal, precisamos pré-processar para evitar linhas vazias acumuladas
    // (quando cifras são removidas, ficam lacunas duplas/triplas)
    if (isVocal) {
        // Filtra primeiro, depois renderiza — evita blocos vazios
        const filteredLines = [];
        let lastWasEmpty = false;

        lines.forEach(line => {
            const trimmed = line.trim();

            const isCifraOrTab = isChordLineByHeuristic(line) ||
                /^[A-Ga-g]?\|[\-\d\s\|pbrh\/\(\)\~\>\.)]+$/.test(trimmed);

            const isAlwaysHidden = /Parte\s+\d+\s+de\s+\d+/i.test(trimmed) ||
                /^\s*Tom\s*:/i.test(trimmed) ||
                /^\s*Capotraste/i.test(trimmed) ||
                /^(Anterior|Próximo|cancelar|ok|Mudar todos .* da cifra)$/i.test(trimmed) ||
                /^[\[\(]?(?:Intro|Solo|Tab|Dedilhado|Instrumental|Interlúdio)/i.test(trimmed) ||
                trimmed.toLowerCase().includes('tab -') ||
                /^[\s↓↑v^TxX]+$/.test(trimmed);

            const isStructureMarker = /^[\[\(]?(?:Refrão|Coro|Ponte|Final|Verso|Primeira|Segunda|Terceira|Quarta)/i.test(trimmed);

            // Linhas a ignorar no vocal
            if (isAlwaysHidden) return;
            if (isCifraOrTab && !isStructureMarker) return;

            // Linha vazia: só adiciona se a linha anterior não era vazia
            if (trimmed === '') {
                if (!lastWasEmpty) {
                    filteredLines.push('');
                    lastWasEmpty = true;
                }
                return;
            }

            lastWasEmpty = false;
            filteredLines.push(trimmed);
        });

        // Remove linha vazia no início ou no fim
        while (filteredLines.length && filteredLines[0] === '') filteredLines.shift();
        while (filteredLines.length && filteredLines[filteredLines.length - 1] === '') filteredLines.pop();

        filteredLines.forEach(line => {
            const lineDiv = document.createElement('div');
            if (line === '') {
                lineDiv.className = 'perf-line empty-line';
                lineDiv.innerHTML = '&nbsp;';
            } else {
                lineDiv.className = 'perf-line';
                const isMarker = /^[\[\(]?(?:Refrão|Coro|Ponte|Final|Verso|Primeira|Segunda|Terceira|Quarta)/i.test(line);
                if (isMarker) lineDiv.classList.add('structure-marker');
                lineDiv.textContent = line;
            }
            content.appendChild(lineDiv);
        });

    } else {
        // Modo músico — renderização completa original
        lines.forEach(line => {
            let displayLine = line;
            const trimmed = line.trim();

            if (trimmed === '') {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'perf-line empty-line';
                emptyDiv.innerHTML = '&nbsp;';
                content.appendChild(emptyDiv);
                return;
            }

            // Ocultar metadados da cifra no modo músico também
            if (/^\s*Tom\s*:/i.test(trimmed) || /^\s*Capotraste/i.test(trimmed)) return;
            if (/^(Anterior|Próximo|cancelar|ok|Mudar todos .* da cifra)$/i.test(trimmed)) return;

            const isCifraOrTab = isChordLineByHeuristic(line) ||
                /^[A-Ga-g]?\|[\-\d\s\|pbrh\/\(\)\~\>\.)]+$/.test(trimmed);

            const isAlwaysHidden = /Parte\s+\d+\s+de\s+\d+/i.test(trimmed) ||
                /^[\[\(]?(?:Intro|Solo|Tab|Dedilhado|Instrumental)/i.test(trimmed) ||
                trimmed.toLowerCase().includes('tab -');

            const lineDiv = document.createElement('div');
            lineDiv.className = 'perf-line';

            if (isCifraOrTab || isAlwaysHidden) {
                lineDiv.classList.add('chord-line');
            }

            lineDiv.textContent = displayLine || ' ';
            content.appendChild(lineDiv);
        });
    }

    // Aplica tamanho de fonte após cada render
    const c = document.getElementById('performanceContent');
    if (c) c.style.setProperty('--perf-font-size', currentFontSize + 'px');
}

const SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Helper: detecta o tom da PRIMEIRA PARTE (ignora intro)
function detectFormaKey(txt) {
    if (!txt) return null;
    const lines = txt.split('\n');
    let passedIntro = false;
    let introChords = null; 

    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) continue;
        if (/^\[.+\]/.test(t)) {
            if (/^\[(Intro|Tab|Instrumen)/i.test(t)) {
                passedIntro = false; 
            } else {
                passedIntro = true; 
            }
            continue;
        }
        if (/^(Tom|Capotraste|Parte\s+\d)/i.test(t)) continue;
        const tokens = t.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) continue;
        const allChords = tokens.every(tk =>
            /^[A-G][b#]?(?:m(?:aj|in)?|maj|dim|aug|sus|add|min|||-)?-?(?:\d{1,2})?(?:M)?(?:[+])?(?:\((?:[b#]?\d+[+\-]?(?:\/[b#]?\d+[+\-]?)*)\))?(?:\/[A-G][b#]?(?:\d{0,2})?)?$/.test(tk)
        );
        if (allChords) {
            const baseChord = tokens[0].split('/')[0];
            const match = baseChord.match(/^([A-G][b#]?m?)/i);
            const root = match ? match[1] : baseChord;
            if (passedIntro) return root; 
            if (!introChords) introChords = root; 
        }
    }
    return introChords; 
}


// Abrir/Fechar Grade de Tons
document.getElementById('perfKeyDisplay').onclick = (e) => {
    e.stopPropagation();
    const grid = document.getElementById('keySelectorGrid');
    grid.style.display = grid.style.display === 'none' ? 'block' : 'none';
};

// Fechar grade ao clicar fora
document.addEventListener('click', (e) => {
    const grid = document.getElementById('keySelectorGrid');
    if (grid && !grid.contains(e.target) && e.target.id !== 'perfKeyDisplay') {
        grid.style.display = 'none';
    }
});

// Listener para os botões da grade de tom
document.querySelectorAll('.key-btn').forEach(btn => {
    btn.onclick = () => {
        const targetKey    = btn.dataset.key;
        const keyIndicator = document.getElementById('perfKeyDisplay');
        const capoDisplay  = document.getElementById('perfCapoDisplay');
        const casaAtual    = capoDisplay ? (parseInt(capoDisplay.dataset.capo) || 0) : 0;
        
        // Base = formaKey (notas como estão escritas na cifra, ex: G)
        const baseKey = keyIndicator.dataset.original || 'C';
        const quality = baseKey.toLowerCase().endsWith('m') ? 'm' : '';

        const originalChordsIdx = SCALE.indexOf(normalizeKey(baseKey));
        const targetSoundingIdx = SCALE.indexOf(normalizeKey(targetKey));
        
        if (originalChordsIdx !== -1 && targetSoundingIdx !== -1) {
            const targetChordsIdx = (targetSoundingIdx - casaAtual + 12) % 12;
            currentTransposeSemitones = (targetChordsIdx - originalChordsIdx + 12) % 12;
        }

        document.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        keyIndicator.textContent = targetKey + quality;
        renderPerformanceContent();
    };
});

function normalizeKey(key) {
    if (!key) return 'C';
    let root = key.replace(/m$/i, '');
    const map = { 'C#': 'Db', 'D#': 'Eb', 'Gb': 'F#', 'G#': 'Ab', 'A#': 'Bb' };
    return map[root] || root;
}

document.getElementById('stepUp').onclick = () => {
    currentTransposeSemitones = (currentTransposeSemitones + 1) % 12;
    updateKeyIndicatorFromSemitones();
    renderPerformanceContent();
};

document.getElementById('stepDown').onclick = () => {
    currentTransposeSemitones = (currentTransposeSemitones - 1 + 12) % 12;
    updateKeyIndicatorFromSemitones();
    renderPerformanceContent();
};

document.getElementById('restoreKey').onclick = () => {
    const keyIndicator = document.getElementById('perfKeyDisplay');
    currentTransposeSemitones = parseInt(keyIndicator.dataset.initialTranspose) || 0;
    keyIndicator.textContent = keyIndicator.dataset.displayKey || keyIndicator.dataset.original || 'C';
    document.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
    // Restaura capo e manualSemitones para originais
    const capoDisplay = document.getElementById('perfCapoDisplay');
    const capoText    = document.getElementById('perfCapoText');
    if (capoDisplay && capoText) {
        const capoOrig = parseInt(capoDisplay.dataset.capoOriginal) || 0;
        capoDisplay.dataset.capo           = capoOrig;
        capoDisplay.dataset.manualSemitones = 0;
        capoText.textContent = capoOrig === 0 ? 'S/Capo' : `${capoOrig}ª casa`;
        document.querySelectorAll('.capo-btn-item').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.capo) === capoOrig);
        });
    }
    renderPerformanceContent();
};

function updateKeyIndicatorFromSemitones() {
    const keyIndicator = document.getElementById('perfKeyDisplay');
    const formaKey     = keyIndicator.dataset.original || 'C';
    const quality      = formaKey.toLowerCase().endsWith('m') ? 'm' : '';
    const capoDisplay  = document.getElementById('perfCapoDisplay');
    const casaAtual    = capoDisplay ? (parseInt(capoDisplay.dataset.capo) || 0) : 0;
    const fIdx         = SCALE.indexOf(normalizeKey(formaKey));
    if (fIdx === -1) return;

    if (casaAtual > 0) {
        // Com capo: som real = notas transpostas atualmente + capo semitones
        // notas atuais = formaKey + currentTransposeSemitones
        // som real     = notas atuais + capo
        const notasAtuaisIdx = (fIdx + currentTransposeSemitones + 12) % 12;
        keyIndicator.textContent = SCALE[(notasAtuaisIdx + casaAtual) % 12] + quality;
    } else {
        // Sem capo: tom = formaKey + semitones manuais
        keyIndicator.textContent = SCALE[(fIdx + currentTransposeSemitones + 12) % 12] + quality;
    }

    const tomSubLabel = document.getElementById('perfTomSubLabel');
    if (tomSubLabel && tomSubLabel.style.display !== 'none' && currentPerformanceSong) {
        const originalText = currentPerformanceSong.cifra_text.match(/(\(forma\s+dos\s+acordes\s+no\s+tom\s+de\s+|forma\s+)([A-G][b#]?m?)/i);
        if (originalText) {
            const originalForma = originalText[2];
            const newForma = transposeChord(originalForma, currentTransposeSemitones);
            tomSubLabel.textContent = `(forma dos acordes no tom de ${newForma})`;
        }
    }
}

// Função auxiliar para detectar se uma linha é de acordes (não letra)
function isChordLineByHeuristic(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Linha de tablatura
    if (/^[EBGDAe]\|/.test(trimmed)) return true;

    // Remove parênteses externos SOMENTE quando linha começa com '( ' e termina com ' )'
    // Ex: "( D11 Em D/F# )" → remove | "Bb/F F7(4/9)" → não toca o ) do acorde
    const isWrapper = /^\(\s/.test(trimmed) && /\s\)$/.test(trimmed);
    const stripped = isWrapper ? trimmed.slice(1, -1).trim() : trimmed;

    // Filtra tokens vazios, parênteses soltos e marcadores (ex: [Intro])
    const words = stripped.split(/\s+/).filter(w => 
        w !== '(' && w !== ')' && w !== '' && !/^\[.*\]$/.test(w)
    );
    if (words.length === 0) return false;

    let chordCount = 0;
    words.forEach(word => {
        // Se a palavra estiver entre parênteses colados (ex: "(C2)"), removemos para testar
        let cleanWord = word;
        if (cleanWord.length > 2 && cleanWord.startsWith('(') && cleanWord.endsWith(')')) {
            cleanWord = cleanWord.slice(1, -1);
        }

        // Regex definitivo v3
        if (/^[A-G][b#]?(?:m(?:aj|in)?|maj|dim|aug|sus|add|min|°|ø|-)?-?(?:\d{1,2})?(?:M)?(?:[+])?(?:\((?:[b#]?\d+[+\-]?(?:\/[b#]?\d+[+\-]?)*)\))?(?:\/[A-G][b#]?(?:\d{0,2})?)?$/.test(cleanWord)) {
            chordCount++;
        }
    });

    const ratio = chordCount / words.length;
    // 1 token: deve ser 100% acorde | 2+ tokens: 85%+ acordes
    return words.length === 1 ? ratio === 1.0 : ratio >= 0.85;
}

// Os listeners de Zoom e Transposição antigos foram removidos para dar lugar à nova Grade Pro.

// Auto Scroll
let scrollSpeed = 3;

function toggleAutoScroll() {
    if (autoScrollInterval) { stopAutoScroll(); } else { startAutoScroll(); }
}

function startAutoScroll() {
    const content = document.getElementById('performanceContent');
    const btn = document.getElementById('toggleScroll');
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    clearInterval(autoScrollInterval);
    autoScrollInterval = setInterval(() => {
        if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) {
            stopAutoScroll(); return;
        }
        content.scrollTop += 1;
    }, Math.round(450 / scrollSpeed));
}

function stopAutoScroll() {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    const btn = document.getElementById('toggleScroll');
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
}

document.getElementById('toggleScroll').onclick = toggleAutoScroll;

document.getElementById('scrollFaster').onclick = () => {
    if (scrollSpeed < 15) { 
        scrollSpeed++; 
        updateScrollSpeedLabel();
        if (autoScrollInterval) startAutoScroll(); 
    }
};
document.getElementById('scrollSlower').onclick = () => {
    if (scrollSpeed > 1) { 
        scrollSpeed--; 
        updateScrollSpeedLabel();
        if (autoScrollInterval) startAutoScroll(); 
    }
};

function updateScrollSpeedLabel() {
    const label = document.getElementById('scrollSpeedLabel');
    if (label) label.textContent = scrollSpeed;
}

// Capturar Cifra Automaticamente (ADM)
const btnCapturar = document.getElementById('btnCapturarCifra');
if (btnCapturar) {
    btnCapturar.onclick = async () => {
        const url = document.getElementById('addCifraClubUrl').value.trim();
        if (!url) { alert('Insira o link primeiro!'); return; }
        
        const oldText = btnCapturar.textContent;
        btnCapturar.textContent = 'Capturando...';
        btnCapturar.disabled = true;
        
        const content = await fetchCifraClubContent(url);
        if (content) {
            document.getElementById('addCifraPreviewContainer').style.display = 'block';
            
            let finalContent = content;
            let tomInicial = "C";
            const tomMatch = finalContent.match(/^(?:Tom:\s*)([A-G][b#]?m?)/im);
            if (tomMatch) {
                tomInicial = tomMatch[1];
            } else {
                let detected = detectFormaKey(finalContent);
                if (detected) {
                    tomInicial = detected;
                }
                finalContent = `Tom: ${tomInicial}\n\n` + finalContent;
            }
            
            document.getElementById('addCifraTextPreview').value = finalContent;
            
            const trigger = document.getElementById('addCaptureKeyTrigger');
            if (trigger) {
                trigger.textContent = tomInicial;
                trigger.dataset.key = tomInicial;
                trigger.dataset.initialKey = tomInicial;
            }
            
            const container = document.getElementById('addCaptureKeyGrid');
            if (container) {
                container.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
                const normTom = normalizeKey(tomInicial).replace(/m$/i, '');
                const activeBtn = Array.from(container.querySelectorAll('.key-btn')).find(b => b.dataset.key === normTom);
                if (activeBtn) activeBtn.classList.add('active');
            }

            alert('✅ Conteúdo capturado com sucesso! Revise ou transponha abaixo antes de salvar.');
        }
        
        btnCapturar.textContent = oldText;
        btnCapturar.disabled = false;
    };
}

function transposeRawText(text, semitones) {
    if (semitones === 0) return text;
    let newText = processTransposition(text, semitones);
    newText = newText.replace(/^(Tom:\s*)([A-G][b#]?m?)(.*)$/im, (match, prefix, key, rest) => {
        const newKey = transposeChord(key, semitones);
        let newRest = rest;
        const formaMatch = rest.match(/(forma\s+dos\s+acordes\s+no\s+tom\s+de\s+|forma\s+)([A-G][b#]?m?)/i);
        if (formaMatch) {
            const oldForma = formaMatch[2];
            const newForma = transposeChord(oldForma, semitones);
            newRest = rest.substring(0, formaMatch.index) + formaMatch[1] + newForma + rest.substring(formaMatch.index + formaMatch[0].length);
        }
        return prefix + newKey + newRest;
    });
    return newText;
}

function handleGridCaptureTranspose(targetKey, textareaId, containerId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea || !textarea.value) return;

    let currentKey = "C";
    const tomMatch = textarea.value.match(/^(?:Tom:\s*)([A-G][b#]?m?)/im);
    if (tomMatch) {
        currentKey = tomMatch[1];
    }
    
    const originalChordsIdx = SCALE.indexOf(normalizeKey(currentKey).replace(/m$/i, ''));
    const targetSoundingIdx = SCALE.indexOf(normalizeKey(targetKey).replace(/m$/i, ''));
    
    if (originalChordsIdx !== -1 && targetSoundingIdx !== -1) {
        const step = (targetSoundingIdx - originalChordsIdx + 12) % 12;
        textarea.value = transposeRawText(textarea.value, step);
    }
    
    const container = document.getElementById(containerId);
    if (container) {
        container.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = Array.from(container.querySelectorAll('.key-btn')).find(b => b.dataset.key === targetKey);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

function setupCapturePopup(triggerId, popupId, gridId, textareaId, stepUpId, stepDownId, restoreId) {
    const trigger = document.getElementById(triggerId);
    const popup = document.getElementById(popupId);
    const grid = document.getElementById(gridId);
    if (!trigger || !popup || !grid) return;

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isVisible = popup.style.display === 'block';
        document.querySelectorAll('.key-grid-popup').forEach(p => p.style.display = 'none');
        popup.style.display = isVisible ? 'none' : 'block';
    };

    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && e.target !== trigger) {
            popup.style.display = 'none';
        }
    });

    grid.querySelectorAll('.key-btn').forEach(btn => {
        btn.onclick = () => {
            handleGridCaptureTranspose(btn.dataset.key, textareaId, gridId);
            trigger.textContent = btn.dataset.key;
            trigger.dataset.key = btn.dataset.key;
            popup.style.display = 'none'; // Fechar após a escolha
        };
    });

    const stepUp = document.getElementById(stepUpId);
    if (stepUp) {
        stepUp.onclick = () => {
            const current = trigger.dataset.key || 'C';
            const nextIdx = (SCALE.indexOf(normalizeKey(current).replace(/m$/i, '')) + 1) % 12;
            const target = SCALE[nextIdx];
            handleGridCaptureTranspose(target, textareaId, gridId);
            trigger.textContent = target;
            trigger.dataset.key = target;
        };
    }
    
    const stepDown = document.getElementById(stepDownId);
    if (stepDown) {
        stepDown.onclick = () => {
            const current = trigger.dataset.key || 'C';
            const prevIdx = (SCALE.indexOf(normalizeKey(current).replace(/m$/i, '')) - 1 + 12) % 12;
            const target = SCALE[prevIdx];
            handleGridCaptureTranspose(target, textareaId, gridId);
            trigger.textContent = target;
            trigger.dataset.key = target;
        };
    }
    
    const restore = document.getElementById(restoreId);
    if (restore) {
        restore.onclick = () => {
            const initial = trigger.dataset.initialKey || 'C';
            handleGridCaptureTranspose(initial, textareaId, gridId);
            trigger.textContent = initial;
            trigger.dataset.key = initial;
        };
    }
}

// Configurar os dois popups
setupCapturePopup('addCaptureKeyTrigger', 'addCaptureKeyPopup', 'addCaptureKeyGrid', 'addCifraTextPreview', 'addCaptureStepUp', 'addCaptureStepDown', 'addCaptureRestoreKey');
setupCapturePopup('editCaptureKeyTrigger', 'editCaptureKeyPopup', 'editCaptureKeyGrid', 'editCifraText', 'editCaptureStepUp', 'editCaptureStepDown', 'editCaptureRestoreKey');

// ─────────────────────────────────────────────────────────────────────
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
    _lastFetchTime = Date.now();
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
            const cats = Array.isArray(song.categories) ? song.categories : (typeof song.categories === "string" ? [song.categories] : ["Geral"]);
            if (true) {
                cats.forEach(cat => {
                    if (!ALL_CATEGORIES.includes(cat)) {
                        ALL_CATEGORIES.push(cat);
                    }
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(song);
                });
            }
            // FIX: músicas com status NOVA também aparecem na categoria "Novos"
            // independente de terem 'Novos' no array categories[]
            if (song.status === 'NOVA' && !cats.includes('Novos')) {
                if (!grouped['Novos']) grouped['Novos'] = [];
                if (!grouped['Novos'].find(s => s.id === song.id || s.title === song.title)) {
                    grouped['Novos'].push(song);
                }
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
    card.onclick = () => {
        if (song.cifra_text && song.cifra_text.trim().length > 10) {
            // Tem cifra → abre tela de performance com player já aberto
            const songWithFlag = Object.assign({}, song, { _autoOpenPlayer: true });
            _setlistIndex = -1; // não está na escala, sem Anterior/Próximo
            openPerformance(songWithFlag, 'vocal');
        } else {
            // Sem cifra → abre modal normal com player
            openVideo(song);
        }
    };
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
    if (!song) return;
    
    // Garantir que a URL seja do tipo Embed para o YouTube
    let finalUrl = song.url || '';
    const idMatch = finalUrl.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|shorts\/)([^&?#/ ]+)/);
    if (idMatch) {
        finalUrl = `https://www.youtube.com/embed/${idMatch[1]}`;
    }

    const mTitle = document.getElementById('modalTitle');
    const mArtist = document.getElementById('modalArtist');
    const mObs = document.getElementById('modalObs');
    
    if (mTitle) mTitle.textContent = song.title;
    if (mArtist) mArtist.textContent = song.artist || 'Vários';
    if (mObs) mObs.textContent = song.obs ? `Obs: ${song.obs}` : '';
    
    if (videoIframe) videoIframe.src = finalUrl;
    if (modal) modal.style.display = 'block';

    // Resetar painéis
    const setlistPanel = document.getElementById('setlistEditorPanel');
    if (setlistPanel) setlistPanel.style.display = 'none';

    window._modalCurrentSong = song;
    if (typeof window._fillScalingMenu === 'function') window._fillScalingMenu();

    // ── Abas Vocal/Músico + botão Ver Letra no modal ──────────────────
    const modalPerf = document.getElementById('modalPerfTabs');
    const perfBtn   = document.getElementById('modalOpenPerfBtn');
    const hasCifra  = song.cifra_text && song.cifra_text.trim().length > 10;
    if (modalPerf) {
        modalPerf.style.display = hasCifra ? 'flex' : 'none';
        modalPerf.querySelectorAll('.modal-perf-btn').forEach(b => b.classList.remove('active'));
        const vocalBtn = modalPerf.querySelector('[data-mode="vocal"]');
        if (vocalBtn) vocalBtn.classList.add('active');
    }
    if (perfBtn) perfBtn.style.display = hasCifra ? 'block' : 'none';
    window._modalCurrentSong = song;

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

    // Resetar zona de exclusão
    const deleteConfirmStep = document.getElementById('deleteConfirmStep');
    if (deleteConfirmStep) deleteConfirmStep.style.display = 'none';

    // ── Preencher checkboxes de categorias ──────────────────────────────
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

    // ── Botão Editar Versão (toggle painel) ─────────────────────────────
    const editBtn = document.getElementById('editUrlBtn');
    editBtn.onclick = () => {
        const isVisible = urlEditorPanel.style.display !== 'none';
        urlEditorPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            newUrlInput.focus();
            // Preencher campos de cifra se existirem
            const editCifraText = document.getElementById('editCifraText');
            if (editCifraText) editCifraText.value = song.cifra_text || '';
            
            const editCifraUrl = document.getElementById('editCifraClubUrl');
            if (editCifraUrl) editCifraUrl.value = song.cifraclub_url || '';
            
            const trigger = document.getElementById('editCaptureKeyTrigger');
            const container = document.getElementById('editCaptureKeyGrid');
            if (container && song.cifra_text) {
                let tomInicial = "C";
                const tomMatch = song.cifra_text.match(/^(?:Tom:\s*)([A-G][b#]?m?)/im);
                if (tomMatch) tomInicial = tomMatch[1];
                
                if (trigger) {
                    trigger.textContent = tomInicial;
                    trigger.dataset.key = tomInicial;
                    trigger.dataset.initialKey = tomInicial;
                }

                container.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
                const normTom = normalizeKey(tomInicial).replace(/m$/i, '');
                const activeBtn = Array.from(container.querySelectorAll('.key-btn')).find(b => b.dataset.key === normTom);
                if (activeBtn) activeBtn.classList.add('active');
            }
        }
    };

    // ── Botão Capturar na Edição ────────────────────────────────────────
    const btnCapturarEdit = document.getElementById('btnCapturarCifraEdit');
    if (btnCapturarEdit) {
        btnCapturarEdit.onclick = async () => {
            const url = document.getElementById('editCifraClubUrl').value.trim();
            if (!url) { alert('Insira o link primeiro!'); return; }
            
            btnCapturarEdit.textContent = 'Capturando...';
            const content = await fetchCifraClubContent(url);
            if (content) {
                let finalContent = content;
                let tomInicial = "C";
                const tomMatch = finalContent.match(/^(?:Tom:\s*)([A-G][b#]?m?)/im);
                if (tomMatch) {
                    tomInicial = tomMatch[1];
                } else {
                    let detected = detectFormaKey(finalContent);
                    if (detected) {
                        const capoMatch = finalContent.match(/Capotraste na (\d+)ª casa/i);
                        if (capoMatch) {
                            const capo = parseInt(capoMatch[1]);
                            const fIdx = SCALE.indexOf(normalizeKey(detected).replace(/m$/i, ''));
                            if (fIdx !== -1) {
                                const quality = detected.toLowerCase().endsWith('m') ? 'm' : '';
                                detected = SCALE[(fIdx + capo) % 12] + quality;
                            }
                        }
                        tomInicial = detected;
                    }
                    finalContent = `Tom: ${tomInicial}\n\n` + finalContent;
                }
                
                document.getElementById('editCifraText').value = finalContent;
                
                const trigger = document.getElementById('editCaptureKeyTrigger');
                if (trigger) {
                    trigger.textContent = tomInicial;
                    trigger.dataset.key = tomInicial;
                    trigger.dataset.initialKey = tomInicial;
                }
                
                const container = document.getElementById('editCaptureKeyGrid');
                if (container) {
                    container.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
                    const normTom = normalizeKey(tomInicial).replace(/m$/i, '');
                    const activeBtn = Array.from(container.querySelectorAll('.key-btn')).find(b => b.dataset.key === normTom);
                    if (activeBtn) activeBtn.classList.add('active');
                }
                
                alert('✅ Conteúdo capturado! Não esqueça de salvar.');
            }
            btnCapturarEdit.textContent = 'Capturar';
        };
    }

    // ── Fechar painel ───────────────────────────────────────────────────
    document.getElementById('cancelUrlBtn').onclick = () => {
        urlEditorPanel.style.display = 'none';
    };

    // ── Salvar URL ──────────────────────────────────────────────────────
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

    // ── Salvar Letra/Cifra ──────────────────────────────────────────────
    const saveCifraBtn = document.getElementById('saveCifraBtn');
    if (saveCifraBtn) {
        saveCifraBtn.onclick = async () => {
            const rawText = document.getElementById('editCifraText').value;
            const cifraUrl = document.getElementById('editCifraClubUrl').value.trim();
            const btn = document.getElementById('saveCifraBtn');
            btn.textContent = 'Salvando...';

            try {
                const { error } = await _supabase.from('songs')
                    .update({ 
                        cifra_text: rawText,
                        cifraclub_url: cifraUrl 
                    })
                    .eq('id', song.id);
                if (error) throw error;
                song.cifra_text = rawText;
                song.cifraclub_url = cifraUrl;
                alert('✅ Dados salvos com sucesso!');
            } catch (err) {
                alert('Erro ao salvar: ' + err.message);
            } finally {
                btn.innerHTML = '<i class="fas fa-save"></i> Salvar Letra/Cifra';
            }
        };
    }

    // ── Salvar Nome do Louvor ────────────────────────────────────────────
    document.getElementById('saveTitleBtn').onclick = async () => {
        const newTitle = newTitleInput.value.trim();
        if (!newTitle) { alert('Digite o nome do louvor!'); return; }
        if (newTitle === song.title) { alert('O nome não foi alterado.'); return; }

        const btn = document.getElementById('saveTitleBtn');
        btn.textContent = 'Salvando...';
        try {
            // Usa song.id para não depender do título atual como chave de busca
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

    // ── Salvar Observações ──────────────────────────────────────────────────
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
                .insert({ 
                    title: trimmedTitle, 
                    artist: trimmedArtist, 
                    obs,
                    url: url ? `https://www.youtube.com/embed/${vidId}` : null, 
                    vid_id: vidId, 
                    categories: checkedCats,
                    status: checkedCats.includes('Novos') ? 'NOVA' : '',
                    cifraclub_url: document.getElementById('addCifraClubUrl').value.trim(),
                    cifra_text: document.getElementById('addCifraTextPreview').value || null
                });
        
            document.getElementById('addCifraTextPreview').value = ''; 
            document.getElementById('addCifraPreviewContainer').style.display = 'none';

            if (error) throw error;
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
    const cronoCont = document.getElementById('cronogramaContainer');
    if(cronoCont) cronoCont.style.display = 'none';
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
    const cronoCont = document.getElementById('cronogramaContainer');
    if(cronoCont) cronoCont.style.display = 'none';
};
document.getElementById('cronogramaNav').onclick = (e) => {
    e.preventDefault();
    document.getElementById('hero').style.display = 'none';
    categoriesContainer.style.display = 'none';
    searchResultsGrid.style.display = 'none';
    categoryOverlay.style.display = 'none';
    const teamsCont = document.getElementById('teamsContainer');
    if(teamsCont) teamsCont.style.display = 'none';
    
    document.getElementById('cronogramaContainer').style.display = 'block';
    
    // Configurar filtros para o mês atual se vazios
    const mFilter = document.getElementById('monthFilter');
    const yFilter = document.getElementById('yearFilter');
    if (mFilter && !mFilter.value) {
        const now = new Date();
        mFilter.value = now.getMonth();
        yFilter.value = now.getFullYear();
    }
    
    // Ajustar visibilidade de botões ADM
    const canManage = isMaster();
    if (document.getElementById('addEventBtn')) document.getElementById('addEventBtn').style.display = canManage ? 'inline-block' : 'none';
    if (document.getElementById('generateDefaultMonthBtn')) document.getElementById('generateDefaultMonthBtn').style.display = canManage ? 'inline-block' : 'none';
    if (document.getElementById('clearMonthBtn')) document.getElementById('clearMonthBtn').style.display = canManage ? 'inline-block' : 'none';
    if (document.getElementById('exportCronogramaBtn')) document.getElementById('exportCronogramaBtn').style.display = canManage ? 'inline-block' : 'none';

    loadCronograma();
};

function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
}

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
    const cronoCont = document.getElementById('cronogramaContainer');
    if(cronoCont) cronoCont.style.display = 'none';
    document.getElementById('teamsContainer').style.display = 'block';
    
    const activeTeam = sessionStorage.getItem(TEAM_KEY);
    const TS = document.getElementById('teamSelector');
    if(activeTeam && activeTeam !== 'Master' && !TS.value) {
        TS.value = activeTeam;
    }
    if (!TS.value && TS.options.length > 0) TS.value = TS.options[0].value;

    const currentTeam = TS.value;
    if(currentTeam) {
        applyTeamColorToSelector(currentTeam);
        syncTeamButtons(currentTeam);
        loadSetlist(currentTeam);
        document.getElementById('teamSubTabs').style.display = 'flex';
    }
};

// Eventos das Sub-Abas de Equipe
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPerformanceMode = e.target.dataset.mode;
        
        // Se a tela de performance estiver aberta, atualize a view em tempo real
        const screen = document.getElementById('performanceScreen');
        if (screen && screen.style.display === 'flex') {
            const keyControlGroup = document.getElementById('keyControlGroup');
            const capoGrp = document.getElementById('capoControlGroup');
            if (currentPerformanceMode === 'vocal') {
                screen.classList.add('vocal-mode');
                if (keyControlGroup) keyControlGroup.style.display = 'none';
                if (capoGrp) capoGrp.style.display = 'none';
            } else {
                screen.classList.remove('vocal-mode');
                if (keyControlGroup) keyControlGroup.style.display = 'flex';
                // Mostrar capo só se a música tiver capotraste
                const capoDisp = document.getElementById('perfCapoDisplay');
                const hasCapo = capoDisp && parseInt(capoDisp.dataset.capo || 0) > 0;
                if (capoGrp) capoGrp.style.display = hasCapo ? 'flex' : 'none';
            }
            renderPerformanceContent();
        }

        const TS = document.getElementById('teamSelector');
        if (TS.value) loadSetlist(TS.value);
    };
});

document.getElementById('teamSelector').onchange = (e) => {
    const teamName = e.target.value;
    applyTeamColorToSelector(teamName);
    syncTeamButtons(teamName);
    loadSetlist(teamName);
    document.getElementById('teamSubTabs').style.display = 'flex';
};

async function loadSetlist(teamName) {
    const grid = document.getElementById('teamSetlistGrid');
    grid.style.display = 'grid';
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Carregando escala...</p>';

    const loggedTeam = sessionStorage.getItem(TEAM_KEY);
    const auth = sessionStorage.getItem(AUTH_KEY) === 'true';
    const isAdmin = auth && (loggedTeam === 'Master' || loggedTeam === teamName);
    const actions = document.getElementById('teamAdminActions');
    const status = document.getElementById('teamAdminStatus');

    if (isAdmin) {
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
            .order('position', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true });
            
        if(error) throw error;

        grid.innerHTML = '';
        if(!data || data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ccc;">Nenhum louvor escalado para esta equipe.</p>';
            return;
        }

        // Guarda lista para navegação Próximo na performance (com tom/capo da escala)
        _setlistSongs = data.map(setItem => {
            for (const cat of repertoireData) {
                const found = cat.items.find(s => s.title === setItem.song_title);
                if (found) return {
                    ...found,
                    obs: setItem.obs || null,
                    _setlistTomKey:  setItem.tom_key  || null,
                    _setlistCapoFret: setItem.capo_fret != null ? setItem.capo_fret : null
                };
            }
            return null;
        }).filter(Boolean);

        data.forEach((setItem, idx) => {
            let originalSong = null;
            for(const cat of repertoireData) {
                const found = cat.items.find(s => s.title === setItem.song_title);
                if(found) { originalSong = found; break; }
            }

            const songForCard = originalSong
                ? { ...originalSong, obs: setItem.obs }
                : { title: setItem.song_title, artist: 'Excluída da base', obs: setItem.obs, url: '' };

            const card = createSongCard(songForCard);
            card.classList.add('setlist-card');
            card.dataset.setlistId = setItem.id;

            // Número de ordem
            const posBadge = document.createElement('span');
            posBadge.className = 'setlist-pos-badge';
            posBadge.textContent = idx + 1;
            card.prepend(posBadge);

            if (setItem.obs) {
                const infoDiv = card.querySelector('.card-info');
                if (infoDiv) infoDiv.innerHTML += `<p class="setlist-obs">[ ${setItem.obs} ]</p>`;
            }

            // Mostra tom e capo definidos pelo ADM no card
            const infoDiv = card.querySelector('.card-info');
            if (infoDiv) {
                const tomLabel  = setItem.tom_key ? setItem.tom_key : 'Original';
                const capoLabel = (setItem.capo_fret && setItem.capo_fret > 0) ? `Capo ${setItem.capo_fret}` : 'S/Capo';
                infoDiv.innerHTML += `<p class="setlist-obs" style="color:#f5c842;">[ Tom ${tomLabel} · ${capoLabel} ]</p>`;
            }

            // Clique abre direto a tela de performance no modo já selecionado (Vocal/Músico)
            card.onclick = (e) => {
                if (e.target.closest('.drag-handle')) return;
                if (originalSong) {
                    _setlistIndex = _setlistSongs.findIndex(s => s.title === originalSong.title);
                    const songWithSetlistConfig = {
                        ...originalSong,
                        _setlistTomKey:   setItem.tom_key   || null,
                        _setlistCapoFret: setItem.capo_fret != null ? setItem.capo_fret : null
                    };
                    openPerformance(songWithSetlistConfig, currentPerformanceMode);
                }
            };

            // ADM: drag-to-reorder + botão X para remover da escala
            if (isAdmin) {
                const handle = document.createElement('span');
                handle.className = 'drag-handle';
                handle.innerHTML = '<i class="fas fa-grip-lines"></i>';
                card.prepend(handle);
                card.setAttribute('draggable', 'true');
                card.addEventListener('dragstart', _onDragStart);
                card.addEventListener('dragover',  _onDragOver);
                card.addEventListener('drop',       _onDrop);
                card.addEventListener('dragend',    _onDragEnd);

                // Botão X para remover música individual da escala
                const removeBtn = document.createElement('button');
                removeBtn.className = 'setlist-card-remove-btn';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.title = 'Remover da escala';
                removeBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Remover "${setItem.song_title}" da escala?`)) return;
                    const { error } = await _supabase.from('setlists').delete().eq('id', setItem.id);
                    if (!error) {
                        card.remove();
                        // Atualiza lista de navegação
                        _setlistSongs = _setlistSongs.filter(s => s.title !== setItem.song_title);
                    } else {
                        alert('Erro ao remover: ' + error.message);
                    }
                };
                card.appendChild(removeBtn);
            }

            grid.appendChild(card);
        });

        updateTeamBadges();
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="grid-column: 1/-1; color:red; text-align:center;">Erro ao carregar escala.</p>';
    }
}

// addToSetlistBtn handler → movido para DOMContentLoaded

// Detecta e preenche tom/capo originais da música no painel de escalar
function _populateSetlistTomCapo() {
    const tomSelect  = document.getElementById('setlistTomSelect');
    const capoSelect = document.getElementById('setlistCapoSelect');
    if (!tomSelect || !capoSelect) return;

    // Pega a música atual aberta no modal
    const song = window._modalCurrentSong;
    if (!song) return;

    const textContent = song.cifra_text || '';

    // Detecta tom
    let detectedKey = '';
    let detectedCapo = 0;

    const tomLineMatch = textContent.match(/^Tom:\s*(.+)$/im);
    const capoMatchTxt = textContent.match(/Capotraste\s+na\s+(\d+)[aª°]?\s*casa/i);
    detectedCapo = capoMatchTxt ? parseInt(capoMatchTxt[1]) : 0;

    if (tomLineMatch) {
        const tomLine = tomLineMatch[1].trim();
        const tomReal = tomLine.match(/^([A-G][b#]?)/);
        if (tomReal) detectedKey = tomReal[1];
    } else {
        // Detecta pelo primeiro acorde puro após seção não-intro
        const lines = textContent.split('\n');
        let passedIntro = false;
        for (const line of lines) {
            const t = line.trim();
            if (!t || /^(Tom|Capotraste|Parte|Tab)/i.test(t)) continue;
            if (/^\[.+\]/.test(t)) {
                passedIntro = !/^\[(Intro|Tab|Instrumen)/i.test(t);
                continue;
            }
            const tokens = t.split(/\s+/).filter(Boolean);
            const allChords = tokens.every(tk =>
                /^[A-G][b#]?(?:m(?:aj|in)?|maj|dim|aug|sus|add|min|°|ø|-)?-?(?:\d{1,2})?(?:M)?(?:[+])?(?:\((?:[b#]?\d+[+\-]?(?:\/[b#]?\d+[+\-]?)*)\))?(?:\/[A-G][b#]?(?:\d{0,2})?)?$/.test(tk)
            );
            if (allChords && tokens.length > 0) {
                const formaKey = tokens[0].split('/')[0];
                if (detectedCapo > 0) {
                    const idx = SCALE.indexOf(normalizeKey(formaKey));
                    if (idx !== -1) detectedKey = SCALE[(idx + detectedCapo) % 12];
                } else {
                    detectedKey = formaKey;
                }
                if (passedIntro) break;
            }
        }
    }

    // Popula o select de tom com todas as notas
    tomSelect.innerHTML = '';
    SCALE.forEach(note => {
        const opt = document.createElement('option');
        opt.value = note;
        opt.textContent = note;
        if (note === (detectedKey || SCALE[0])) opt.selected = true;
        tomSelect.appendChild(opt);
    });

    // Pré-seleciona o capo original
    capoSelect.value = String(detectedCapo);
}

// ─── cancelSetlistBtn, saveSetlistBtn, clearSetlistBtn → movidos para DOMContentLoaded ───


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

// 1. Atualizar ao voltar para o app — só se passou mais de 3 min (evita lentidão)
let _lastFetchTime = 0;
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - _lastFetchTime > 180000) {
            _lastFetchTime = now;
            fetchData();
        }
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

// Função para o vídeo do Banner Principal (Hero)
window.openHeroVideo = function() {
    // Abre a primeira música da lista como destaque ou um vídeo padrão
    if (repertoireData.length > 0 && repertoireData[0].items.length > 0) {
        openVideo(repertoireData[0].items[0]);
    } else {
        alert("Nenhum vídeo disponível no momento.");
    }
};

// Inicialização segura
// ── syncTeamButtons ──────────────────────────────────────────────────
function syncTeamButtons(teamName) {
    document.querySelectorAll('.team-btn').forEach(btn => {
        btn.classList.toggle('team-btn-active', btn.dataset.team === teamName);
    });
}

// ── Team Buttons visuais ──────────────────────────────────────────────
document.getElementById('teamBtnGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.team-btn');
    if (!btn) return;
    const teamName = btn.dataset.team;
    const TS = document.getElementById('teamSelector');
    if (!TS.querySelector(`option[value="${teamName}"]`)) {
        const opt = document.createElement('option');
        opt.value = teamName; opt.textContent = teamName;
        TS.appendChild(opt);
    }
    TS.value = teamName;
    syncTeamButtons(teamName);
    applyTeamColorToSelector(teamName);
    loadSetlist(teamName);
    document.getElementById('teamSubTabs').style.display = 'flex';
});

// ── Wake Lock ─────────────────────────────────────────────────────────
let _wakeLock = null;
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => { _wakeLock = null; _updateWakeLockUI(); });
        _updateWakeLockUI();
    } catch(e) {}
}
async function releaseWakeLock() {
    if (_wakeLock) { await _wakeLock.release(); _wakeLock = null; }
    _updateWakeLockUI();
}
function _updateWakeLockUI() {
    const active = !!_wakeLock;
    ['teamWakeLockBtn','modalLiveBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('wake-lock-active', active);
    });
}
document.getElementById('teamWakeLockBtn').addEventListener('click', () => {
    _wakeLock ? releaseWakeLock() : requestWakeLock();
});
document.addEventListener('visibilitychange', () => {
    if (_wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
});

// ── Drag-to-Reorder ───────────────────────────────────────────────────
let _dragSrc = null;
function _onDragStart(e) { _dragSrc = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function _onDragOver(e) { e.preventDefault(); document.querySelectorAll('.setlist-card').forEach(c => c.classList.remove('drag-over')); this.classList.add('drag-over'); }
function _onDrop(e) {
    e.preventDefault();
    if (_dragSrc && _dragSrc !== this) {
        const cards = [...document.querySelectorAll('#teamSetlistGrid .setlist-card')];
        const si = cards.indexOf(_dragSrc), di = cards.indexOf(this);
        const grid = document.getElementById('teamSetlistGrid');
        if (si < di) grid.insertBefore(_dragSrc, this.nextSibling);
        else grid.insertBefore(_dragSrc, this);
        _saveSetlistOrder();
    }
}
function _onDragEnd() { document.querySelectorAll('.setlist-card').forEach(c => c.classList.remove('dragging','drag-over')); _dragSrc = null; }
async function _saveSetlistOrder() {
    const cards = [...document.querySelectorAll('#teamSetlistGrid .setlist-card')];
    cards.forEach((c, i) => { const b = c.querySelector('.setlist-pos-badge'); if(b) b.textContent = i+1; });
    for (const [i, c] of cards.entries()) {
        await _supabase.from('setlists').update({ position: i + 1 }).eq('id', parseInt(c.dataset.setlistId));
    }
    // Sincroniza a lista interna global para o compartilhamento respeitar a nova ordem imediatamente
    const TS = document.getElementById('teamSelector');
    if (TS && TS.value) {
        const teamName = TS.value;
        const { data } = await _supabase
            .from('setlists')
            .select('*')
            .eq('team', teamName)
            .order('position', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true });
        
        if (data) {
            _setlistSongs = data.map(setItem => {
                for (const cat of repertoireData) {
                    const found = cat.items.find(s => s.title === setItem.song_title);
                    if (found) return {
                        ...found,
                        obs: setItem.obs || null,
                        _setlistTomKey:  setItem.tom_key  || null,
                        _setlistCapoFret: setItem.capo_fret != null ? setItem.capo_fret : null
                    };
                }
                return null;
            }).filter(Boolean);
        }
    }
}

// ── Badge de contagem nos botões de equipe ────────────────────────────
async function updateTeamBadges() {
    const teams = ['Start','Amarelo','Laranja','Azul','Verde','Branco'];
    for (const team of teams) {
        try {
            const { data } = await _supabase.from('setlists').select('id').eq('team', team);
            const count = (data || []).length;
            const btn = document.querySelector(`.team-btn[data-team="${team}"]`);
            if (!btn) continue;
            let badge = btn.querySelector('.team-count-badge');
            if (count > 0) {
                if (!badge) { badge = document.createElement('span'); badge.className = 'team-count-badge'; btn.appendChild(badge); }
                badge.textContent = count;
            } else if (badge) { badge.remove(); }
        } catch(_) {}
    }
}

// ── Controles de Fonte ────────────────────────────────────────────────
function applyFontSize(size) {
    currentFontSize = Math.max(10, Math.min(28, size));
    const c = document.getElementById('performanceContent');
    // O CSS usa var(--perf-font-size) !important nas .perf-line,
    // então precisamos setar a CSS variable, não o font-size do container
    if (c) c.style.setProperty('--perf-font-size', currentFontSize + 'px');
    const lbl = document.getElementById('fontSizeLabel');
    if (lbl) lbl.textContent = currentFontSize;
}
document.getElementById('fontIncrease').addEventListener('click', () => applyFontSize(currentFontSize + 1));
document.getElementById('fontDecrease').addEventListener('click', () => applyFontSize(currentFontSize - 1));

window.addEventListener('DOMContentLoaded', () => {
    _lastFetchTime = Date.now();
    fetchData();
    setTimeout(updateTeamBadges, 1500);

    // Lógica para abrir escala direto via link (?team=NOME)
    const urlParams = new URLSearchParams(window.location.search);
    const teamParam = urlParams.get('team');
    if (teamParam) {
        setTimeout(() => {
            const TS = document.getElementById('teamSelector');
            const teamsNav = document.getElementById('teamsNav');
            if (TS && teamsNav) {
                // Verificar se a equipe existe nas opções
                const exists = Array.from(TS.options).some(opt => opt.value === teamParam);
                if (exists) {
                    TS.value = teamParam;
                    teamsNav.click(); // Dispara a abertura da aba e carregamento da escala
                }
            }
        }, 800); // Pequeno delay para garantir que o Supabase/Data já responderam
    }

    // ── Capotraste popup ──────────────────────────────────────────────
    const capoDisplay = document.getElementById('perfCapoDisplay');
    const capoGrid = document.getElementById('capoSelectorGrid');

    if (capoDisplay && capoGrid) {
        capoDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            capoGrid.style.display = capoGrid.style.display === 'none' ? 'block' : 'none';
            document.getElementById('keySelectorGrid').style.display = 'none';
        });

        capoGrid.querySelectorAll('.capo-btn-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const novaCasa = parseInt(btn.dataset.capo);
                const keyEl    = document.getElementById('perfKeyDisplay');
                const formaKey = keyEl.dataset.original || 'C';

                capoDisplay.dataset.capo = novaCasa;
                const capoText = document.getElementById('perfCapoText');
                if (capoText) capoText.textContent = novaCasa === 0 ? 'S/Capo' : `${novaCasa}ª casa`;
                capoGrid.querySelectorAll('.capo-btn-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                capoGrid.style.display = 'none';

                // Tom real = notas atuais + capo semitones
                const fIdx = SCALE.indexOf(normalizeKey(formaKey));
                if (fIdx !== -1) {
                    const notasAtuaisIdx = (fIdx + currentTransposeSemitones + 12) % 12;
                    keyEl.textContent = novaCasa === 0
                        ? SCALE[(fIdx + currentTransposeSemitones + 12) % 12]
                        : SCALE[(notasAtuaisIdx + novaCasa) % 12];
                }

                renderPerformanceContent();
            });
        });
    }

    document.addEventListener('click', (e) => {
        if (capoGrid && !capoGrid.contains(e.target) && e.target !== capoDisplay) {
            capoGrid.style.display = 'none';
        }
    });
    // ─────────────────────────────────────────────────────────────────

    // Botão AO VIVO no modal
    const modalLiveBtn = document.getElementById('modalLiveBtn');
    if (modalLiveBtn) modalLiveBtn.addEventListener('click', () => { _wakeLock ? releaseWakeLock() : requestWakeLock(); });

    // Botão Ver Letra / Cifra no modal
    const modalOpenPerfBtn = document.getElementById('modalOpenPerfBtn');
    if (modalOpenPerfBtn) {
        modalOpenPerfBtn.onclick = () => {
            if (!window._modalCurrentSong) return;
            const activeBtn = document.querySelector('.modal-perf-btn[data-mode].active');
            const mode = activeBtn ? activeBtn.dataset.mode : 'vocal';
            const currentSrc = videoIframe.src;
            modal.style.display = 'none';
            videoIframe.src = '';
            openPerformance(window._modalCurrentSong, mode);
            // Transfere player para tela de performance
            if (currentSrc && currentSrc !== 'about:blank' && currentSrc !== '') {
                const perfIframe = document.getElementById('perfPlayerIframe');
                const perfWrapper = document.getElementById('perfPlayerWrapper');
                const perfToggleBtn = document.getElementById('perfPlayerToggle');
                if (perfIframe) perfIframe.src = currentSrc;
                if (perfWrapper) perfWrapper.style.display = 'none';
                // toggle já configurado no openPerformance
            }
        };
    }

    // Abas Vocal/Músico no modal
    document.querySelectorAll('.modal-perf-btn[data-mode]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal-perf-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Botões ADM na performance — abrem o modal com a música atual
    const perfAddToSetlistBtn = document.getElementById('perfAddToSetlistBtn');
    const perfEditBtn = document.getElementById('perfEditBtn');

    if (perfAddToSetlistBtn) {
        perfAddToSetlistBtn.onclick = () => {
            if (!currentPerformanceSong) return;
            // Fecha performance, abre modal da música com painel de escala
            document.getElementById('performanceScreen').style.display = 'none';
            document.body.style.overflow = '';
            openVideo(currentPerformanceSong);
            // Abre o painel de escala automaticamente
            setTimeout(() => {
                const setlistPanel = document.getElementById('setlistEditorPanel');
                if (setlistPanel) setlistPanel.style.display = 'block';
            }, 300);
        };
    }

    if (perfEditBtn) {
        perfEditBtn.onclick = () => {
            if (!currentPerformanceSong) return;
            // Fecha performance, abre modal com painel de edição
            document.getElementById('performanceScreen').style.display = 'none';
            document.body.style.overflow = '';
            openVideo(currentPerformanceSong);
            setTimeout(() => {
                const editPanel = document.getElementById('urlEditorPanel');
                if (editPanel) editPanel.style.display = 'block';
            }, 300);
        };
    }

    // Botão X — fechar performance
    const closePerfBtn = document.getElementById('closePerfBtn');
    if (closePerfBtn) closePerfBtn.onclick = () => {
        document.getElementById('performanceScreen').style.display = 'none';
        document.body.style.overflow = '';
        stopAutoScroll();
    };

    // Botão Anterior
    const prevPerfBtn = document.getElementById('prevPerfBtn');
    if (prevPerfBtn) prevPerfBtn.onclick = () => {
        if (_setlistIndex <= 0 || _setlistSongs.length === 0) return;
        _setlistIndex--;
        openPerformance(_setlistSongs[_setlistIndex], currentPerformanceMode);
    };

    // Botão Próximo
    const nextPerfBtn = document.getElementById('nextPerfBtn');
    if (nextPerfBtn) nextPerfBtn.onclick = () => {
        if (_setlistIndex < 0 || _setlistSongs.length === 0) return;
        if (_setlistIndex + 1 < _setlistSongs.length) {
            _setlistIndex++;
            openPerformance(_setlistSongs[_setlistIndex], currentPerformanceMode);
        }
    };

    // Botões Vocal/Músicos na tela de performance
    document.querySelectorAll('.perf-mode-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.perf-mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPerformanceMode = btn.dataset.mode;

            const isMusician = currentPerformanceMode === 'musician';
            const screen = document.getElementById('performanceScreen');

            // Atualiza classe vocal-mode no screen (controla CSS das cifras)
            if (isMusician) {
                screen.classList.remove('vocal-mode');
            } else {
                screen.classList.add('vocal-mode');
            }

            // Tom e Capo: visíveis só no modo músico
            const keyGroup  = document.getElementById('keyControlGroup');
            const capoGroup = document.getElementById('capoControlGroup');
            if (keyGroup)  keyGroup.style.display  = isMusician ? 'flex' : 'none';
            if (capoGroup) capoGroup.style.display  = isMusician ? 'flex' : 'none';

            renderPerformanceContent();
        });
    });

    // Botão Ao Vivo (WakeLock) na tela de performance
    const perfWakeLockBtn = document.getElementById('perfWakeLockBtn');
    let _perfWakeLock = null;
    if (perfWakeLockBtn) {
        perfWakeLockBtn.addEventListener('click', async () => {
            if (_perfWakeLock) {
                await _perfWakeLock.release();
                _perfWakeLock = null;
                perfWakeLockBtn.classList.remove('wakelock-on');
            } else {
                try {
                    _perfWakeLock = await navigator.wakeLock.request('screen');
                    perfWakeLockBtn.classList.add('wakelock-on');
                    _perfWakeLock.addEventListener('release', () => {
                        _perfWakeLock = null;
                        perfWakeLockBtn.classList.remove('wakelock-on');
                    });
                } catch (e) {
                    console.warn('WakeLock não disponível:', e);
                }
            }
        });
    }

    // Botão Escalar — abre painel e pré-preenche tom/capo da música
    // --- Lógica de Seleção de Tom/Capo na Escala (Grade Pro) ---
    function initSetlistGrids() {
        const keyGrid = document.getElementById('setlistKeyGridItems');
        const capoGrid = document.getElementById('setlistCapoGridItems');
        if (!keyGrid || !capoGrid) return;

        // Popular Tons
        keyGrid.innerHTML = '';
        SCALE.forEach(note => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'key-btn';
            btn.textContent = note;
            btn.dataset.key = note;
            btn.onclick = () => {
                const display = document.getElementById('setlistTomDisplay');
                const quality = display.dataset.quality || '';
                display.textContent = note + quality;
                display.dataset.key = note;
                document.querySelectorAll('#setlistKeyGrid .key-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('setlistKeyGrid').style.display = 'none';
            };
            keyGrid.appendChild(btn);
        });

        // Popular Capo (0 a 12)
        capoGrid.innerHTML = '';
        for (let i = 0; i <= 12; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'capo-btn-item';
            btn.textContent = i === 0 ? 'S/Capo' : i + 'ª';
            btn.dataset.capo = i;
            btn.onclick = () => {
                const display = document.getElementById('setlistCapoDisplay');
                display.textContent = i === 0 ? 'S/Capo' : i + 'ª casa';
                display.dataset.capo = i;
                document.querySelectorAll('#setlistCapoGrid .capo-btn-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('setlistCapoGrid').style.display = 'none';
            };
            capoGrid.appendChild(btn);
        }
    }

    // Handlers para os popups da escala
    const setlistTomDisplay = document.getElementById('setlistTomDisplay');
    const setlistCapoDisplay = document.getElementById('setlistCapoDisplay');
    const setlistKeyGrid = document.getElementById('setlistKeyGrid');
    const setlistCapoGrid = document.getElementById('setlistCapoGrid');

    if (setlistTomDisplay) {
        setlistTomDisplay.onclick = (e) => {
            e.stopPropagation();
            setlistKeyGrid.style.display = setlistKeyGrid.style.display === 'none' ? 'block' : 'none';
            setlistCapoGrid.style.display = 'none';
        };
    }

    if (setlistCapoDisplay) {
        setlistCapoDisplay.onclick = (e) => {
            e.stopPropagation();
            setlistCapoGrid.style.display = setlistCapoGrid.style.display === 'none' ? 'block' : 'none';
            setlistKeyGrid.style.display = 'none';
        };
    }

    // Fechar popups ao clicar fora
    document.addEventListener('click', (e) => {
        if (setlistKeyGrid && !setlistKeyGrid.contains(e.target) && e.target !== setlistTomDisplay) {
            setlistKeyGrid.style.display = 'none';
        }
        if (setlistCapoGrid && !setlistCapoGrid.contains(e.target) && e.target !== setlistCapoDisplay) {
            setlistCapoGrid.style.display = 'none';
        }
    });

    // Meio tom +/- na escala
    function shiftSetlistKey(steps) {
        const display = document.getElementById('setlistTomDisplay');
        const currentKey = display.dataset.key || 'C';
        const quality = display.dataset.quality || '';
        const idx = SCALE.indexOf(normalizeKey(currentKey));
        if (idx === -1) return;
        const nextIdx = (idx + steps + 12) % 12;
        const nextKey = SCALE[nextIdx];
        display.dataset.key = nextKey;
        display.textContent = nextKey + quality;
        
        // Atualiza botões ativos
        document.querySelectorAll('#setlistKeyGrid .key-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.key === nextKey);
        });
    }

    const setlistStepUp = document.getElementById('setlistStepUp');
    const setlistStepDown = document.getElementById('setlistStepDown');
    const setlistRestoreKey = document.getElementById('setlistRestoreKey');

    if (setlistStepUp) setlistStepUp.onclick = () => shiftSetlistKey(1);
    if (setlistStepDown) setlistStepDown.onclick = () => shiftSetlistKey(-1);
    if (setlistRestoreKey) setlistRestoreKey.onclick = () => {
        const display = document.getElementById('setlistTomDisplay');
        const initial = display.dataset.initialKey || 'C';
        const initialQual = display.dataset.initialQuality || '';
        display.dataset.key = initial;
        display.dataset.quality = initialQual;
        display.textContent = initial + initialQual;
        document.querySelectorAll('#setlistKeyGrid .key-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.key === initial);
        });
    };

    // Função para preencher tom e capo no menu de escala
    function _fillScalingMenu() {
        const tomDisplay = document.getElementById('setlistTomDisplay');
        const capoDisplay = document.getElementById('setlistCapoDisplay');
        const song = window._modalCurrentSong;
        if (!tomDisplay || !song) return;

        let detKey = 'C', detQual = '', detCapo = 0;

        if (song.cifra_text) {
            const txt = song.cifra_text;
            
            // 1) Capo
            const cM = txt.match(/Capo\s*(\d+)/i) || txt.match(/Capotraste\s+na\s+(\d+)/i);
            if (cM) detCapo = parseInt(cM[1]);

            // 2) Tom
            let displayKey = null;
            const tomLineMatch = txt.match(/^Tom:\s*(.+)$/im);
            if (tomLineMatch) {
                const tomLine = tomLineMatch[1].trim();
                const tomRealMatch = tomLine.match(/^([A-G][b#]?m?)/i);
                if (tomRealMatch) displayKey = tomRealMatch[1];
            }

            if (!displayKey) {
                displayKey = typeof detectFormaKey === 'function' ? detectFormaKey(txt) : null;
                if (displayKey && detCapo > 0) {
                    const fQual = displayKey.toLowerCase().endsWith('m') ? 'm' : '';
                    const fRoot = normalizeKey(displayKey.replace(/m$/i, '').trim());
                    const fI = SCALE.indexOf(fRoot);
                    if (fI !== -1) {
                        displayKey = SCALE[(fI + detCapo) % 12] + fQual;
                    }
                }
            }

            if (displayKey) {
                detQual = displayKey.toLowerCase().endsWith('m') ? 'm' : '';
                detKey = normalizeKey(displayKey.replace(/m$/i, '').trim());
            }
        }

        // Atualiza UI da escala
        tomDisplay.dataset.key = detKey;
        tomDisplay.dataset.quality = detQual;
        tomDisplay.dataset.initialKey = detKey;
        tomDisplay.dataset.initialQuality = detQual;
        tomDisplay.textContent = detKey + detQual;

        capoDisplay.dataset.capo = detCapo;
        capoDisplay.textContent = detCapo === 0 ? 'S/Capo' : detCapo + 'ª casa';

        // Sincroniza botões ativos nos grids
        document.querySelectorAll('#setlistKeyGrid .key-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.key === detKey);
        });
        document.querySelectorAll('#setlistCapoGrid .capo-btn-item').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.capo) === detCapo);
        });
    }
    window._fillScalingMenu = _fillScalingMenu;
    initSetlistGrids(); // Inicializa as grades de botões

    const addToSetlistBtn = document.getElementById('addToSetlistBtn');
    if (addToSetlistBtn) {
        addToSetlistBtn.onclick = () => {
            const panel = document.getElementById('setlistEditorPanel');
            if (!panel) return;

            const isVisible = (panel.style.display === 'block');
            panel.style.display = isVisible ? 'none' : 'block';
            document.getElementById('urlEditorPanel').style.display = 'none';
            
            if (!isVisible) {
                const mObs = document.getElementById('modalObs').textContent.replace('Obs: ', '').trim();
                document.getElementById('setlistObsInput').value = mObs;
                _fillScalingMenu();
            }
        };
    }

    // Cancelar escala
    const cancelSetlistBtn = document.getElementById('cancelSetlistBtn');
    if (cancelSetlistBtn) {
        cancelSetlistBtn.onclick = () => {
            document.getElementById('setlistEditorPanel').style.display = 'none';
        };
    }

    // Salvar na escala
    const saveSetlistBtn = document.getElementById('saveSetlistBtn');
    if (saveSetlistBtn) {
        saveSetlistBtn.onclick = async () => {
            const songTitle = document.getElementById('modalTitle').textContent;
            const teamSelect = document.getElementById('setlistTeamSelect');
            const team = teamSelect ? teamSelect.value : null;
            const obs = document.getElementById('setlistObsInput').value.trim();

            if (!team) { alert('Selecione uma equipe!'); return; }

            saveSetlistBtn.textContent = 'Adicionando...';

            const tomDisplay = document.getElementById('setlistTomDisplay');
            const capoDisplay = document.getElementById('setlistCapoDisplay');
            const tomKey = tomDisplay ? tomDisplay.textContent : null;
            const capoFret = capoDisplay ? parseInt(capoDisplay.dataset.capo || 0) : 0;

            try {
                const { error } = await _supabase.from('setlists').insert([
                    { team, song_title: songTitle, obs, tom_key: tomKey, capo_fret: capoFret }
                ]);
                if (error) throw error;

                alert(`Adicionado com sucesso à escala do ${team}!`);
                document.getElementById('setlistEditorPanel').style.display = 'none';

                const teamsCont = document.getElementById('teamsContainer');
                const TS = document.getElementById('teamSelector');
                if (teamsCont && teamsCont.style.display !== 'none' && TS && TS.value === team) {
                    loadSetlist(team);
                }
            } catch(err) {
                alert('Erro ao adicionar à escala: ' + err.message);
            } finally {
                saveSetlistBtn.innerHTML = '<i class="fas fa-plus"></i> Confirmar na Escala';
            }
        };
    }



    // Compartilhar escala via WhatsApp
    const shareSetlistBtn = document.getElementById('shareSetlistBtn');
    if (shareSetlistBtn) {
        shareSetlistBtn.onclick = () => {
            const team = document.getElementById('teamSelector').value;
            if (!team || _setlistSongs.length === 0) {
                alert('Não há músicas na escala para compartilhar!');
                return;
            }

            // Emojis usando ES6 Unicode Literals
            const iconChurch = '\u{26EA}';     // ⛪
            const iconTeam   = '\u{1F465}';    // 👥
            const iconMic    = '\u{1F3A4}';    // 🎤
            const iconFolder = '\u{1F4C2}';    // 📂
            const iconPiano  = '\u{1F3B9}';    // 🎹
            const iconGuitar = '\u{1F3B8}';    // 🎸
            const iconObs    = '\u{1F4DD}';    // 📝
            const iconVideo  = '\u{1F3A5}';    // 🎥
            const iconLink   = '\u{1F4F2}';    // 📲

            let message = `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `  ${iconChurch} *IBB LOUVOR - ESCALA*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            message += `${iconTeam} *EQUIPE:* ${team.toUpperCase()}\n\n`;
            message += `──────────────────────\n\n`;

            _setlistSongs.forEach((song, idx) => {
                message += `*${idx + 1}. ${song.title}*\n`;
                
                if (song.artist) {
                    message += `${iconMic} ${song.artist}\n`;
                }

                if (song.categories && song.categories.length > 0) {
                    message += `${iconFolder} Categoria: ${song.categories.join(', ')}\n`;
                }

                let toneLine = `${iconPiano} Tom: ${song._setlistTomKey || 'Original'}`;
                if (song._setlistCapoFret && song._setlistCapoFret > 0) {
                    toneLine += ` | ${iconGuitar} Capo: ${song._setlistCapoFret}ª casa`;
                }
                message += toneLine + `\n`;

                if (song.obs) {
                    message += `${iconObs} Obs: ${song.obs}\n`;
                }

                // Adiciona link do YouTube se disponível
                if (song.vid_id) {
                    message += `${iconVideo} Vídeo: https://youtu.be/${song.vid_id}\n`;
                }

                message += `\n`;
            });

            // Detecta o link atual e adiciona a equipe para abertura direta
            const currentUrl = window.location.origin + window.location.pathname + `?team=${team}`;

            message += `──────────────────────\n`;
            message += `${iconLink} *Acesse com letra e cifra:* ${currentUrl}\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━`;

            const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        };
    }

    // Limpar escala
    const clearSetlistBtn = document.getElementById('clearSetlistBtn');
    if (clearSetlistBtn) {
        clearSetlistBtn.onclick = async () => {
            const team = document.getElementById('teamSelector').value;
            if (!team) return;
            if (!confirm(`⚠️ Tem certeza que deseja LIMPAR TODA A ESCALA do ${team}?`)) return;
            try {
                const { error } = await _supabase.from('setlists').delete().eq('team', team);
                if (error) throw error;
                alert(`A escala do ${team} foi limpa!`);
                loadSetlist(team);
            } catch(err) {
                alert('Erro ao limpar a escala: ' + err.message);
            }
        };
    }

    // ==========================================
    // INÍCIO DA LÓGICA DO CRONOGRAMA DIGITAL
    // ==========================================

    let currentCronograma = [];

    async function loadCronograma() {
        const grid = document.getElementById('cronogramaGrid');
        if (!grid) return;

        grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        const month = document.getElementById('monthFilter').value;
        const year = document.getElementById('yearFilter').value;
        const startDate = `${year}-${(parseInt(month)+1).toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${(parseInt(month)+1).toString().padStart(2, '0')}-31`;

        try {
            const { data, error } = await _supabase
                .from('app_scales')
                .select('*')
                .gte('event_date', startDate)
                .lte('event_date', endDate)
                .order('event_date', { ascending: true })
                .order('event_time', { ascending: true });

            if (error) throw error;
            currentCronograma = data || [];
            renderCronograma();
        } catch (err) {
            grid.innerHTML = '<div class="error-msg">Erro ao carregar cronograma. Verifique se a tabela "app_scales" existe.</div>';
            console.error(err);
        }
    }
    window.loadCronograma = loadCronograma;

    function renderCronograma() {
        const grid = document.getElementById('cronogramaGrid');
        grid.innerHTML = '';

        if (currentCronograma.length === 0) {
            grid.innerHTML = '<div class="empty-msg">Nenhum evento agendado para este mês.</div>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        currentCronograma.forEach(event => {
            const eventDate = new Date(event.event_date + 'T12:00:00');
            if (eventDate < today) return;

            const day = eventDate.getDate().toString().padStart(2, '0');
            const monthName = eventDate.toLocaleDateString('pt-BR', { month: 'long' });
            const dayOfWeek = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'][eventDate.getDay()];
            
            const card = document.createElement('div');
            card.className = 'cronograma-card';
            card.setAttribute('data-team', event.team_name);
            
            card.innerHTML = `
                <div class="cronograma-card-date">${day} ${monthName}</div>
                <div class="cronograma-card-weekday">(${dayOfWeek})</div>
                ${event.event_title ? `<div class="cronograma-card-title">${event.event_title}</div>` : ''}
                <div class="cronograma-card-info"><i class="fas fa-clock"></i> ${event.event_time}</div>
                <div class="cronograma-card-info"><i class="fas fa-map-marker-alt"></i> ${event.location}</div>
                ${event.rehearsal_time ? `<div class="cronograma-card-info"><i class="fas fa-music"></i> Ensaio: ${event.rehearsal_time}</div>` : ''}
                <div class="cronograma-card-team">${event.team_name}</div>
                ${isAuthenticated() ? `
                    <div class="cronograma-card-actions">
                        <button class="edit-event-mini" onclick="openEditEvent('${event.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="delete-event-mini" onclick="deleteEvent('${event.id}')" title="Excluir"><i class="fas fa-times"></i></button>
                    </div>
                ` : ''}
            `;
            grid.appendChild(card);
        });
    }

    window.deleteEvent = async (id) => {
        if (!confirm("Tem certeza que deseja excluir este evento?")) return;
        try {
            const { error } = await _supabase.from('app_scales').delete().eq('id', id);
            if (error) throw error;
            loadCronograma();
        } catch (err) {
            alert("Erro ao excluir: " + err.message);
        }
    };

    window.openEditEvent = (id) => {
        const event = currentCronograma.find(e => e.id === id);
        if (!event) return;

        document.getElementById('eventId').value = event.id;
        document.getElementById('eventDate').value = event.event_date;
        document.getElementById('eventTime').value = event.event_time;
        document.getElementById('eventTitle').value = event.event_title || '';
        document.getElementById('eventLocation').value = event.location;
        document.getElementById('eventTeam').value = event.team_name;
        document.getElementById('eventRehearsal').value = event.rehearsal_time || '';

        document.querySelector('#addEventModal h2').textContent = 'Editar Evento';
        document.getElementById('addEventModal').style.display = 'block';
    };

    function getTeamColor(team) {
        const colors = {
            'Start': '#ff4757',
            'Amarelo': '#f1c40f',
            'Laranja': '#e67e22',
            'Azul': '#3498db',
            'Verde': '#2ecc71',
            'Branco': '#f5f6fa'
        };
        return colors[team] || '#888';
    }

    // --- Filtros ---
    const mFilter = document.getElementById('monthFilter');
    const yFilter = document.getElementById('yearFilter');
    if (mFilter) mFilter.onchange = loadCronograma;
    if (yFilter) yFilter.onchange = loadCronograma;

    // --- Gerador Mês Padrão ---
    const generateDefaultMonthBtn = document.getElementById('generateDefaultMonthBtn');
    window.generateDefaultMonth = async () => {
        console.log("🚀 Iniciando geração do mês padrão...");
        const monthVal = document.getElementById('monthFilter').value;
        const yearVal = document.getElementById('yearFilter').value;
        
        if (!monthVal || !yearVal) {
            alert("Erro: Filtros de mês ou ano não encontrados.");
            return;
        }

        const month = parseInt(monthVal);
        const year = parseInt(yearVal);
        const btn = document.getElementById('generateDefaultMonthBtn');
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        const events = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        console.log(`📅 Gerando para ${month+1}/${year} (${daysInMonth} dias)`);

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dayOfWeek = date.getDay(); 
            const dateStr = `${year}-${(month+1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

            if (dayOfWeek === 5) { // SEXTA
                events.push({ event_date: dateStr, event_time: '20:00h', event_title: 'Culto Start', location: 'BTL Lounge', team_name: 'A definir', rehearsal_time: '18:30h' });
            } else if (dayOfWeek === 6) { // SABADO
                events.push({ event_date: dateStr, event_time: '19:30h', event_title: 'Culto Avance', location: 'Chácara', team_name: 'A definir', rehearsal_time: '18:00h' });
            } else if (dayOfWeek === 0) { // DOMINGO
                events.push({ event_date: dateStr, event_time: '09:00h', event_title: 'Culto de Domingo', location: 'Sede', team_name: 'A definir', rehearsal_time: '07:45h' });
                events.push({ event_date: dateStr, event_time: '10:15h', event_title: 'Culto de Domingo', location: 'Chácara', team_name: 'A definir', rehearsal_time: '08:45h' });
                events.push({ event_date: dateStr, event_time: '19:00h', event_title: 'Culto de Domingo', location: 'Sede', team_name: 'A definir', rehearsal_time: '17:45h' });
            }
        }

        console.log(`📤 Enviando ${events.length} eventos para o Supabase...`);

        try {
            const { error } = await _supabase.from('app_scales').insert(events);
            if (error) throw error;
            console.log("✅ Sucesso!");
            alert("Cronograma padrão gerado com sucesso!");
            loadCronograma();
        } catch (err) {
            console.error("❌ Erro no Supabase:", err);
            alert("Erro ao gerar no banco de dados: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-magic"></i> Gerar Mês Padrão';
        }
    };
    if (generateDefaultMonthBtn) generateDefaultMonthBtn.onclick = window.generateDefaultMonth;

    // --- Limpar Mês ---
    const clearMonthBtn = document.getElementById('clearMonthBtn');
    if (clearMonthBtn) {
        clearMonthBtn.onclick = async () => {
            const month = document.getElementById('monthFilter').value;
            const year = document.getElementById('yearFilter').value;
            const startDate = `${year}-${(parseInt(month)+1).toString().padStart(2, '0')}-01`;
            const endDate = `${year}-${(parseInt(month)+1).toString().padStart(2, '0')}-31`;
            if (!confirm("Isso vai apagar TODOS os eventos deste mês. Confirma?")) return;

            try {
                const { error } = await _supabase.from('app_scales').delete().gte('event_date', startDate).lte('event_date', endDate);
                if (error) throw error;
                alert("Mês limpo com sucesso!");
                loadCronograma();
            } catch (err) {
                alert("Erro ao limpar: " + err.message);
            }
        };
    }

    // --- Modal Adicionar/Editar Evento ---
    const addEventBtn = document.getElementById('addEventBtn');
    const closeEventModal = document.querySelector('.close-event-modal');
    const addEventForm = document.getElementById('addEventForm');

    if (addEventBtn) {
        addEventBtn.onclick = () => {
            addEventForm.reset();
            document.getElementById('eventId').value = '';
            document.querySelector('#addEventModal h2').textContent = 'Agendar Novo Evento';
            document.getElementById('addEventModal').style.display = 'block';
        };
    }

    if (closeEventModal) {
        closeEventModal.onclick = () => {
            document.getElementById('addEventModal').style.display = 'none';
        };
    }

    if (addEventForm) {
        addEventForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('eventId').value;
            const eventData = {
                event_date: document.getElementById('eventDate').value,
                event_time: document.getElementById('eventTime').value,
                event_title: document.getElementById('eventTitle').value,
                location: document.getElementById('eventLocation').value,
                team_name: document.getElementById('eventTeam').value,
                rehearsal_time: document.getElementById('eventRehearsal').value
            };

            const btn = addEventForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Salvando...';

            try {
                let res;
                if (id) {
                    res = await _supabase.from('app_scales').update(eventData).eq('id', id);
                } else {
                    res = await _supabase.from('app_scales').insert([eventData]);
                }
                if (res.error) throw res.error;
                
                document.getElementById('addEventModal').style.display = 'none';
                alert("Evento salvo com sucesso!");
                loadCronograma();
            } catch (err) {
                alert("Erro ao salvar: " + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Salvar no Cronograma';
            }
        };
    }

    const exportBtn = document.getElementById('exportCronogramaBtn');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const originalText = exportBtn.innerHTML;
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

            const monthName = document.querySelector('#monthFilter option:checked').text;
            const year = document.getElementById('yearFilter').value;
            
            document.getElementById('posterMonthTitle').textContent = `${monthName.toUpperCase()} ${year}`;
            
            // posterGenDate é opcional — apenas atualiza se existir no HTML
            const genDateEl = document.getElementById('posterGenDate');
            if (genDateEl) genDateEl.textContent = new Date().toLocaleDateString('pt-BR');
            
            const grid = document.getElementById('posterCalendarGrid');
            
            // 5 COLUNAS LADO A LADO
            grid.style.display = "grid";
            grid.style.gridTemplateColumns = "repeat(5, 1fr)";
            grid.style.gap = "20px";
            grid.style.padding = "40px";
            grid.innerHTML = '';

            currentCronograma.forEach(ev => {
                const eventDate = new Date(ev.event_date + 'T12:00:00');
                const day = eventDate.getDate().toString().padStart(2, '0');
                const dayOfWeek = eventDate.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
                const teamColor = getTeamColor(ev.team_name);

                const eventCard = document.createElement('div');
                eventCard.style = `background: #111; border: 2px solid #222; border-top: 10px solid ${teamColor}; border-radius: 15px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.6);`;
                
                eventCard.innerHTML = `
                    <div style="background: #1a1a1a; padding: 20px; text-align: center; border-bottom: 2px solid #333;">
                        <div style="font-size: 1.8rem; color: #fff; font-weight: 900; letter-spacing: 3px; margin-bottom: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${dayOfWeek}</div>
                        <div style="font-size: 4.8rem; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 4px 8px rgba(0,0,0,0.5);">${day}</div>
                    </div>
                    <div style="padding: 30px; display: flex; flex-direction: column; gap: 18px; flex: 1; text-align: center; justify-content: center;">
                        <div style="background: ${teamColor}; color: ${ev.team_name === 'Branco' || ev.team_name === 'Amarelo' ? '#000' : '#fff'}; padding: 12px 15px; border-radius: 12px; font-size: 1.5rem; font-weight: 900; text-transform: uppercase;">
                            ${ev.team_name}
                        </div>
                        <div style="font-size: 3.2rem; font-weight: 900; color: #fff; margin: 10px 0; letter-spacing: -1px;">${ev.event_time}</div>
                        
                        <div style="border-top: 2px solid #333; padding-top: 25px; display: flex; flex-direction: column; gap: 15px;">
                            <div style="font-size: 1.8rem; color: #fff; display: flex; align-items: center; justify-content: center; gap: 15px;">
                                <i class="fas fa-map-marker-alt" style="color: ${teamColor};"></i> <strong>${ev.location}</strong>
                            </div>
                            ${ev.rehearsal_time ? `
                            <div style="font-size: 1.8rem; color: #f1c40f; display: flex; align-items: center; justify-content: center; gap: 15px;">
                                <i class="fas fa-music"></i> <strong>Ens: ${ev.rehearsal_time}</strong>
                            </div>` : ''}
                        </div>
                    </div>
                `;
                grid.appendChild(eventCard);
            });

            // Aguarda o browser renderizar o DOM antes de capturar
            await new Promise(resolve => setTimeout(resolve, 400));

            try {
                const poster = document.getElementById('posterTemplate');
                const canvas = await html2canvas(poster, {
                    backgroundColor: '#000',
                    scale: 1, // 1800px já é ultra nítido
                    useCORS: true,
                    logging: false,
                    windowWidth: 1800
                });

                const dataUrl = canvas.toDataURL('image/png');
                
                if (navigator.share) {
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], `Escala_IBB_${monthName}.png`, { type: 'image/png' });
                    
                    try {
                        await navigator.share({
                            files: [file],
                            title: `Escala IBB - ${monthName}`,
                            text: `Escala de louvor IBB - ${monthName}`
                        });
                    } catch (e) {
                        downloadFallback(dataUrl, monthName);
                    }
                } else {
                    downloadFallback(dataUrl, monthName);
                }
            } catch (err) {
                alert("Erro ao gerar imagem: " + err.message);
            } finally {
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalText;
            }
        };
    }
});

function downloadFallback(dataUrl, month) {
    const link = document.createElement('a');
    link.download = `Escala_IBB_${month}.png`;
    link.href = dataUrl;
    link.click();
    alert("Imagem gerada! Ela foi salva nos seus Downloads.");
}
