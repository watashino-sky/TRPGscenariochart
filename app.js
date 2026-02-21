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
let selectedNode    = null;
let selectedConn    = null;

// ============================================================
// 初期化
// ============================================================
function init() {
    loadProjects();
    setupListeners();
    renderProjectList();
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

    // エクスポート
    document.getElementById('export-json-btn').onclick = exportJSON;
    document.getElementById('export-text-btn').onclick = exportText;
    document.getElementById('export-pdf-btn').onclick  = exportPDF;

    // ノードエディタ
    document.getElementById('close-editor-btn').onclick  = closeNodeEditor;
    document.getElementById('save-node-btn').onclick     = saveNode;
    document.getElementById('delete-node-btn').onclick   = deleteNode;
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
    const p = { id: uid(), name, nodes: [], connections: [], createdAt: Date.now(), updatedAt: Date.now() };
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
    nodesLayer.setAttribute('transform', `translate(${viewOffset.x},${viewOffset.y})`);
    connectionsLayer.setAttribute('transform', `translate(${viewOffset.x},${viewOffset.y})`);
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

    // 縦方向はストレート、斜めは曲線
    const dx = tx - fx;
    const dy = ty - fy;
    const midY = fy + dy * 0.5;
    const d = Math.abs(dx) < 20
        ? `M ${fx} ${fy} L ${tx} ${ty}`
        : `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

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
        const midX = (fx + tx) / 2;
        const labelY = (fy + ty) / 2;
        const lw = conn.label.length * 8 + 14;
        const lh = 20;

        const bg = svgEl('rect');
        bg.classList.add('conn-label-bg');
        bg.setAttribute('x', midX - lw / 2);
        bg.setAttribute('y', labelY - lh / 2);
        bg.setAttribute('width', lw);
        bg.setAttribute('height', lh);
        bg.setAttribute('rx', '4');
        bg.addEventListener('click', () => openConnEditor(conn.id));
        bg.style.cursor = 'pointer';
        connectionsLayer.appendChild(bg);

        const lt = svgEl('text');
        lt.classList.add('conn-label-text');
        lt.setAttribute('x', midX);
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
        title: '',
        npc: '',
        content: '',
        color: '#ffffff'
    };
    p.nodes.push(node);
    p.updatedAt = Date.now();
    save();
    renderChart();
    openNodeEditor(node.id);
}

// ============================================================
// 自動整列（縦1列）
// ============================================================
function autoLayout() {
    const p = getProject();
    if (!p.nodes.length) return;

    // トポロジカルソートで順序を決定
    const sorted = topSort(p);

    // 縦1列に配置（中央寄せ）
    const centerX = 200; // 画面中央付近
    sorted.forEach((node, i) => {
        node.x = centerX;
        node.y = 60 + i * GRID_ROW_H;
    });

    p.updatedAt = Date.now();
    save();
    renderChart();
    notify('縦1列に整列しました');
}

// ============================================================
// ノードエディタ
// ============================================================
function openNodeEditor(nodeId) {
    const p = getProject();
    const node = p.nodes.find(n => n.id === nodeId);
    if (!node) return;
    selectedNode = nodeId;

    document.getElementById('node-title').value   = node.title || '';
    document.getElementById('node-npc').value     = node.npc || '';
    document.getElementById('node-content').value = node.content || '';
    document.getElementById('node-color').value   = node.color || '#ffffff';

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

    node.type    = 'scene';
    node.title   = document.getElementById('node-title').value;
    node.npc     = document.getElementById('node-npc').value;
    node.content = document.getElementById('node-content').value;
    node.color   = document.getElementById('node-color').value;

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
function exportJSON() {
    const p = getProject();
    dl(JSON.stringify(p, null, 2), `${p.name}.json`, 'application/json');
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
    const sorted = topSort(p);
    let text = `■ ${p.name}\n${'='.repeat(40)}\n\n`;
    sorted.forEach((node, i) => {
        text += `【${node.title || `シーン${i + 1}`}】\n`;
        if (node.npc) text += `登場NPC：${node.npc}\n`;
        text += `\n${node.content || '（本文なし）'}\n\n`;
        const outs = p.connections.filter(c => c.from === node.id);
        if (outs.length) {
            outs.forEach(c => {
                const to = p.nodes.find(n => n.id === c.to);
                text += `  ${c.label ? `[${c.label}]` : '▼'} → ${to?.title || '？'}\n`;
            });
        }
        text += `\n${'-'.repeat(40)}\n\n`;
    });
    navigator.clipboard.writeText(text).then(() => notify('テキストをコピーしました'));
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

// ============================================================
// 起動
// ============================================================
init();
