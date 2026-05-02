// ============================================================
// TRPGシナリオチャート - メインスクリプト
// ============================================================

// グローバル変数
let projects = [];
let currentProjectId = null;
let selectedNode = null;
let selectedConnection = null;
let connecting = false;
let connectFrom = null;
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let viewOffset = { x: 0, y: 0 };
let viewScale = 0.7;
let longPressTimer = null;
let longPressTriggered = false;

// DOM要素
const projectListScreen = document.getElementById('project-list-screen');
const chartScreen = document.getElementById('chart-screen');
const projectList = document.getElementById('project-list');
const projectTitle = document.getElementById('project-title');
const canvas = document.getElementById('canvas');
const nodesLayer = document.getElementById('nodes-layer');
const connectionsLayer = document.getElementById('connections-layer');
const canvasContainer = document.getElementById('canvas-container');
const newProjectModal = document.getElementById('new-project-modal');
const nodeEditorModal = document.getElementById('node-editor-modal');
const connectionEditorModal = document.getElementById('connection-editor-modal');
const charactersModal = document.getElementById('characters-modal');

// ユーティリティ関数
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function notify(msg) {
    const n = document.getElementById('notification');
    n.textContent = msg;
    n.classList.remove('hidden');
    setTimeout(() => n.classList.add('hidden'), 3000);
}

// ============================================================
// 初期化
// ============================================================
function init() {
    loadProjects();
    setupListeners();
    renderProjectList();
    initAssistTool();
}

function loadProjects() {
    const s = localStorage.getItem('trpg-scenario-projects');
    if (s) projects = JSON.parse(s);
}

function save() {
    localStorage.setItem('trpg-scenario-projects', JSON.stringify(projects));
}

function getProject() {
    return projects.find(p => p.id === currentProjectId);
}

// ============================================================
// イベントリスナー設定
// ============================================================
function setupListeners() {
    // プロジェクト管理
    document.getElementById('new-project-btn').onclick = () => newProjectModal.classList.remove('hidden');
    document.getElementById('close-new-project-btn').onclick = () => newProjectModal.classList.add('hidden');
    document.getElementById('cancel-new-project-btn').onclick = () => newProjectModal.classList.add('hidden');
    document.getElementById('create-project-btn').onclick = createProject;
    document.getElementById('new-project-name').addEventListener('keypress', e => { if (e.key === 'Enter') createProject(); });
    document.getElementById('back-to-projects-btn').onclick = backToProjects;
    document.getElementById('import-project-btn').onclick = importProject;

    // ノード追加・整列
    document.getElementById('add-scene-btn').onclick = addNode;
    document.getElementById('auto-layout-btn').onclick = autoLayout;
    
    // キャラクター管理
    document.getElementById('manage-characters-btn').onclick = openCharactersModal;
    document.getElementById('close-characters-btn').onclick = closeCharactersModal;
    document.getElementById('close-characters-done-btn').onclick = closeCharactersModal;
    document.getElementById('add-character-btn').onclick = addCharacter;

    // エクスポート
    document.getElementById('export-cocofolia-btn').onclick = exportCocofolia;
    document.getElementById('export-text-btn').onclick = exportText;
    document.getElementById('export-characters-text-btn').onclick = exportCharactersText;

    // ノードエディタ
    document.getElementById('close-editor-btn').onclick = closeNodeEditor;
    document.getElementById('save-node-btn').onclick = saveNode;
    document.getElementById('delete-node-btn').onclick = deleteNode;
    
    // 追加コンテンツボタン
    document.getElementById('add-note-btn').onclick = () => addAdditionalContent('note');
    document.getElementById('add-item-btn').onclick = () => addAdditionalContent('item');
    document.getElementById('add-memo-btn').onclick = () => addAdditionalContent('memo');

    // 接続エディタ
    document.getElementById('close-connection-editor-btn').onclick = closeConnectionEditor;
    document.getElementById('save-connection-btn').onclick = saveConnection;
    document.getElementById('delete-connection-btn').onclick = deleteConnection;

    // 背景色同期
    document.getElementById('scene-bg-color').oninput = e => {
        document.getElementById('scene-bg-color-text').value = e.target.value;
    };
    document.getElementById('scene-bg-color-text').oninput = e => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            document.getElementById('scene-bg-color').value = e.target.value;
        }
    };

    // カラープリセット
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.onclick = () => {
            document.getElementById('node-color').value = preset.dataset.color;
        };
    });

    // キャンバスイベント
    canvasContainer.onmousedown = onCanvasMouseDown;
    canvasContainer.onmousemove = onCanvasMouseMove;
    canvasContainer.onmouseup = onCanvasMouseUp;
    canvasContainer.onwheel = onCanvasWheel;
    
    // タッチイベント
    canvasContainer.ontouchstart = onCanvasTouchStart;
    canvasContainer.ontouchmove = onCanvasTouchMove;
    canvasContainer.ontouchend = onCanvasTouchEnd;

    // ファイルインポート
    document.getElementById('import-file-input').onchange = importJSON;
}

// ============================================================
// プロジェクト管理
// ============================================================
function renderProjectList() {
    projectList.innerHTML = '';
    if (projects.length === 0) {
        projectList.innerHTML = `<div class="empty-state"><h3>プロジェクトがありません</h3><p>「新規プロジェクト」から作成してください</p></div>`;
        return;
    }
    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${esc(p.name)}</h3>
            <div class="project-info">ノード数: ${p.nodes.length}　接続: ${p.connections.length}<br>最終更新: ${new Date(p.updatedAt).toLocaleString('ja-JP')}</div>
            <div class="project-actions">
                <button class="secondary-btn exp-btn" data-id="${p.id}">保存</button>
                <button class="danger-btn del-btn" data-id="${p.id}">削除</button>
            </div>`;
        card.addEventListener('click', e => {
            if (!e.target.classList.contains('exp-btn') && !e.target.classList.contains('del-btn')) openProject(p.id);
        });
        card.querySelector('.exp-btn').onclick = e => { e.stopPropagation(); exportProjectJSON(p.id); };
        card.querySelector('.del-btn').onclick = e => {
            e.stopPropagation();
            if (confirm(`「${p.name}」を削除しますか？`)) {
                projects = projects.filter(x => x.id !== p.id);
                save();
                renderProjectList();
            }
        };
        projectList.appendChild(card);
    });
}

function createProject() {
    const name = document.getElementById('new-project-name').value.trim();
    if (!name) { alert('プロジェクト名を入力してください'); return; }
    const p = {
        id: uid(),
        name,
        nodes: [],
        connections: [],
        characters: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    projects.push(p);
    save();
    document.getElementById('new-project-name').value = '';
    newProjectModal.classList.add('hidden');
    renderProjectList();
}

function openProject(id) {
    currentProjectId = id;
    const p = getProject();
    projectTitle.textContent = p.name;
    projectListScreen.classList.add('hidden');
    chartScreen.classList.remove('hidden');
    viewOffset = { x: 0, y: 0 };
    viewScale = 0.7;
    renderChart();
}

function backToProjects() {
    chartScreen.classList.add('hidden');
    projectListScreen.classList.remove('hidden');
    currentProjectId = null;
    renderProjectList();
}

function exportProjectJSON(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('JSONファイルをダウンロードしました');
}

function importProject() {
    document.getElementById('import-file-input').click();
}

function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const p = JSON.parse(ev.target.result);
            if (!p.id || !p.name) throw new Error('Invalid format');
            
            // charactersがない場合は追加
            if (!p.characters) p.characters = [];
            
            // 既存IDとの重複を避ける
            p.id = uid();
            p.updatedAt = Date.now();
            projects.push(p);
            save();
            renderProjectList();
            notify('プロジェクトをインポートしました');
        } catch (err) {
            alert('JSONファイルの読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ============================================================
// ノード管理
// ============================================================
function addNode() {
    const p = getProject();
    const node = {
        id: uid(),
        type: 'scene',
        x: 100 + p.nodes.length * 30,
        y: 100 + p.nodes.length * 30,
        title: `シーン${p.nodes.length + 1}`,
        color: '#ffffff',
        sceneName: '',
        sceneBackgroundColor: '#888888',
        workMemo: '',
        sceneContent: '',
        sceneAlsoAsItem: false,
        additionalContents: []
    };
    p.nodes.push(node);
    p.updatedAt = Date.now();
    save();
    renderChart();
}

function deleteNode() {
    if (!selectedNode) return;
    if (!confirm('このノードを削除しますか？')) return;
    const p = getProject();
    p.nodes = p.nodes.filter(n => n.id !== selectedNode);
    p.connections = p.connections.filter(c => c.from !== selectedNode && c.to !== selectedNode);
    p.updatedAt = Date.now();
    save();
    closeNodeEditor();
    renderChart();
}

function openNodeEditor(nodeId) {
    selectedNode = nodeId;
    const p = getProject();
    const node = p.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // タブを編集タブに戻す
    document.querySelectorAll('.node-editor-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.node-editor-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="edit"]').classList.add('active');
    document.getElementById('edit-panel').classList.add('active');

    document.getElementById('scene-name').value = node.sceneName || '';
    document.getElementById('scene-bg-color').value = node.sceneBackgroundColor || '#888888';
    document.getElementById('scene-bg-color-text').value = node.sceneBackgroundColor || '#888888';
    document.getElementById('work-memo').value = node.workMemo || '';
    document.getElementById('scene-content').value = node.sceneContent || '';
    document.getElementById('scene-also-as-item').checked = node.sceneAlsoAsItem || false;
    document.getElementById('node-color').value = node.color || '#ffffff';

    if (!node.additionalContents) node.additionalContents = [];
    renderAdditionalContents();

    nodeEditorModal.classList.remove('hidden');
}

function closeNodeEditor() {
    nodeEditorModal.classList.add('hidden');
    selectedNode = null;
}

function saveNode() {
    if (!selectedNode) return;
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;

    node.sceneName = document.getElementById('scene-name').value;
    node.sceneBackgroundColor = document.getElementById('scene-bg-color').value;
    node.workMemo = document.getElementById('work-memo').value;
    node.sceneContent = document.getElementById('scene-content').value;
    node.sceneAlsoAsItem = document.getElementById('scene-also-as-item').checked;
    node.color = document.getElementById('node-color').value;
    node.title = node.sceneName;

    p.updatedAt = Date.now();
    save();
    closeNodeEditor();
    renderChart();
}

// ============================================================
// 追加コンテンツ
// ============================================================
function addAdditionalContent(type) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    if (!node.additionalContents) node.additionalContents = [];
    node.additionalContents.push({ type, title: '', text: '', alsoAsItem: false });
    renderAdditionalContents();
}

function removeAdditionalContent(idx) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    node.additionalContents.splice(idx, 1);
    renderAdditionalContents();
}

function updateAdditionalContent(idx, field, value) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node || !node.additionalContents[idx]) return;
    node.additionalContents[idx][field] = value;
}

function renderAdditionalContents() {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node || !node.additionalContents) return;

    const container = document.getElementById('additional-contents');
    container.innerHTML = '';

    node.additionalContents.forEach((item, idx) => {
        let typeLabel = '';
        let showItemSwitch = false;
        
        if (item.type === 'note') {
            typeLabel = '📝 Note（ココフォリア）';
            showItemSwitch = true;
        } else if (item.type === 'item') {
            typeLabel = '🎴 Item（ココフォリア）';
            showItemSwitch = false;
        } else if (item.type === 'memo') {
            typeLabel = '📋 メモ（テキスト出力のみ）';
            showItemSwitch = false;
        }
        
        const div = document.createElement('div');
        div.className = 'additional-content-item';
        div.innerHTML = `
            <div class="additional-content-header">
                <span class="additional-content-type">${typeLabel}</span>
                <button type="button" class="remove-content-btn" onclick="removeAdditionalContent(${idx})">削除</button>
            </div>
            ${showItemSwitch ? `
            <div class="form-group" style="margin-bottom:8px;">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
                    <input type="checkbox" ${item.alsoAsItem ? 'checked' : ''} onchange="updateAdditionalContent(${idx}, 'alsoAsItem', this.checked)" style="width:auto;">
                    Itemとしても出力する
                </label>
            </div>
            ` : ''}
            <div class="form-group" style="margin-bottom:8px;">
                <input type="text" placeholder="タイトル" value="${esc(item.title || '')}" onchange="updateAdditionalContent(${idx}, 'title', this.value)">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <textarea rows="3" placeholder="本文" onchange="updateAdditionalContent(${idx}, 'text', this.value)">${esc(item.text || '')}</textarea>
            </div>
        `;
        container.appendChild(div);
    });
}

// ============================================================
// 接続管理
// ============================================================
function openConnectionEditor(connId) {
    selectedConnection = connId;
    const p = getProject();
    const conn = p.connections.find(c => c.id === connId);
    if (!conn) return;
    document.getElementById('connection-label').value = conn.label || '';
    connectionEditorModal.classList.remove('hidden');
}

function closeConnectionEditor() {
    connectionEditorModal.classList.add('hidden');
    selectedConnection = null;
}

function saveConnection() {
    if (!selectedConnection) return;
    const p = getProject();
    const conn = p.connections.find(c => c.id === selectedConnection);
    if (!conn) return;
    conn.label = document.getElementById('connection-label').value;
    p.updatedAt = Date.now();
    save();
    closeConnectionEditor();
    renderChart();
}

function deleteConnection() {
    if (!selectedConnection) return;
    if (!confirm('この接続を削除しますか？')) return;
    const p = getProject();
    p.connections = p.connections.filter(c => c.id !== selectedConnection);
    p.updatedAt = Date.now();
    save();
    closeConnectionEditor();
    renderChart();
}

// ============================================================
// キャラクター管理
// ============================================================
function openCharactersModal() {
    const p = getProject();
    if (!p.characters) p.characters = [];
    renderCharactersList();
    charactersModal.classList.remove('hidden');
}

function closeCharactersModal() {
    charactersModal.classList.add('hidden');
    save();
}

function addCharacter() {
    const p = getProject();
    if (!p.characters) p.characters = [];
    p.characters.push({
        id: uid(),
        name: '',
        playerName: '',
        status: [],
        commands: '',
        textOnlyMemo: ''
    });
    renderCharactersList();
}

function removeCharacter(idx) {
    const p = getProject();
    p.characters.splice(idx, 1);
    renderCharactersList();
}

function updateCharacter(idx, field, value) {
    const p = getProject();
    if (!p.characters[idx]) return;
    p.characters[idx][field] = value;
}

function addStatus(charIdx) {
    const p = getProject();
    if (!p.characters[charIdx].status) p.characters[charIdx].status = [];
    p.characters[charIdx].status.push({ label: '', value: '', max: '' });
    renderCharactersList();
}

function removeStatus(charIdx, statusIdx) {
    const p = getProject();
    p.characters[charIdx].status.splice(statusIdx, 1);
    renderCharactersList();
}

function updateStatus(charIdx, statusIdx, field, value) {
    const p = getProject();
    if (!p.characters[charIdx].status[statusIdx]) return;
    p.characters[charIdx].status[statusIdx][field] = value;
}

function renderCharactersList() {
    const p = getProject();
    const container = document.getElementById('characters-list');
    container.innerHTML = '';

    if (!p.characters || p.characters.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>キャラクターがありません</p></div>';
        return;
    }

    p.characters.forEach((char, idx) => {
        const card = document.createElement('div');
        card.className = 'character-card';
        
        const statusHTML = (char.status || []).map((s, sIdx) => `
            <div class="status-item">
                <input type="text" placeholder="ラベル" value="${esc(s.label || '')}" onchange="updateStatus(${idx}, ${sIdx}, 'label', this.value)">
                <input type="text" placeholder="現在値" value="${esc(s.value || '')}" onchange="updateStatus(${idx}, ${sIdx}, 'value', this.value)">
                <input type="text" placeholder="最大値" value="${esc(s.max || '')}" onchange="updateStatus(${idx}, ${sIdx}, 'max', this.value)">
                <button class="danger-btn" onclick="removeStatus(${idx}, ${sIdx})">×</button>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="character-card-header">
                <span class="character-card-title">キャラクター ${idx + 1}</span>
                <button class="danger-btn" onclick="removeCharacter(${idx})">削除</button>
            </div>
            <div class="form-group">
                <label>キャラクター名</label>
                <input type="text" value="${esc(char.name || '')}" onchange="updateCharacter(${idx}, 'name', this.value)">
            </div>
            <div class="form-group">
                <label>プレイヤー名</label>
                <input type="text" value="${esc(char.playerName || '')}" onchange="updateCharacter(${idx}, 'playerName', this.value)">
            </div>
            <div class="form-group">
                <label>ステータス</label>
                <div class="status-list">
                    ${statusHTML}
                </div>
                <button class="secondary-btn" onclick="addStatus(${idx})" style="margin-top:8px;">+ ステータス追加</button>
            </div>
            <div class="form-group">
                <label>チャットパレット</label>
                <textarea rows="4" placeholder="1d100<=65 技能判定" onchange="updateCharacter(${idx}, 'commands', this.value)">${esc(char.commands || '')}</textarea>
            </div>
            <div class="form-group">
                <label>メモ（テキスト出力専用・ココフォリア非反映）</label>
                <textarea rows="3" placeholder="GM専用メモ" onchange="updateCharacter(${idx}, 'textOnlyMemo', this.value)">${esc(char.textOnlyMemo || '')}</textarea>
            </div>
        `;
        container.appendChild(card);
    });
}

// ============================================================
// フローチャート描画
// ============================================================
function renderChart() {
    const p = getProject();
    nodesLayer.innerHTML = '';
    connectionsLayer.innerHTML = '';

    // 接続を描画
    p.connections.forEach(conn => {
        const from = p.nodes.find(n => n.id === conn.from);
        const to = p.nodes.find(n => n.id === conn.to);
        if (!from || !to) return;

        const x1 = from.x + 80;
        const y1 = from.y + 60;
        const x2 = to.x + 80;
        const y2 = to.y;

        let path;
        if (y2 < y1) {
            // 上向き矢印：右側に迂回
            const detourX = Math.max(x1, x2) + 180;
            path = `M ${x1} ${y1} L ${detourX} ${y1} L ${detourX} ${y2} L ${x2} ${y2}`;
        } else {
            // 下向き矢印：直線または曲線
            const dy = Math.abs(y2 - y1);
            if (dy < 100) {
                const cp1y = y1 + dy / 2;
                const cp2y = y2 - dy / 2;
                path = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
            } else {
                path = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
        }

        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', path);
        pathElem.setAttribute('class', 'connection-path');
        pathElem.setAttribute('marker-end', 'url(#arrowhead)');

        const hitElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitElem.setAttribute('d', path);
        hitElem.setAttribute('class', 'connection-hit');
        hitElem.onclick = () => openConnectionEditor(conn.id);

        connectionsLayer.appendChild(pathElem);
        connectionsLayer.appendChild(hitElem);

        // ラベル
        if (conn.label) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElem.setAttribute('x', midX);
            textElem.setAttribute('y', midY - 5);
            textElem.setAttribute('class', 'conn-label-text');
            textElem.setAttribute('text-anchor', 'middle');
            textElem.textContent = conn.label;

            const bbox = { width: conn.label.length * 7 + 10, height: 18 };
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', midX - bbox.width / 2);
            bgRect.setAttribute('y', midY - bbox.height);
            bgRect.setAttribute('width', bbox.width);
            bgRect.setAttribute('height', bbox.height);
            bgRect.setAttribute('class', 'conn-label-bg');

            connectionsLayer.appendChild(bgRect);
            connectionsLayer.appendChild(textElem);
        }
    });

    // ノードを描画
    p.nodes.forEach(node => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node-group');
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        g.setAttribute('data-id', node.id);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '160');
        rect.setAttribute('height', '60');
        rect.setAttribute('rx', '8');
        rect.setAttribute('class', 'node-rect');
        rect.setAttribute('fill', node.color || '#ffffff');

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', '80');
        title.setAttribute('y', '35');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('class', 'node-title');
        title.textContent = (node.sceneName || node.title || 'シーン').substring(0, 12);

        const connectPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        connectPoint.setAttribute('cx', '80');
        connectPoint.setAttribute('cy', '60');
        connectPoint.setAttribute('r', '8');
        connectPoint.setAttribute('fill', '#4CAF50');
        connectPoint.setAttribute('class', 'connect-point');

        g.appendChild(rect);
        g.appendChild(title);
        g.appendChild(connectPoint);

        g.onmousedown = e => onNodeMouseDown(e, node.id);
        g.ontouchstart = e => onNodeTouchStart(e, node.id);
        rect.onclick = () => openNodeEditor(node.id);
        connectPoint.onclick = e => {
            e.stopPropagation();
            startConnection(node.id);
        };

        nodesLayer.appendChild(g);
    });

    applyViewOffset();
}

function applyViewOffset() {
    const transform = `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`;
    canvas.style.transform = transform;
}

// ============================================================
// マウス・タッチイベント
// ============================================================
function onNodeMouseDown(e, nodeId) {
    if (e.target.classList.contains('connect-point')) return;
    e.stopPropagation();
    draggedNode = nodeId;
    const node = getProject().nodes.find(n => n.id === nodeId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.x = (e.clientX - rect.left) / viewScale;
    dragOffset.y = (e.clientY - rect.top) / viewScale;
}

function onNodeTouchStart(e, nodeId) {
    if (e.target.classList.contains('connect-point')) return;
    e.stopPropagation();
    const touch = e.touches[0];
    
    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        if (navigator.vibrate) navigator.vibrate(50);
        draggedNode = nodeId;
        const node = getProject().nodes.find(n => n.id === nodeId);
        const rect = e.currentTarget.getBoundingClientRect();
        dragOffset.x = (touch.clientX - rect.left) / viewScale;
        dragOffset.y = (touch.clientY - rect.top) / viewScale;
    }, 500);
}

function onCanvasMouseDown(e) {
    if (e.target.closest('.node-group') || e.target.classList.contains('connect-point')) return;
    isPanning = true;
    panStart.x = e.clientX - viewOffset.x;
    panStart.y = e.clientY - viewOffset.y;
    canvasContainer.classList.add('panning');
}

function onCanvasTouchStart(e) {
    if (e.target.closest('.node-group') || e.target.classList.contains('connect-point')) return;
    const touch = e.touches[0];
    isPanning = true;
    panStart.x = touch.clientX - viewOffset.x;
    panStart.y = touch.clientY - viewOffset.y;
}

function onCanvasMouseMove(e) {
    if (draggedNode) {
        const p = getProject();
        const node = p.nodes.find(n => n.id === draggedNode);
        if (!node) return;
        const containerRect = canvasContainer.getBoundingClientRect();
        node.x = (e.clientX - containerRect.left) / viewScale - dragOffset.x - viewOffset.x / viewScale;
        node.y = (e.clientY - containerRect.top) / viewScale - dragOffset.y - viewOffset.y / viewScale;
        renderChart();
    } else if (isPanning) {
        viewOffset.x = e.clientX - panStart.x;
        viewOffset.y = e.clientY - panStart.y;
        applyViewOffset();
    }
}

function onCanvasTouchMove(e) {
    const touch = e.touches[0];
    if (draggedNode && longPressTriggered) {
        e.preventDefault();
        const p = getProject();
        const node = p.nodes.find(n => n.id === draggedNode);
        if (!node) return;
        const containerRect = canvasContainer.getBoundingClientRect();
        node.x = (touch.clientX - containerRect.left) / viewScale - dragOffset.x - viewOffset.x / viewScale;
        node.y = (touch.clientY - containerRect.top) / viewScale - dragOffset.y - viewOffset.y / viewScale;
        renderChart();
    } else if (isPanning) {
        e.preventDefault();
        viewOffset.x = touch.clientX - panStart.x;
        viewOffset.y = touch.clientY - panStart.y;
        applyViewOffset();
    }
}

function onCanvasMouseUp(e) {
    if (draggedNode) {
        const p = getProject();
        p.updatedAt = Date.now();
        save();
    }
    draggedNode = null;
    isPanning = false;
    canvasContainer.classList.remove('panning');
}

function onCanvasTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (draggedNode && longPressTriggered) {
        const p = getProject();
        p.updatedAt = Date.now();
        save();
    }
    draggedNode = null;
    longPressTriggered = false;
    isPanning = false;
}

function onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldScale = viewScale;
    viewScale = Math.max(0.3, Math.min(2.0, viewScale + delta));
    
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    viewOffset.x -= mouseX * (viewScale / oldScale - 1);
    viewOffset.y -= mouseY * (viewScale / oldScale - 1);
    
    applyViewOffset();
}

function startConnection(fromId) {
    connecting = true;
    connectFrom = fromId;
    notify('接続先のノードをクリックしてください');
    
    const clickHandler = e => {
        const targetGroup = e.target.closest('.node-group');
        if (!targetGroup) {
            connecting = false;
            connectFrom = null;
            canvas.removeEventListener('click', clickHandler);
            return;
        }
        
        const toId = targetGroup.dataset.id;
        if (toId === fromId) {
            connecting = false;
            connectFrom = null;
            canvas.removeEventListener('click', clickHandler);
            return;
        }
        
        const p = getProject();
        const exists = p.connections.find(c => c.from === fromId && c.to === toId);
        if (exists) {
            notify('既に接続されています');
        } else {
            p.connections.push({ id: uid(), from: fromId, to: toId, label: '' });
            p.updatedAt = Date.now();
            save();
            renderChart();
            notify('接続しました');
        }
        
        connecting = false;
        connectFrom = null;
        canvas.removeEventListener('click', clickHandler);
    };
    
    canvas.addEventListener('click', clickHandler);
}

// ============================================================
// 自動整列
// ============================================================
function autoLayout() {
    const p = getProject();
    if (p.nodes.length === 0) return;

    // 接続情報から階層を構築
    const incoming = {};
    p.nodes.forEach(n => incoming[n.id] = []);
    p.connections.forEach(c => {
        if (incoming[c.to]) incoming[c.to].push(c.from);
    });

    // ルートノード（入力接続がない）を探す
    const roots = p.nodes.filter(n => incoming[n.id].length === 0);
    if (roots.length === 0) {
        alert('循環参照があるか、接続がありません');
        return;
    }

    // 幅優先探索で階層分け
    const levels = [];
    const visited = new Set();
    const queue = roots.map(n => ({ node: n, level: 0 }));

    while (queue.length > 0) {
        const { node, level } = queue.shift();
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        if (!levels[level]) levels[level] = [];
        levels[level].push(node);

        const outgoing = p.connections.filter(c => c.from === node.id);
        outgoing.forEach(c => {
            const target = p.nodes.find(n => n.id === c.to);
            if (target && !visited.has(target.id)) {
                queue.push({ node: target, level: level + 1 });
            }
        });
    }

    // 配置
    let currentY = 100;
    levels.forEach(levelNodes => {
        if (levelNodes.length === 1) {
            // 1つだけなら中央
            levelNodes[0].x = 400;
            levelNodes[0].y = currentY;
        } else {
            // 複数なら横並び
            const totalWidth = levelNodes.length * 180;
            const startX = 400 - totalWidth / 2;
            levelNodes.forEach((node, i) => {
                node.x = startX + i * 180;
                node.y = currentY;
            });
        }
        currentY += 150;
    });

    p.updatedAt = Date.now();
    save();
    renderChart();
    notify('自動整列しました');
}

// ============================================================
// 座標順ソート
// ============================================================
function positionSort(p) {
    const nodes = [...p.nodes];
    nodes.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) return a.x - b.x;
        return a.y - b.y;
    });
    return nodes;
}

// ============================================================
// エクスポート
// ============================================================
function exportCocofolia() {
    const p = getProject();
    const sorted = positionSort(p);

    const data = {
        meta: { version: "1.1.0" },
        entities: {
            room: {
                id: uid(),
                name: p.name,
                diceBot: "Cthulhu7th"
            },
            notes: {},
            characters: {},
            scenes: {},
            items: {},
            decks: {},
            effects: {},
            savedatas: {},
            snapshots: {}
        }
    };

    let noteOrder = 1;
    let sceneOrder = 0;

    // Notes
    sorted.forEach(node => {
        if (node.additionalContents) {
            node.additionalContents.filter(c => c.type === 'note').forEach(note => {
                const id = uid();
                data.entities.notes[id] = {
                    id,
                    name: note.title || 'メモ',
                    text: note.text || '',
                    order: noteOrder++,
                    iconUrl: ""
                };
            });
        }
    });

    // Characters
    if (p.characters) {
        p.characters.forEach(char => {
            const id = uid();
            data.entities.characters[id] = {
                id,
                name: char.name || 'キャラクター',
                playerName: char.playerName || '',
                color: "#888888",
                commands: char.commands || '',
                status: (char.status || []).map(s => ({
                    label: s.label || '',
                    value: Number(s.value) || 0,
                    max: Number(s.max) || 0
                })),
                x: 0, y: 0, z: 0,
                width: 4, height: 4,
                rotation: 0,
                altitude: 0,
                isHide: false,
                isLock: false
            };
        });
    }

    // Scenes
    sorted.forEach((node, i) => {
        const id = uid();
        data.entities.scenes[id] = {
            id,
            name: node.sceneName || node.title || `シーン${i + 1}`,
            text: node.sceneContent || '',
            backgroundColor: node.sceneBackgroundColor || '#888888',
            backgroundUrl: null,
            width: 80,
            height: 45,
            order: sceneOrder++
        };
    });

    // Items
    sorted.forEach(node => {
        // Scenes本文がItemとしても出力
        if (node.sceneAlsoAsItem && node.sceneContent) {
            const id = uid();
            data.entities.items[id] = {
                id,
                text: node.sceneName || 'シーン',
                memo: node.sceneContent || '',
                imageUrl: null,
                x: 0, y: 0, z: 0,
                width: 10, height: 10,
                locked: false,
                invisible: false
            };
        }

        if (node.additionalContents) {
            node.additionalContents.forEach(content => {
                if (content.type === 'item') {
                    const id = uid();
                    data.entities.items[id] = {
                        id,
                        text: content.title || 'カード',
                        memo: content.text || '',
                        imageUrl: null,
                        x: 0, y: 0, z: 0,
                        width: 10, height: 10,
                        locked: false,
                        invisible: false
                    };
                } else if (content.type === 'note' && content.alsoAsItem) {
                    const id = uid();
                    data.entities.items[id] = {
                        id,
                        text: content.title || 'Note',
                        memo: content.text || '',
                        imageUrl: null,
                        x: 0, y: 0, z: 0,
                        width: 10, height: 10,
                        locked: false,
                        invisible: false
                    };
                }
            });
        }
    });

    try {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = createZipBlob('__data.json', jsonContent);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.name}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        notify('ココフォリア用ZIPを出力しました');
    } catch (err) {
        console.error(err);
        notify('ZIP作成に失敗しました');
    }
}

function exportText() {
    const p = getProject();
    const sorted = positionSort(p);
    let text = `■ ${p.name}\n${'='.repeat(40)}\n\n`;
    
    sorted.forEach((node, i) => {
        text += `【${node.sceneName || node.title || `シーン${i + 1}`}】\n`;
        
        const content = node.sceneContent || '';
        if (content) {
            text += `\n〝${content}〟\n\n`;
        } else {
            text += `\n（本文なし）\n\n`;
        }
        
        if (node.additionalContents && node.additionalContents.length > 0) {
            node.additionalContents.forEach(item => {
                if (item.type === 'memo' || item.type === 'note') {
                    const typePrefix = item.type === 'note' ? '📝' : '📋';
                    text += `${typePrefix} ${item.title || (item.type === 'note' ? 'Note' : 'メモ')}\n`;
                    if (item.text) {
                        text += item.text.split('\n').map(line => `  ${line}`).join('\n');
                        text += `\n\n`;
                    }
                }
            });
        }
        
        const outs = p.connections.filter(c => c.from === node.id);
        if (outs.length) {
            outs.forEach(c => {
                const to = p.nodes.find(n => n.id === c.to);
                text += `  ${c.label ? `[${c.label}]` : '▼'} → ${to?.sceneName || to?.title || '？'}\n`;
            });
        }
        text += `\n${'-'.repeat(40)}\n\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => notify('シナリオテキストをコピーしました'));
}

function exportCharactersText() {
    const p = getProject();
    if (!p.characters || p.characters.length === 0) {
        notify('キャラクターがありません');
        return;
    }

    let text = `■ ${p.name} - キャラクター一覧\n${'='.repeat(40)}\n\n`;

    p.characters.forEach((char, i) => {
        text += `【${char.name || `キャラクター${i + 1}`}】\n`;
        if (char.playerName) {
            text += `PL: ${char.playerName}\n`;
        }
        text += `\n`;

        if (char.status && char.status.length > 0) {
            text += `◆ ステータス\n`;
            char.status.forEach(s => {
                text += `  ${s.label}: ${s.value}${s.max ? ` / ${s.max}` : ''}\n`;
            });
            text += `\n`;
        }

        if (char.commands) {
            text += `◆ チャットパレット\n`;
            text += char.commands.split('\n').map(line => `  ${line}`).join('\n');
            text += `\n\n`;
        }

        if (char.textOnlyMemo) {
            text += `◆ メモ\n`;
            text += char.textOnlyMemo.split('\n').map(line => `  ${line}`).join('\n');
            text += `\n\n`;
        }

        text += `${'-'.repeat(40)}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => notify('キャラクターテキストをコピーしました'));
}

// ============================================================
// ZIP生成（完全オフライン）
// ============================================================
function createZipBlob(filename, content) {
    function crc32(data) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        
        let crc = 0xFFFFFFFF;
        const bytes = new TextEncoder().encode(data);
        for (let i = 0; i < bytes.length; i++) {
            crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    
    function toDosDateTime() {
        const now = new Date();
        const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        return { date, time };
    }
    
    const fileBytes = new TextEncoder().encode(content);
    const filenameBytes = new TextEncoder().encode(filename);
    const crc = crc32(content);
    const { date, time } = toDosDateTime();
    
    const lfh = new Uint8Array(30 + filenameBytes.length);
    const lfhView = new DataView(lfh.buffer);
    lfhView.setUint32(0, 0x04034b50, true);
    lfhView.setUint16(4, 20, true);
    lfhView.setUint16(6, 0, true);
    lfhView.setUint16(8, 0, true);
    lfhView.setUint16(10, time, true);
    lfhView.setUint16(12, date, true);
    lfhView.setUint32(14, crc, true);
    lfhView.setUint32(18, fileBytes.length, true);
    lfhView.setUint32(22, fileBytes.length, true);
    lfhView.setUint16(26, filenameBytes.length, true);
    lfhView.setUint16(28, 0, true);
    lfh.set(filenameBytes, 30);
    
    const cdh = new Uint8Array(46 + filenameBytes.length);
    const cdhView = new DataView(cdh.buffer);
    cdhView.setUint32(0, 0x02014b50, true);
    cdhView.setUint16(4, 20, true);
    cdhView.setUint16(6, 20, true);
    cdhView.setUint16(8, 0, true);
    cdhView.setUint16(10, 0, true);
    cdhView.setUint16(12, time, true);
    cdhView.setUint16(14, date, true);
    cdhView.setUint32(16, crc, true);
    cdhView.setUint32(20, fileBytes.length, true);
    cdhView.setUint32(24, fileBytes.length, true);
    cdhView.setUint16(28, filenameBytes.length, true);
    cdhView.setUint16(30, 0, true);
    cdhView.setUint16(32, 0, true);
    cdhView.setUint16(34, 0, true);
    cdhView.setUint16(36, 0, true);
    cdhView.setUint32(38, 0, true);
    cdhView.setUint32(42, 0, true);
    cdh.set(filenameBytes, 46);
    
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, 1, true);
    eocdView.setUint16(10, 1, true);
    eocdView.setUint32(12, cdh.length, true);
    eocdView.setUint32(16, lfh.length + fileBytes.length, true);
    eocdView.setUint16(20, 0, true);
    
    const zipData = new Uint8Array(lfh.length + fileBytes.length + cdh.length + eocd.length);
    zipData.set(lfh, 0);
    zipData.set(fileBytes, lfh.length);
    zipData.set(cdh, lfh.length + fileBytes.length);
    zipData.set(eocd, lfh.length + fileBytes.length + cdh.length);
    
    return new Blob([zipData], { type: 'application/zip' });
}

// ============================================================
// 補助ツール
// ============================================================
const assistData = {
    skills: {
        common: ['回避', 'キック', '組みつき', '投擲', '拳銃', 'サブマシンガン', 'ショットガン', 'マシンガン', 'ライフル', '応急手当', '鍵開け', '聞き耳', '精神分析', '追跡', '登攀', '図書館', '目星', '隠れる', '忍び歩き', '写真術', '運転', '機械修理', '電気修理', 'ナビゲート', '博物学'],
        v6: ['信用', '威圧', 'アイデア', '幸運', 'SANチェック', 'KP情報'],
        v7: ['信用', '威圧', '説得', '言いくるめ', 'INT', 'アイデア', '幸運', '知識', 'SANチェック', 'KP情報'],
        custom: []
    },
    notation: {
        common: ['〈技能〉', '【見出し】', '＞情報', '「台詞」', '〝描写〟', '――――', '探索箇所', 'シーン', 'ハンドアウト', 'NPC：', 'アイテム：']
    }
};

let currentVersion = 'common';
let currentSubtab = 'skills';

function initAssistTool() {
    document.querySelectorAll('.node-editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.node-editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.node-editor-tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(targetTab + '-panel').classList.add('active');
        });
    });

    document.querySelectorAll('.assist-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentSubtab = tab.dataset.subtab;
            document.querySelectorAll('.assist-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.assist-subtab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(currentSubtab + '-panel').classList.add('active');
        });
    });

    document.querySelectorAll('.version-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentVersion = btn.dataset.version;
            document.querySelectorAll('.version-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAssistButtons();
        });
    });

    renderAssistButtons();
}

function renderAssistButtons() {
    const skillsContainer = document.getElementById('skills-buttons');
    skillsContainer.innerHTML = '';
    
    let skills = [];
    if (currentVersion === 'common') {
        skills = assistData.skills.common;
    } else if (currentVersion === 'v6') {
        skills = [...assistData.skills.common, ...assistData.skills.v6];
    } else if (currentVersion === 'v7') {
        skills = [...assistData.skills.common, ...assistData.skills.v7];
    } else if (currentVersion === 'custom') {
        skills = assistData.skills.custom.length ? assistData.skills.custom : ['カスタムボタンなし'];
    }
    
    skills.forEach(skill => {
        const btn = document.createElement('button');
        btn.className = 'insert-btn';
        btn.textContent = skill;
        btn.onclick = () => insertText(`〈${skill}〉`);
        skillsContainer.appendChild(btn);
    });

    const notationContainer = document.getElementById('notation-buttons');
    notationContainer.innerHTML = '';
    
    assistData.notation.common.forEach(notation => {
        const btn = document.createElement('button');
        btn.className = 'insert-btn';
        btn.textContent = notation;
        btn.onclick = () => insertText(notation);
        notationContainer.appendChild(btn);
    });
}

function insertText(text) {
    const textarea = document.getElementById('scene-content');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

// ============================================================
// 起動
// ============================================================
init();
