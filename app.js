// データ構造
let projects = [];
let currentProjectId = null;

// UIエレメント
const projectListScreen = document.getElementById('project-list-screen');
const chartScreen = document.getElementById('chart-screen');
const projectList = document.getElementById('project-list');
const projectTitle = document.getElementById('project-title');

// キャンバス
const canvas = document.getElementById('canvas');
const nodesLayer = document.getElementById('nodes-layer');
const connectionsLayer = document.getElementById('connections-layer');

// モーダル
const nodeEditorModal = document.getElementById('node-editor-modal');
const connectionEditorModal = document.getElementById('connection-editor-modal');
const newProjectModal = document.getElementById('new-project-modal');

// 状態管理
let isDraggingCanvas = false;
let isDraggingNode = false;
let isConnecting = false;
let dragStartPos = { x: 0, y: 0 };
let canvasOffset = { x: 0, y: 0 };
let selectedNode = null;
let selectedConnection = null;
let connectingFrom = null;

// 初期化
function init() {
    loadProjects();
    setupEventListeners();
    renderProjectList();
}

// ローカルストレージからプロジェクトを読み込み
function loadProjects() {
    const stored = localStorage.getItem('trpg-scenario-projects');
    if (stored) {
        projects = JSON.parse(stored);
    }
}

// ローカルストレージに保存
function saveProjects() {
    localStorage.setItem('trpg-scenario-projects', JSON.stringify(projects));
}

// イベントリスナーの設定
function setupEventListeners() {
    // プロジェクト管理
    document.getElementById('new-project-btn').addEventListener('click', () => {
        newProjectModal.classList.remove('hidden');
    });
    
    document.getElementById('close-new-project-btn').addEventListener('click', () => {
        newProjectModal.classList.add('hidden');
    });
    
    document.getElementById('cancel-new-project-btn').addEventListener('click', () => {
        newProjectModal.classList.add('hidden');
    });
    
    document.getElementById('create-project-btn').addEventListener('click', createProject);
    
    document.getElementById('back-to-projects-btn').addEventListener('click', () => {
        chartScreen.classList.add('hidden');
        projectListScreen.classList.remove('hidden');
        currentProjectId = null;
    });
    
    // インポート/エクスポート
    document.getElementById('import-project-btn').addEventListener('click', importProject);
    document.getElementById('export-json-btn').addEventListener('click', exportJSON);
    document.getElementById('export-text-btn').addEventListener('click', exportText);
    document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
    
    // ノード追加
    document.getElementById('add-node-btn').addEventListener('click', addNode);
    
    // ノードエディタ
    document.getElementById('close-editor-btn').addEventListener('click', closeNodeEditor);
    document.getElementById('save-node-btn').addEventListener('click', saveNode);
    document.getElementById('delete-node-btn').addEventListener('click', deleteNode);
    
    // カラーピッカー
    document.getElementById('node-color').addEventListener('input', (e) => {
        document.getElementById('color-preview').style.backgroundColor = e.target.value;
    });
    
    // 接続エディタ
    document.getElementById('close-connection-editor-btn').addEventListener('click', closeConnectionEditor);
    document.getElementById('save-connection-btn').addEventListener('click', saveConnection);
    document.getElementById('delete-connection-btn').addEventListener('click', deleteConnection);
    
    // キャンバス操作（マウス）
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    
    // キャンバス操作（タッチ）
    canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', onCanvasTouchEnd, { passive: false });
    
    // Enterキーでプロジェクト作成
    document.getElementById('new-project-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createProject();
        }
    });
    
    // Escキーで接続モードをキャンセル
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isConnecting) {
            cancelConnection();
            showNotification('接続をキャンセルしました');
        }
    });
}

// プロジェクト一覧の描画
function renderProjectList() {
    projectList.innerHTML = '';
    
    if (projects.length === 0) {
        projectList.innerHTML = `
            <div class="empty-state">
                <h3>プロジェクトがありません</h3>
                <p>「新規プロジェクト」ボタンから作成してください</p>
            </div>
        `;
        return;
    }
    
    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${escapeHtml(project.name)}</h3>
            <div class="project-info">
                ノード数: ${project.nodes.length}<br>
                最終更新: ${new Date(project.updatedAt).toLocaleString('ja-JP')}
            </div>
            <div class="project-actions">
                <button class="secondary-btn export-btn" data-id="${project.id}">エクスポート</button>
                <button class="danger-btn delete-btn" data-id="${project.id}">削除</button>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('export-btn') && !e.target.classList.contains('delete-btn')) {
                openProject(project.id);
            }
        });
        
        card.querySelector('.export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            exportProjectJSON(project.id);
        });
        
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`「${project.name}」を削除しますか？`)) {
                deleteProject(project.id);
            }
        });
        
        projectList.appendChild(card);
    });
}

// 新規プロジェクト作成
function createProject() {
    const name = document.getElementById('new-project-name').value.trim();
    if (!name) {
        alert('プロジェクト名を入力してください');
        return;
    }
    
    const project = {
        id: generateId(),
        name: name,
        nodes: [],
        connections: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    projects.push(project);
    saveProjects();
    
    document.getElementById('new-project-name').value = '';
    newProjectModal.classList.add('hidden');
    
    renderProjectList();
}

// プロジェクトを開く
function openProject(id) {
    currentProjectId = id;
    const project = getCurrentProject();
    
    projectTitle.textContent = project.name;
    projectListScreen.classList.add('hidden');
    chartScreen.classList.remove('hidden');
    
    renderChart();
}

// プロジェクト削除
function deleteProject(id) {
    projects = projects.filter(p => p.id !== id);
    saveProjects();
    renderProjectList();
}

// 現在のプロジェクトを取得
function getCurrentProject() {
    return projects.find(p => p.id === currentProjectId);
}

// チャートの描画
function renderChart() {
    const project = getCurrentProject();
    
    // ノードレイヤーをクリア
    nodesLayer.innerHTML = '';
    
    // 接続レイヤーをクリア
    connectionsLayer.innerHTML = '';
    
    // 接続を描画
    project.connections.forEach(conn => {
        renderConnection(conn);
    });
    
    // ノードを描画
    project.nodes.forEach(node => {
        renderNode(node);
    });
}

// ノードの描画
function renderNode(node) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.setAttribute('data-id', node.id);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    
    // 背景矩形
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('node-rect');
    rect.setAttribute('width', '200');
    rect.setAttribute('height', '80');
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', node.color || '#ffffff');
    
    // タイトル
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.classList.add('node-title');
    title.setAttribute('x', '10');
    title.setAttribute('y', '25');
    title.textContent = truncateText(node.title || '未設定', 20);
    
    // プレビュー
    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    preview.classList.add('node-preview');
    preview.setAttribute('x', '10');
    preview.setAttribute('y', '45');
    preview.textContent = truncateText(node.content || '', 25);
    
    g.appendChild(rect);
    g.appendChild(title);
    g.appendChild(preview);
    
    // イベントリスナー
    g.addEventListener('mousedown', (e) => onNodeMouseDown(e, node.id));
    g.addEventListener('touchstart', (e) => onNodeTouchStart(e, node.id), { passive: false });
    g.addEventListener('click', (e) => {
        if (!isDraggingNode) {
            openNodeEditor(node.id);
        }
    });
    
    // 接続開始ポイント（右側）
    const connectPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    connectPoint.classList.add('connect-point');
    connectPoint.setAttribute('cx', '200');
    connectPoint.setAttribute('cy', '40');
    connectPoint.setAttribute('r', '12');
    connectPoint.setAttribute('fill', '#4CAF50');
    connectPoint.setAttribute('stroke', '#fff');
    connectPoint.setAttribute('stroke-width', '2');
    connectPoint.style.cursor = 'pointer';
    connectPoint.setAttribute('data-connect', 'true');
    
    connectPoint.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startConnection(node.id);
    });
    
    connectPoint.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startConnection(node.id);
    }, { passive: false });
    
    g.appendChild(connectPoint);
    
    nodesLayer.appendChild(g);
}

// 接続の描画
function renderConnection(conn) {
    const project = getCurrentProject();
    const fromNode = project.nodes.find(n => n.id === conn.from);
    const toNode = project.nodes.find(n => n.id === conn.to);
    
    if (!fromNode || !toNode) return;
    
    const fromX = fromNode.x + 200;
    const fromY = fromNode.y + 40;
    const toX = toNode.x;
    const toY = toNode.y + 40;
    
    // 曲線を作成（ベジェ曲線）
    const midX = (fromX + toX) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('connection');
    path.setAttribute('data-id', conn.id);
    path.setAttribute('d', `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`);
    
    path.addEventListener('click', () => openConnectionEditor(conn.id));
    
    connectionsLayer.appendChild(path);
    
    // ラベルがある場合
    if (conn.label) {
        const labelX = midX;
        const labelY = (fromY + toY) / 2;
        
        // 背景
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.classList.add('connection-label-bg');
        const labelWidth = conn.label.length * 8 + 10;
        labelBg.setAttribute('x', labelX - labelWidth / 2);
        labelBg.setAttribute('y', labelY - 12);
        labelBg.setAttribute('width', labelWidth);
        labelBg.setAttribute('height', '20');
        labelBg.setAttribute('rx', '4');
        
        // テキスト
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.classList.add('connection-label');
        labelText.setAttribute('x', labelX);
        labelText.setAttribute('y', labelY + 4);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.textContent = conn.label;
        
        labelText.addEventListener('click', () => openConnectionEditor(conn.id));
        
        connectionsLayer.appendChild(labelBg);
        connectionsLayer.appendChild(labelText);
    }
}

// ノード追加
function addNode() {
    const project = getCurrentProject();
    
    const node = {
        id: generateId(),
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        title: '',
        npc: '',
        content: '',
        color: '#ffffff'
    };
    
    project.nodes.push(node);
    project.updatedAt = Date.now();
    saveProjects();
    
    renderChart();
    openNodeEditor(node.id);
}

// ノードエディタを開く
function openNodeEditor(nodeId) {
    const project = getCurrentProject();
    const node = project.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    selectedNode = nodeId;
    
    document.getElementById('node-title').value = node.title || '';
    document.getElementById('node-npc').value = node.npc || '';
    document.getElementById('node-content').value = node.content || '';
    document.getElementById('node-color').value = node.color || '#ffffff';
    document.getElementById('color-preview').style.backgroundColor = node.color || '#ffffff';
    
    nodeEditorModal.classList.remove('hidden');
}

// ノードエディタを閉じる
function closeNodeEditor() {
    nodeEditorModal.classList.add('hidden');
    selectedNode = null;
}

// ノードを保存
function saveNode() {
    if (!selectedNode) return;
    
    const project = getCurrentProject();
    const node = project.nodes.find(n => n.id === selectedNode);
    if (!node) return;
    
    node.title = document.getElementById('node-title').value;
    node.npc = document.getElementById('node-npc').value;
    node.content = document.getElementById('node-content').value;
    node.color = document.getElementById('node-color').value;
    
    project.updatedAt = Date.now();
    saveProjects();
    
    closeNodeEditor();
    renderChart();
}

// ノードを削除
function deleteNode() {
    if (!selectedNode) return;
    if (!confirm('このノードを削除しますか？')) return;
    
    const project = getCurrentProject();
    
    // ノードを削除
    project.nodes = project.nodes.filter(n => n.id !== selectedNode);
    
    // 関連する接続を削除
    project.connections = project.connections.filter(c => 
        c.from !== selectedNode && c.to !== selectedNode
    );
    
    project.updatedAt = Date.now();
    saveProjects();
    
    closeNodeEditor();
    renderChart();
}

// 接続開始
function startConnection(nodeId) {
    isConnecting = true;
    connectingFrom = nodeId;
    
    // 接続モードの視覚的フィードバック
    canvas.style.cursor = 'crosshair';
    
    // 接続元ノードをハイライト
    const nodeElement = nodesLayer.querySelector(`[data-id="${nodeId}"]`);
    if (nodeElement) {
        const rect = nodeElement.querySelector('.node-rect');
        rect.style.stroke = '#4CAF50';
        rect.style.strokeWidth = '4';
    }
    
    // 通知を表示
    showNotification('接続先のノードをクリック/タップしてください');
}

// 接続完了
function completeConnection(toNodeId) {
    if (!isConnecting || !connectingFrom) return;
    if (connectingFrom === toNodeId) {
        // 自己接続は禁止
        cancelConnection();
        showNotification('同じノード同士は接続できません');
        return;
    }
    
    const project = getCurrentProject();
    
    // 既に接続されているか確認
    const exists = project.connections.some(c => 
        c.from === connectingFrom && c.to === toNodeId
    );
    
    if (!exists) {
        const connection = {
            id: generateId(),
            from: connectingFrom,
            to: toNodeId,
            label: ''
        };
        
        project.connections.push(connection);
        project.updatedAt = Date.now();
        saveProjects();
        
        showNotification('接続を作成しました');
        renderChart();
    } else {
        showNotification('既に接続されています');
    }
    
    cancelConnection();
}

// 接続をキャンセル
function cancelConnection() {
    isConnecting = false;
    connectingFrom = null;
    canvas.style.cursor = 'grab';
    renderChart();
}

// 接続エディタを開く
function openConnectionEditor(connId) {
    const project = getCurrentProject();
    const conn = project.connections.find(c => c.id === connId);
    if (!conn) return;
    
    selectedConnection = connId;
    
    document.getElementById('connection-label').value = conn.label || '';
    
    connectionEditorModal.classList.remove('hidden');
}

// 接続エディタを閉じる
function closeConnectionEditor() {
    connectionEditorModal.classList.add('hidden');
    selectedConnection = null;
}

// 接続を保存
function saveConnection() {
    if (!selectedConnection) return;
    
    const project = getCurrentProject();
    const conn = project.connections.find(c => c.id === selectedConnection);
    if (!conn) return;
    
    conn.label = document.getElementById('connection-label').value;
    
    project.updatedAt = Date.now();
    saveProjects();
    
    closeConnectionEditor();
    renderChart();
}

// 接続を削除
function deleteConnection() {
    if (!selectedConnection) return;
    if (!confirm('この接続を削除しますか？')) return;
    
    const project = getCurrentProject();
    project.connections = project.connections.filter(c => c.id !== selectedConnection);
    
    project.updatedAt = Date.now();
    saveProjects();
    
    closeConnectionEditor();
    renderChart();
}

// マウスイベント
function onCanvasMouseDown(e) {
    if (e.target === canvas) {
        // 接続モード中ならキャンセル
        if (isConnecting) {
            cancelConnection();
            showNotification('接続をキャンセルしました');
            return;
        }
        
        isDraggingCanvas = true;
        dragStartPos = { x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y };
        canvas.classList.add('dragging');
    }
}

function onCanvasMouseMove(e) {
    if (isDraggingCanvas) {
        canvasOffset.x = e.clientX - dragStartPos.x;
        canvasOffset.y = e.clientY - dragStartPos.y;
        
        nodesLayer.setAttribute('transform', `translate(${canvasOffset.x}, ${canvasOffset.y})`);
        connectionsLayer.setAttribute('transform', `translate(${canvasOffset.x}, ${canvasOffset.y})`);
    }
}

function onCanvasMouseUp(e) {
    isDraggingCanvas = false;
    isDraggingNode = false;
    canvas.classList.remove('dragging');
}

function onNodeMouseDown(e, nodeId) {
    if (isConnecting) {
        e.stopPropagation();
        completeConnection(nodeId);
        return;
    }
    
    e.stopPropagation();
    e.preventDefault();
    
    isDraggingNode = true;
    const node = getCurrentProject().nodes.find(n => n.id === nodeId);
    
    const nodeElement = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const originalX = node.x;
    const originalY = node.y;
    
    function onMouseMove(e) {
        const dx = (e.clientX - startX);
        const dy = (e.clientY - startY);
        
        node.x = originalX + dx;
        node.y = originalY + dy;
        
        nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        // 接続を再描画
        renderChart();
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        const project = getCurrentProject();
        project.updatedAt = Date.now();
        saveProjects();
        
        setTimeout(() => {
            isDraggingNode = false;
        }, 100);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function onNodeTouchStart(e, nodeId) {
    if (isConnecting) {
        e.stopPropagation();
        e.preventDefault();
        completeConnection(nodeId);
        return;
    }
    
    e.stopPropagation();
    
    const touch = e.touches[0];
    const node = getCurrentProject().nodes.find(n => n.id === nodeId);
    const nodeElement = e.currentTarget;
    
    let longPressTimer = null;
    let hasMoved = false;
    let isDragging = false;
    
    const startX = touch.clientX;
    const startY = touch.clientY;
    const originalX = node.x;
    const originalY = node.y;
    
    // 長押しタイマー（500ms）
    longPressTimer = setTimeout(() => {
        e.preventDefault();
        isDragging = true;
        isDraggingNode = true;
        
        // 視覚的フィードバック（ノードを少し拡大）
        nodeElement.style.transform = 'scale(1.1)';
        nodeElement.style.opacity = '0.8';
        
        // 振動フィードバック（対応デバイスのみ）
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, 500);
    
    function onTouchMove(e) {
        hasMoved = true;
        
        if (isDragging) {
            e.preventDefault();
            const touch = e.touches[0];
            const dx = (touch.clientX - startX);
            const dy = (touch.clientY - startY);
            
            node.x = originalX + dx;
            node.y = originalY + dy;
            
            nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            
            // 接続を再描画
            renderChart();
        }
    }
    
    function onTouchEnd(e) {
        clearTimeout(longPressTimer);
        
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        
        if (isDragging) {
            // ドラッグ終了
            nodeElement.style.transform = '';
            nodeElement.style.opacity = '';
            
            const project = getCurrentProject();
            project.updatedAt = Date.now();
            saveProjects();
            
            setTimeout(() => {
                isDraggingNode = false;
            }, 100);
        } else if (!hasMoved) {
            // タップ（長押しせず、移動もしていない）
            openNodeEditor(nodeId);
        }
    }
    
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
}

// キャンバスのタッチイベント
function onCanvasTouchStart(e) {
    if (e.target === canvas) {
        // 接続モード中ならキャンセル
        if (isConnecting) {
            cancelConnection();
            showNotification('接続をキャンセルしました');
            return;
        }
        
        isDraggingCanvas = true;
        const touch = e.touches[0];
        dragStartPos = { x: touch.clientX - canvasOffset.x, y: touch.clientY - canvasOffset.y };
        e.preventDefault();
    }
}

function onCanvasTouchMove(e) {
    if (isDraggingCanvas) {
        e.preventDefault();
        const touch = e.touches[0];
        canvasOffset.x = touch.clientX - dragStartPos.x;
        canvasOffset.y = touch.clientY - dragStartPos.y;
        
        nodesLayer.setAttribute('transform', `translate(${canvasOffset.x}, ${canvasOffset.y})`);
        connectionsLayer.setAttribute('transform', `translate(${canvasOffset.x}, ${canvasOffset.y})`);
    }
}

function onCanvasTouchEnd(e) {
    isDraggingCanvas = false;
    isDraggingNode = false;
}

// JSONエクスポート
function exportJSON() {
    const project = getCurrentProject();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.json`;
    a.click();
}

// プロジェクト個別エクスポート
function exportProjectJSON(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.json`;
    a.click();
}

// JSONインポート
function importProject() {
    const input = document.getElementById('import-file-input');
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const project = JSON.parse(event.target.result);
                
                // IDを新規生成
                project.id = generateId();
                project.updatedAt = Date.now();
                
                projects.push(project);
                saveProjects();
                renderProjectList();
                
                alert('プロジェクトをインポートしました');
            } catch (err) {
                alert('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
        
        // リセット
        input.value = '';
    };
    
    input.click();
}

// テキストエクスポート
function exportText() {
    const project = getCurrentProject();
    let text = `# ${project.name}\n\n`;
    
    // トポロジカルソートでノードを順序付け
    const sortedNodes = topologicalSort(project);
    
    sortedNodes.forEach((node, index) => {
        text += `## ${node.title || `シーン${index + 1}`}\n`;
        
        if (node.npc) {
            text += `登場NPC: ${node.npc}\n`;
        }
        
        text += `\n${node.content}\n\n`;
        
        // このノードからの接続を表示
        const outgoing = project.connections.filter(c => c.from === node.id);
        if (outgoing.length > 0) {
            text += '---\n';
            outgoing.forEach(conn => {
                const toNode = project.nodes.find(n => n.id === conn.to);
                const label = conn.label ? `${conn.label} → ` : '→ ';
                text += `${label}${toNode?.title || '未設定'}\n`;
            });
            text += '\n';
        }
        
        text += '---\n\n';
    });
    
    // クリップボードにコピー
    navigator.clipboard.writeText(text).then(() => {
        alert('テキストをクリップボードにコピーしました');
    });
}

// PDF出力（簡易版）
function exportPDF() {
    alert('PDF出力機能は開発中です。現在はテキスト出力をご利用ください。');
}

// トポロジカルソート（簡易版）
function topologicalSort(project) {
    const nodes = [...project.nodes];
    const connections = project.connections;
    
    // 入次数を計算
    const inDegree = {};
    nodes.forEach(node => {
        inDegree[node.id] = 0;
    });
    
    connections.forEach(conn => {
        inDegree[conn.to] = (inDegree[conn.to] || 0) + 1;
    });
    
    // 入次数0のノードから開始
    const queue = nodes.filter(node => inDegree[node.id] === 0);
    const sorted = [];
    
    while (queue.length > 0) {
        const node = queue.shift();
        sorted.push(node);
        
        // このノードからの接続先の入次数を減らす
        connections
            .filter(conn => conn.from === node.id)
            .forEach(conn => {
                inDegree[conn.to]--;
                if (inDegree[conn.to] === 0) {
                    const nextNode = nodes.find(n => n.id === conn.to);
                    if (nextNode) queue.push(nextNode);
                }
            });
    }
    
    // ソートされなかったノードを追加（循環参照がある場合）
    nodes.forEach(node => {
        if (!sorted.includes(node)) {
            sorted.push(node);
        }
    });
    
    return sorted;
}

// ユーティリティ関数
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// 通知表示
function showNotification(message) {
    // 既存の通知を削除
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // フェードイン
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 3秒後にフェードアウト
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// アプリケーション起動
init();
