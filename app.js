// ============================================================
// TRPGシナリオチャート app.js
// ============================================================

// ---- 定数 ----
const NODE_W = 160;   // 通常シーンノードの幅（200→160に縮小）
const NODE_H = 60;    // 通常シーンノードの高さ（80→60に縮小）
const DIAMOND_W = 140; // ひし形の横幅（160→140に縮小）
const DIAMOND_H = 70;  // ひし形の縦幅（80→70に縮小）
const GRID_COL_W = 220; // 自動整列の列幅
const GRID_ROW_H = 110; // 自動整列の行間

// ---- データ ----
let projects = [];
let currentProjectId = null;

// ---- UI要素 ----
const projectListScreen = document.getElementById('project-list-screen');
const chartScreen       = document.getElementById('chart-screen');
const projectList       = document.getElementById('project-list');
const projectTitle      = document.getElementById('project-title');
const canvas            = document.getElementById('canvas');
const nodesLayer        = document.getElementById('nodes-layer');
const connectionsLayer  = document.getElementById('connections-layer');
const nodeEditorModal   = document.getElementById('node-editor-modal');
const connEditorModal   = document.getElementById('connection-editor-modal');
const newProjectModal   = document.getElementById('new-project-modal');

// ---- 状態 ----
let isPanning       = false;
let isDraggingNode  = false;
let isConnecting    = false;
let connectingFrom  = null;
let panStart        = { x: 0, y: 0 };
let viewOffset      = { x: 60, y: 60 };
let viewScale       = 0.7; // 初期表示倍率（0.7倍で引いて表示）
let selectedNode    = null;
let selectedConn    = null;

// ============================================================
// 初期化
// ============================================================
function init() {
    loadProjects();
    setupListeners();
    renderProjectList();
    initAssistTool(); // 補助ツール初期化
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
// イベントリスナー
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

    // ノード追加
    document.getElementById('add-scene-btn').onclick  = addNode;
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
    document.getElementById('close-editor-btn').onclick  = closeNodeEditor;
    document.getElementById('save-node-btn').onclick     = saveNode;
    document.getElementById('delete-node-btn').onclick   = deleteNode;
    document.getElementById('add-note-btn').onclick = () => addAdditionalContent('note');
    document.getElementById('add-item-btn').onclick = () => addAdditionalContent('item');
    document.getElementById('add-memo-btn').onclick = () => addAdditionalContent('memo');
    document.getElementById('node-color').addEventListener('input', e => {
        document.getElementById('node-color').value = e.target.value;
    });
    document.querySelectorAll('.color-preset').forEach(el => {
        el.onclick = () => {
            document.getElementById('node-color').value = el.dataset.color;
        };
    });

    // 接続エディタ
    document.getElementById('close-connection-editor-btn').onclick = closeConnEditor;
    document.getElementById('save-connection-btn').onclick = saveConn;
    document.getElementById('delete-connection-btn').onclick = deleteConn;

    // キャンバス（マウス）
    canvas.addEventListener('mousedown', onCanvasMD);
    window.addEventListener('mousemove', onWinMM);
    window.addEventListener('mouseup', onWinMU);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

    // キャンバス（タッチ）
    canvas.addEventListener('touchstart', onCanvasTS, { passive: false });
    window.addEventListener('touchmove', onWinTM, { passive: false });
    window.addEventListener('touchend', onWinTU);

    // Escで接続キャンセル
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isConnecting) cancelConnect();
    });
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
            if (confirm(`「${p.name}」を削除しますか？`)) { projects = projects.filter(x => x.id !== p.id); save(); renderProjectList(); }
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
        characters: [], // キャラクター配列を追加
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
    viewOffset = { x: 60, y: 60 };
    viewScale = 0.7; // 初期表示倍率
    applyViewOffset();
    renderChart();
}

function backToProjects() {
    chartScreen.classList.add('hidden');
    projectListScreen.classList.remove('hidden');
    currentProjectId = null;
}

// ============================================================
// チャート描画
// ============================================================
function renderChart() {
    nodesLayer.innerHTML = '';
    connectionsLayer.innerHTML = '';
    const p = getProject();
    p.connections.forEach(c => drawConnection(c));
    p.nodes.forEach(n => drawNode(n));
}

function applyViewOffset() {
    nodesLayer.setAttribute('transform', `translate(${viewOffset.x},${viewOffset.y}) scale(${viewScale})`);
    connectionsLayer.setAttribute('transform', `translate(${viewOffset.x},${viewOffset.y}) scale(${viewScale})`);
}

// ---- ノード描画 ----
function drawNode(node) {
    const g = svgEl('g');
    g.classList.add('node-group');
    g.dataset.id = node.id;
    g.setAttribute('transform', `translate(${node.x},${node.y})`);

    // 常に角丸四角で描画
    drawRect(g, node);

    // 接続ポイント（下）
    const cp = svgEl('circle');
    cp.classList.add('connect-point');
    cp.setAttribute('cx', NODE_W / 2);
    cp.setAttribute('cy', NODE_H);
    cp.setAttribute('r', '7');
    cp.setAttribute('fill', '#4CAF50');
    cp.setAttribute('stroke', '#fff');
    cp.setAttribute('stroke-width', '2');
    cp.addEventListener('mousedown', e => { e.stopPropagation(); startConnect(node.id); });
    cp.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); startConnect(node.id); }, { passive: false });
    g.appendChild(cp);

    // ノードのドラッグ・クリック
    g.addEventListener('mousedown', e => onNodeMD(e, node.id));
    g.addEventListener('touchstart', e => onNodeTS(e, node.id), { passive: false });
    g.addEventListener('click', e => {
        if (!isDraggingNode && !isConnecting) openNodeEditor(node.id);
        else if (isConnecting) completeConnect(node.id);
    });

    nodesLayer.appendChild(g);
}

function drawRect(g, node) {
    const W = NODE_W, H = NODE_H;
    const rect = svgEl('rect');
    rect.classList.add('node-rect');
    rect.setAttribute('width', W);
    rect.setAttribute('height', H);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', node.color || '#ffffff');
    g.appendChild(rect);

    // タイトル（日時・場所）のみ表示（複数行対応）
    const titleLines = wrapText(node.title || '（無題）', W - 16, 12);
    titleLines.slice(0, 3).forEach((line, i) => {
        const t = svgEl('text');
        t.classList.add('node-title');
        t.setAttribute('x', '8');
        t.setAttribute('y', 16 + i * 14);
        t.textContent = line;
        g.appendChild(t);
    });
}

// ---- 接続線描画 ----
function drawConnection(conn) {
    const p = getProject();
    const fn = p.nodes.find(n => n.id === conn.from);
    const tn = p.nodes.find(n => n.id === conn.to);
    if (!fn || !tn) return;

    // 出発点：ノード下中央
    const fx = fn.x + NODE_W / 2;
    const fy = fn.y + NODE_H;
    // 到着点：ノード上中央
    const tx = tn.x + NODE_W / 2;
    const ty = tn.y;

    const dx = tx - fx;
    const dy = ty - fy;

    let d;
    
    // 上向き（ループバック）の場合は迂回
    if (dy < 0) {
        // 右側に大きく迂回する曲線
        const offsetX = 180; // 右側への迂回量
        const midY = (fy + ty) / 2;
        
        d = `M ${fx} ${fy} 
             C ${fx} ${fy + 30}, ${fx + offsetX} ${fy + 30}, ${fx + offsetX} ${midY}
             C ${fx + offsetX} ${ty - 30}, ${tx} ${ty - 30}, ${tx} ${ty}`;
    } 
    // 横方向の移動が大きい場合（斜め）はS字曲線
    else if (Math.abs(dx) > 20) {
        const midY = fy + dy * 0.5;
        d = `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
    } 
    // 縦方向（まっすぐ下）は直線
    else {
        d = `M ${fx} ${fy} L ${tx} ${ty}`;
    }

    // クリック用の太い透明線
    const hit = svgEl('path');
    hit.classList.add('connection-hit');
    hit.setAttribute('d', d);
    hit.addEventListener('click', () => openConnEditor(conn.id));
    connectionsLayer.appendChild(hit);

    // 実線
    const path = svgEl('path');
    path.classList.add('connection-path');
    path.dataset.id = conn.id;
    path.setAttribute('d', d);
    path.addEventListener('click', () => openConnEditor(conn.id));
    connectionsLayer.appendChild(path);

    // ラベル
    if (conn.label) {
        let labelX, labelY;
        
        if (dy < 0) {
            // 上向きの場合は右側の中間点
            labelX = fx + 180;
            labelY = (fy + ty) / 2;
        } else {
            // 通常は中間点
            labelX = (fx + tx) / 2;
            labelY = (fy + ty) / 2;
        }
        
        const lw = conn.label.length * 8 + 14;
        const lh = 20;

        const bg = svgEl('rect');
        bg.classList.add('conn-label-bg');
        bg.setAttribute('x', labelX - lw / 2);
        bg.setAttribute('y', labelY - lh / 2);
        bg.setAttribute('width', lw);
        bg.setAttribute('height', lh);
        bg.setAttribute('rx', '4');
        bg.addEventListener('click', () => openConnEditor(conn.id));
        bg.style.cursor = 'pointer';
        connectionsLayer.appendChild(bg);

        const lt = svgEl('text');
        lt.classList.add('conn-label-text');
        lt.setAttribute('x', labelX);
        lt.setAttribute('y', labelY + 5);
        lt.setAttribute('text-anchor', 'middle');
        lt.textContent = conn.label;
        connectionsLayer.appendChild(lt);
    }
}

// ============================================================
// ノード追加
// ============================================================
function addNode() {
    const p = getProject();
    // 既存ノードの最下部に配置
    const maxY = p.nodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 0);
    const node = {
        id: uid(),
        type: 'scene',
        x: 80,
        y: maxY + GRID_ROW_H,
        title: '', // フローチャート表示用（旧データ互換性のため残す）
        color: '#ffffff',
        // ココフォリア用データ
        sceneName: '',
        sceneBackgroundColor: '#888888',
        workMemo: '',
        sceneContent: '',
        additionalContents: [] // { type: 'note'|'item', title: '', text: '' }
    };
    p.nodes.push(node);
    p.updatedAt = Date.now();
    save();
    renderChart();
    openNodeEditor(node.id);
}

// ============================================================
// 自動整列（分岐は横並び、矢印が重ならないように）
// ============================================================
function autoLayout() {
    const p = getProject();
    if (!p.nodes.length) return;

    // トポロジカルソートで順序を決定
    const sorted = topSort(p);

    // 各ノードのレベル（階層）を計算
    const level = {};
    sorted.forEach(node => {
        const incoming = p.connections.filter(c => c.to === node.id);
        if (incoming.length === 0) {
            level[node.id] = 0;
        } else {
            const maxParentLevel = Math.max(...incoming.map(c => level[c.from] ?? 0));
            level[node.id] = maxParentLevel + 1;
        }
    });

    // 各レベルごとにノードをグループ化
    const levels = {};
    p.nodes.forEach(node => {
        const lv = level[node.id] ?? 0;
        if (!levels[lv]) levels[lv] = [];
        levels[lv].push(node);
    });

    // 各ノードのX位置を記録（矢印の交差を避けるため）
    const nodeX = {};

    // 各レベルのノードを配置
    Object.keys(levels).sort((a, b) => Number(a) - Number(b)).forEach(lv => {
        const nodes = levels[lv];
        const levelNum = Number(lv);
        const y = 60 + levelNum * GRID_ROW_H;
        
        if (nodes.length === 1) {
            // 1つだけの場合
            const node = nodes[0];
            
            // 親ノードのX座標の平均を取る（矢印がまっすぐになるように）
            const parents = p.connections.filter(c => c.to === node.id).map(c => c.from);
            if (parents.length > 0 && parents.every(pid => nodeX[pid] !== undefined)) {
                const avgParentX = parents.reduce((sum, pid) => sum + nodeX[pid], 0) / parents.length;
                node.x = avgParentX;
            } else {
                node.x = 200; // デフォルト中央
            }
            node.y = y;
            nodeX[node.id] = node.x;
            
        } else {
            // 複数（分岐）の場合は横並び
            // 親ノードから出る矢印の順序に従って左から配置
            const parent = p.connections.find(c => nodes.some(n => n.id === c.to));
            
            if (parent) {
                // 親ノードのX座標を中心に横並び
                const parentX = nodeX[parent.from] ?? 200;
                const totalWidth = nodes.length * GRID_COL_W;
                const startX = parentX - totalWidth / 2 + GRID_COL_W / 2;
                
                // 親からの接続順でソート（左から右へ）
                const sortedNodes = [...nodes].sort((a, b) => {
                    const aConn = p.connections.find(c => c.from === parent.from && c.to === a.id);
                    const bConn = p.connections.find(c => c.from === parent.from && c.to === b.id);
                    return (aConn?.label || '').localeCompare(bConn?.label || '');
                });
                
                sortedNodes.forEach((node, i) => {
                    node.x = startX + i * GRID_COL_W;
                    node.y = y;
                    nodeX[node.id] = node.x;
                });
            } else {
                // 親がいない場合は均等配置
                const totalWidth = nodes.length * GRID_COL_W;
                const startX = 200 - totalWidth / 2 + GRID_COL_W / 2;
                nodes.forEach((node, i) => {
                    node.x = startX + i * GRID_COL_W;
                    node.y = y;
                    nodeX[node.id] = node.x;
                });
            }
        }
    });

    p.updatedAt = Date.now();
    save();
    renderChart();
    notify('自動整列しました');
}

// ============================================================
// ノードエディタ
// ============================================================
function openNodeEditor(nodeId) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === nodeId);
    if (!node) return;
    selectedNode = nodeId;

    // 旧データとの互換性
    if (!node.sceneName && node.title) node.sceneName = node.title;
    if (!node.sceneContent && node.content) node.sceneContent = node.content;
    if (!node.workMemo && node.npc) node.workMemo = node.npc;
    if (!node.sceneBackgroundColor) node.sceneBackgroundColor = '#888888';
    if (!node.additionalContents) node.additionalContents = [];

    document.getElementById('scene-name').value = node.sceneName || '';
    document.getElementById('scene-bg-color').value = node.sceneBackgroundColor || '#888888';
    document.getElementById('scene-bg-color-text').value = node.sceneBackgroundColor || '#888888';
    document.getElementById('work-memo').value = node.workMemo || '';
    document.getElementById('scene-content').value = node.sceneContent || '';
    document.getElementById('scene-also-as-item').checked = node.sceneAlsoAsItem || false;
    document.getElementById('node-color').value = node.color || '#ffffff';

    // 背景色の連動
    document.getElementById('scene-bg-color').oninput = (e) => {
        document.getElementById('scene-bg-color-text').value = e.target.value;
    };
    document.getElementById('scene-bg-color-text').oninput = (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            document.getElementById('scene-bg-color').value = val;
        }
    };

    renderAdditionalContents();
    nodeEditorModal.classList.remove('hidden');
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

function addAdditionalContent(type) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    if (!node.additionalContents) node.additionalContents = [];
    node.additionalContents.push({ type, title: '', text: '' });
    p.updatedAt = Date.now();
    save();
    renderAdditionalContents();
}

function removeAdditionalContent(idx) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    node.additionalContents.splice(idx, 1);
    p.updatedAt = Date.now();
    save();
    renderAdditionalContents();
}

function updateAdditionalContent(idx, field, value) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    node.additionalContents[idx][field] = value;
    p.updatedAt = Date.now();
    save();
}

// グローバルに公開
window.addAdditionalContent = addAdditionalContent;
window.removeAdditionalContent = removeAdditionalContent;
window.updateAdditionalContent = updateAdditionalContent;

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
    
    // フローチャート表示用（互換性のため）
    node.title = node.sceneName;

    p.updatedAt = Date.now();
    save();
    closeNodeEditor();
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

// ============================================================
// 接続エディタ
// ============================================================
function openConnEditor(connId) {
    const p = getProject();
    const conn = p.connections.find(c => c.id === connId);
    if (!conn) return;
    selectedConn = connId;
    document.getElementById('connection-label').value = conn.label || '';
    connEditorModal.classList.remove('hidden');
}

function closeConnEditor() {
    connEditorModal.classList.add('hidden');
    selectedConn = null;
}

function saveConn() {
    if (!selectedConn) return;
    const p = getProject();
    const conn = p.connections.find(c => c.id === selectedConn);
    if (!conn) return;
    conn.label = document.getElementById('connection-label').value;
    p.updatedAt = Date.now();
    save();
    closeConnEditor();
    renderChart();
}

function deleteConn() {
    if (!selectedConn) return;
    if (!confirm('この接続を削除しますか？')) return;
    const p = getProject();
    p.connections = p.connections.filter(c => c.id !== selectedConn);
    p.updatedAt = Date.now();
    save();
    closeConnEditor();
    renderChart();
}

// ============================================================
// 接続（矢印）作成
// ============================================================
function startConnect(nodeId) {
    isConnecting = true;
    connectingFrom = nodeId;
    canvas.classList.add('connecting');
    // ハイライト
    const g = nodesLayer.querySelector(`[data-id="${nodeId}"]`);
    if (g) {
        const shape = g.querySelector('.node-rect, .node-diamond');
        if (shape) { shape.style.stroke = '#4CAF50'; shape.style.strokeWidth = '4'; }
    }
    notify('接続先のノードをクリック / タップしてください（空白でキャンセル）');
}

function completeConnect(toId) {
    if (!isConnecting || !connectingFrom) return;
    if (connectingFrom === toId) { cancelConnect(); notify('同じノードには接続できません'); return; }
    const p = getProject();
    const exists = p.connections.some(c => c.from === connectingFrom && c.to === toId);
    if (!exists) {
        p.connections.push({ id: uid(), from: connectingFrom, to: toId, label: '' });
        p.updatedAt = Date.now();
        save();
        notify('接続しました');
    } else {
        notify('既に接続されています');
    }
    cancelConnect();
    renderChart();
}

function cancelConnect() {
    isConnecting = false;
    connectingFrom = null;
    canvas.classList.remove('connecting');
    renderChart();
}

// ============================================================
// マウス操作
// ============================================================
let _dragNode = null, _dragStartX = 0, _dragStartY = 0, _nodeOrigX = 0, _nodeOrigY = 0;

function onNodeMD(e, nodeId) {
    if (isConnecting) return;
    e.stopPropagation();
    isDraggingNode = false;
    _dragNode = nodeId;
    _dragStartX = e.clientX;
    _dragStartY = e.clientY;
    const node = getProject().nodes.find(n => n.id === nodeId);
    _nodeOrigX = node.x;
    _nodeOrigY = node.y;
}

function onCanvasMD(e) {
    if (isConnecting) { cancelConnect(); return; }
    if (e.target === canvas || e.target.closest('#canvas') === canvas) {
        isPanning = true;
        panStart = { x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y };
        canvas.classList.add('panning');
    }
}

function onWinMM(e) {
    if (_dragNode) {
        const dx = e.clientX - _dragStartX;
        const dy = e.clientY - _dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDraggingNode = true;
        if (isDraggingNode) {
            const node = getProject().nodes.find(n => n.id === _dragNode);
            node.x = _nodeOrigX + dx;
            node.y = _nodeOrigY + dy;
            const g = nodesLayer.querySelector(`[data-id="${_dragNode}"]`);
            if (g) g.setAttribute('transform', `translate(${node.x},${node.y})`);
            // 接続線だけ再描画
            connectionsLayer.innerHTML = '';
            getProject().connections.forEach(c => drawConnection(c));
        }
    }
    if (isPanning) {
        viewOffset.x = e.clientX - panStart.x;
        viewOffset.y = e.clientY - panStart.y;
        applyViewOffset();
    }
}

function onWinMU(e) {
    if (_dragNode && isDraggingNode) {
        getProject().updatedAt = Date.now();
        save();
    }
    _dragNode = null;
    setTimeout(() => { isDraggingNode = false; }, 50);
    if (isPanning) { isPanning = false; canvas.classList.remove('panning'); }
}

// マウスホイールでズーム
function onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.3, Math.min(2.0, viewScale + delta));
    
    // マウス位置を中心にズーム
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // スケール変更前のマウス位置（ワールド座標）
    const worldX = (mouseX - viewOffset.x) / viewScale;
    const worldY = (mouseY - viewOffset.y) / viewScale;
    
    // スケール変更
    viewScale = newScale;
    
    // スケール変更後もマウス位置が同じワールド座標を指すようにオフセット調整
    viewOffset.x = mouseX - worldX * viewScale;
    viewOffset.y = mouseY - worldY * viewScale;
    
    applyViewOffset();
}

// ============================================================
// タッチ操作
// ============================================================
let _touchNode = null, _touchOrigX = 0, _touchOrigY = 0, _touchStartX = 0, _touchStartY = 0;
let _longPressTimer = null, _touchDragging = false, _touchMoved = false;

function onNodeTS(e, nodeId) {
    if (isConnecting) { e.stopPropagation(); e.preventDefault(); completeConnect(nodeId); return; }
    e.stopPropagation();
    const touch = e.touches[0];
    _touchNode = nodeId;
    _touchStartX = touch.clientX;
    _touchStartY = touch.clientY;
    _touchMoved = false;
    _touchDragging = false;
    const node = getProject().nodes.find(n => n.id === nodeId);
    _touchOrigX = node.x;
    _touchOrigY = node.y;

    _longPressTimer = setTimeout(() => {
        _touchDragging = true;
        if (navigator.vibrate) navigator.vibrate(40);
        const g = nodesLayer.querySelector(`[data-id="${nodeId}"]`);
        if (g) g.style.opacity = '0.75';
        notify('ドラッグ中…');
    }, 450);
}

function onCanvasTS(e) {
    if (isConnecting) { cancelConnect(); return; }
    const touch = e.touches[0];
    isPanning = true;
    panStart = { x: touch.clientX - viewOffset.x, y: touch.clientY - viewOffset.y };
}

function onWinTM(e) {
    const touch = e.touches[0];
    if (_touchNode) {
        const dx = touch.clientX - _touchStartX;
        const dy = touch.clientY - _touchStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) _touchMoved = true;
        if (_touchDragging) {
            e.preventDefault();
            const node = getProject().nodes.find(n => n.id === _touchNode);
            node.x = _touchOrigX + dx;
            node.y = _touchOrigY + dy;
            const g = nodesLayer.querySelector(`[data-id="${_touchNode}"]`);
            if (g) g.setAttribute('transform', `translate(${node.x},${node.y})`);
            connectionsLayer.innerHTML = '';
            getProject().connections.forEach(c => drawConnection(c));
        }
    }
    if (isPanning && !_touchNode) {
        e.preventDefault();
        viewOffset.x = touch.clientX - panStart.x;
        viewOffset.y = touch.clientY - panStart.y;
        applyViewOffset();
    }
}

function onWinTU() {
    clearTimeout(_longPressTimer);
    if (_touchNode) {
        const g = nodesLayer.querySelector(`[data-id="${_touchNode}"]`);
        if (g) g.style.opacity = '';
        if (_touchDragging) {
            getProject().updatedAt = Date.now();
            save();
        } else if (!_touchMoved) {
            openNodeEditor(_touchNode);
        }
    }
    _touchNode = null;
    _touchDragging = false;
    isPanning = false;
}

// ============================================================
// エクスポート / インポート
// ============================================================
function exportCocofolia() {
    const p = getProject();
    if (!p.nodes.length) {
        notify('シーンがありません');
        return;
    }

    // 座標順（左上から右下へ）でシーンを並べる
    const sorted = positionSort(p);
    
    if (!p.characters) p.characters = [];

    // ココフォリア用の__data.jsonを作成
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

    // Notes を追加
    let noteOrder = 0;
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

    // Characters を追加
    p.characters.forEach(char => {
        const id = char.id || uid();
        data.entities.characters[id] = {
            id,
            name: char.name || 'キャラクター',
            playerName: char.playerName || '',
            color: "#888888",
            commands: char.commands || '',
            status: char.status || [],
            x: 0,
            y: 0,
            z: 0,
            width: 4,
            height: 4,
            active: true,
            secret: false,
            invisible: false,
            initiative: null,
            externalUrl: "",
            chatPalette: "",
            rotation: 0
        };
    });

    // Scenes を追加
    sorted.forEach((node, i) => {
        const id = node.id;
        data.entities.scenes[id] = {
            id,
            name: node.sceneName || node.title || `シーン${i + 1}`,
            text: node.sceneContent || '',
            backgroundColor: node.sceneBackgroundColor || '#888888',
            backgroundUrl: null,
            width: 80,
            height: 45,
            order: i
        };
    });

    // Items を追加
    sorted.forEach(node => {
        // Scenes本文がItemとしても出力される場合
        if (node.sceneAlsoAsItem && node.sceneContent) {
            const id = uid();
            data.entities.items[id] = {
                id,
                text: node.sceneName || 'シーン',
                memo: node.sceneContent || '',
                imageUrl: null,
                x: 0,
                y: 0,
                z: 0,
                width: 10,
                height: 10,
                locked: false,
                invisible: false
            };
        }
        
        // additionalContents
        if (node.additionalContents) {
            node.additionalContents.forEach(content => {
                // itemタイプは常に出力
                if (content.type === 'item') {
                    const id = uid();
                    data.entities.items[id] = {
                        id,
                        text: content.title || 'カード',
                        memo: content.text || '',
                        imageUrl: null,
                        x: 0,
                        y: 0,
                        z: 0,
                        width: 10,
                        height: 10,
                        locked: false,
                        invisible: false
                    };
                }
                // noteタイプでalsoAsItemがtrueの場合も出力
                else if (content.type === 'note' && content.alsoAsItem) {
                    const id = uid();
                    data.entities.items[id] = {
                        id,
                        text: content.title || 'Note',
                        memo: content.text || '',
                        imageUrl: null,
                        x: 0,
                        y: 0,
                        z: 0,
                        width: 10,
                        height: 10,
                        locked: false,
                        invisible: false
                    };
                }
            });
        }
    });

    try {
        // 軽量ZIP生成（外部ライブラリ不要）
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

function exportProjectJSON(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    dl(JSON.stringify(p, null, 2), `${p.name}.json`, 'application/json');
}

function importProject() {
    const input = document.getElementById('import-file-input');
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const p = JSON.parse(ev.target.result);
                p.id = uid();
                p.updatedAt = Date.now();
                projects.push(p);
                save();
                renderProjectList();
                notify('インポートしました');
            } catch { alert('ファイルの読み込みに失敗しました'); }
        };
        r.readAsText(file);
        input.value = '';
    };
    input.click();
}

function exportText() {
    const p = getProject();
    const sorted = positionSort(p);
    let text = `■ ${p.name}\n${'='.repeat(40)}\n\n`;
    sorted.forEach((node, i) => {
        text += `【${node.sceneName || node.title || `シーン${i + 1}`}】\n`;
        
        const content = node.sceneContent || node.content || '';
        if (content) {
            text += `\n〝${content}〟\n\n`;
        } else {
            text += `\n（本文なし）\n\n`;
        }
        
        // 追加コンテンツを入力順に出力（Note、Memo両方含む）
        if (node.additionalContents && node.additionalContents.length > 0) {
            node.additionalContents.forEach(item => {
                // memoタイプとnoteタイプのみテキスト出力に含める（itemは除外）
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
        notify('キャラクターが登録されていません');
        return;
    }

    let text = `■ ${p.name} - キャラクター一覧\n${'='.repeat(40)}\n\n`;
    
    p.characters.forEach((char, i) => {
        text += `【${char.name || `キャラクター${i + 1}`}】\n`;
        if (char.playerName) {
            text += `PL: ${char.playerName}\n`;
        }
        text += `\n`;
        
        // ステータス
        if (char.status && char.status.length > 0) {
            text += `◆ ステータス\n`;
            char.status.forEach(st => {
                if (st.label) {
                    text += `  ${st.label}: ${st.value}`;
                    if (st.max) text += ` / ${st.max}`;
                    text += `\n`;
                }
            });
            text += `\n`;
        }
        
        // チャットパレット
        if (char.commands) {
            text += `◆ チャットパレット\n`;
            text += char.commands.split('\n').map(line => `  ${line}`).join('\n');
            text += `\n\n`;
        }
        
        // メモ（テキスト出力専用）
        if (char.textOnlyMemo) {
            text += `◆ メモ\n`;
            text += char.textOnlyMemo.split('\n').map(line => `  ${line}`).join('\n');
            text += `\n`;
        }
        
        text += `\n${'-'.repeat(40)}\n\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => notify('キャラクター情報をコピーしました'));
}

function exportPDF() {
    notify('準備中です。テキスト出力をご利用ください。');
}

// ============================================================
// ユーティリティ
// ============================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function wrapText(text, maxWidth, fontSize) {
    // 簡易折り返し（文字数ベース）
    const charsPerLine = Math.floor(maxWidth / (fontSize * 0.65));
    const lines = [];
    let remaining = text;
    while (remaining.length > 0) {
        lines.push(remaining.slice(0, charsPerLine));
        remaining = remaining.slice(charsPerLine);
        if (lines.length >= 3) break;
    }
    return lines;
}

function notify(msg) {
    let el = document.querySelector('.notification');
    if (!el) { el = document.createElement('div'); el.className = 'notification'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

function dl(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function topSort(p) {
    const nodes = [...p.nodes];
    const deg = {};
    nodes.forEach(n => deg[n.id] = 0);
    p.connections.forEach(c => { deg[c.to] = (deg[c.to] || 0) + 1; });
    const q = nodes.filter(n => !deg[n.id]);
    const result = [];
    while (q.length) {
        const n = q.shift();
        result.push(n);
        p.connections.filter(c => c.from === n.id).forEach(c => {
            deg[c.to]--;
            if (deg[c.to] === 0) { const nx = nodes.find(x => x.id === c.to); if (nx) q.push(nx); }
        });
    }
    nodes.forEach(n => { if (!result.includes(n)) result.push(n); });
    return result;
}

// 座標順ソート（左上から右下へ）
function positionSort(p) {
    const nodes = [...p.nodes];
    // Y座標優先、次にX座標でソート
    nodes.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) {
            // ほぼ同じ高さなら左から右
            return a.x - b.x;
        }
        // 上から下
        return a.y - b.y;
    });
    return nodes;
}

// ============================================================
// キャラクター管理
// ============================================================
function openCharactersModal() {
    const modal = document.getElementById('characters-modal');
    renderCharactersList();
    modal.classList.remove('hidden');
}

function closeCharactersModal() {
    document.getElementById('characters-modal').classList.add('hidden');
}

function renderCharactersList() {
    const p = getProject();
    if (!p.characters) p.characters = [];
    
    const list = document.getElementById('characters-list');
    list.innerHTML = '';
    
    if (p.characters.length === 0) {
        list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">キャラクターがありません</p>';
        return;
    }
    
    p.characters.forEach((char, idx) => {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.innerHTML = `
            <div class="character-card-header">
                <span class="character-card-title">${esc(char.name || 'キャラクター' + (idx + 1))}</span>
                <button class="danger-btn" onclick="deleteCharacter(${idx})">削除</button>
            </div>
            <div class="form-group">
                <label>キャラクター名</label>
                <input type="text" value="${esc(char.name)}" onchange="updateCharacter(${idx}, 'name', this.value)">
            </div>
            <div class="form-group">
                <label>プレイヤー名</label>
                <input type="text" value="${esc(char.playerName)}" onchange="updateCharacter(${idx}, 'playerName', this.value)">
            </div>
            <div class="form-group">
                <label>ステータス</label>
                <div class="status-list" id="status-list-${idx}"></div>
                <button type="button" class="secondary-btn" onclick="addStatus(${idx})" style="margin-top:8px;font-size:12px;">+ ステータス追加</button>
            </div>
            <div class="form-group">
                <label>チャットパレット</label>
                <textarea rows="4" onchange="updateCharacter(${idx}, 'commands', this.value)">${esc(char.commands || '')}</textarea>
            </div>
            <div class="form-group">
                <label>メモ（テキスト出力専用・ココフォリア非反映）</label>
                <textarea rows="3" placeholder="このキャラクターに関する補足情報など" onchange="updateCharacter(${idx}, 'textOnlyMemo', this.value)">${esc(char.textOnlyMemo || '')}</textarea>
            </div>
        `;
        list.appendChild(card);
        
        renderStatusList(idx);
    });
}

function renderStatusList(charIdx) {
    const p = getProject();
    const char = p.characters[charIdx];
    if (!char.status) char.status = [];
    
    const statusList = document.getElementById(`status-list-${charIdx}`);
    statusList.innerHTML = '';
    
    char.status.forEach((st, stIdx) => {
        const div = document.createElement('div');
        div.className = 'status-item';
        div.innerHTML = `
            <input type="text" placeholder="ラベル" value="${esc(st.label)}" onchange="updateStatus(${charIdx}, ${stIdx}, 'label', this.value)">
            <input type="text" placeholder="値" value="${esc(st.value)}" onchange="updateStatus(${charIdx}, ${stIdx}, 'value', this.value)">
            <input type="text" placeholder="最大" value="${esc(st.max)}" onchange="updateStatus(${charIdx}, ${stIdx}, 'max', this.value)">
            <button class="danger-btn" onclick="removeStatus(${charIdx}, ${stIdx})">×</button>
        `;
        statusList.appendChild(div);
    });
}

function addCharacter() {
    const p = getProject();
    if (!p.characters) p.characters = [];
    p.characters.push({
        id: uid(),
        name: '',
        playerName: '',
        status: [],
        commands: ''
    });
    p.updatedAt = Date.now();
    save();
    renderCharactersList();
}

function deleteCharacter(idx) {
    if (!confirm('このキャラクターを削除しますか？')) return;
    const p = getProject();
    p.characters.splice(idx, 1);
    p.updatedAt = Date.now();
    save();
    renderCharactersList();
}

function updateCharacter(idx, field, value) {
    const p = getProject();
    p.characters[idx][field] = value;
    p.updatedAt = Date.now();
    save();
}

function addStatus(charIdx) {
    const p = getProject();
    p.characters[charIdx].status.push({ label: '', value: '', max: '' });
    p.updatedAt = Date.now();
    save();
    renderStatusList(charIdx);
}

function removeStatus(charIdx, stIdx) {
    const p = getProject();
    p.characters[charIdx].status.splice(stIdx, 1);
    p.updatedAt = Date.now();
    save();
    renderStatusList(charIdx);
}

function updateStatus(charIdx, stIdx, field, value) {
    const p = getProject();
    p.characters[charIdx].status[stIdx][field] = value;
    p.updatedAt = Date.now();
    save();
}

// グローバルに公開
window.addCharacter = addCharacter;
window.deleteCharacter = deleteCharacter;
window.updateCharacter = updateCharacter;
window.addStatus = addStatus;
window.removeStatus = removeStatus;
window.updateStatus = updateStatus;

// ============================================================
// 軽量ZIP生成（外部ライブラリ不要）
// ============================================================
function createZipBlob(filename, content) {
    // CRC32計算
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
    
    // DOS日時形式に変換
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
    
    // Local file header
    const lfh = new Uint8Array(30 + filenameBytes.length);
    const lfhView = new DataView(lfh.buffer);
    lfhView.setUint32(0, 0x04034b50, true); // signature
    lfhView.setUint16(4, 20, true); // version needed
    lfhView.setUint16(6, 0, true); // flags
    lfhView.setUint16(8, 0, true); // compression (stored)
    lfhView.setUint16(10, time, true);
    lfhView.setUint16(12, date, true);
    lfhView.setUint32(14, crc, true);
    lfhView.setUint32(18, fileBytes.length, true); // compressed size
    lfhView.setUint32(22, fileBytes.length, true); // uncompressed size
    lfhView.setUint16(26, filenameBytes.length, true);
    lfhView.setUint16(28, 0, true); // extra field length
    lfh.set(filenameBytes, 30);
    
    // Central directory header
    const cdh = new Uint8Array(46 + filenameBytes.length);
    const cdhView = new DataView(cdh.buffer);
    cdhView.setUint32(0, 0x02014b50, true); // signature
    cdhView.setUint16(4, 20, true); // version made by
    cdhView.setUint16(6, 20, true); // version needed
    cdhView.setUint16(8, 0, true); // flags
    cdhView.setUint16(10, 0, true); // compression
    cdhView.setUint16(12, time, true);
    cdhView.setUint16(14, date, true);
    cdhView.setUint32(16, crc, true);
    cdhView.setUint32(20, fileBytes.length, true);
    cdhView.setUint32(24, fileBytes.length, true);
    cdhView.setUint16(28, filenameBytes.length, true);
    cdhView.setUint16(30, 0, true); // extra field length
    cdhView.setUint16(32, 0, true); // comment length
    cdhView.setUint16(34, 0, true); // disk number
    cdhView.setUint16(36, 0, true); // internal attrs
    cdhView.setUint32(38, 0, true); // external attrs
    cdhView.setUint32(42, 0, true); // offset of local header
    cdh.set(filenameBytes, 46);
    
    // End of central directory
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // signature
    eocdView.setUint16(4, 0, true); // disk number
    eocdView.setUint16(6, 0, true); // disk with central dir
    eocdView.setUint16(8, 1, true); // entries on this disk
    eocdView.setUint16(10, 1, true); // total entries
    eocdView.setUint32(12, cdh.length, true); // central dir size
    eocdView.setUint32(16, lfh.length + fileBytes.length, true); // offset of central dir
    eocdView.setUint16(20, 0, true); // comment length
    
    // Combine all parts
    const zipData = new Uint8Array(lfh.length + fileBytes.length + cdh.length + eocd.length);
    zipData.set(lfh, 0);
    zipData.set(fileBytes, lfh.length);
    zipData.set(cdh, lfh.length + fileBytes.length);
    zipData.set(eocd, lfh.length + fileBytes.length + cdh.length);
    
    return new Blob([zipData], { type: 'application/zip' });
}

// ============================================================
// 起動
// ============================================================
init();

// ============================================================
// 補助ツール機能
// ============================================================

// 技能・記法データ
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

// 現在選択中のバージョン
let currentVersion = 'common';
let currentSubtab = 'skills';

// 補助ツールタブの初期化
function initAssistTool() {
    // メインタブ切り替え
    document.querySelectorAll('.node-editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.node-editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.node-editor-tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(targetTab + '-panel').classList.add('active');
        });
    });

    // サブタブ切り替え
    document.querySelectorAll('.assist-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentSubtab = tab.dataset.subtab;
            document.querySelectorAll('.assist-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.assist-subtab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(currentSubtab + '-panel').classList.add('active');
        });
    });

    // バージョン切り替え
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

// ボタンをレンダリング
function renderAssistButtons() {
    // 技能ボタン
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

    // 記法ボタン
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

// テキストを挿入
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

