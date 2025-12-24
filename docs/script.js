document.addEventListener('DOMContentLoaded', function() {
  // Elementos DOM
  const taskInput = document.getElementById('taskInput');
  const addTaskBtn = document.getElementById('addTaskBtn');
  const tasksList = document.getElementById('tasksList');
  const filterTasks = document.getElementById('filterTasks');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');

  // Colunas do Kanban
  const todoTasks = document.getElementById('todoTasks');
  const doingTasks = document.getElementById('doingTasks');
  const doneTasks = document.getElementById('doneTasks');
  const dropzones = document.querySelectorAll('.dropzone');

  // Elementos do Modal de edição
  const editModal = document.getElementById('editModal');
  const editTaskInput = document.getElementById('editTaskInput');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const saveEditBtn = document.getElementById('saveEditBtn');

  // Google/Drive UI
  const googleStatus = document.getElementById('googleStatus');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleLogoutBtn = document.getElementById('googleLogoutBtn');
  const driveExportBtn = document.getElementById('driveExportBtn');
  const driveImportBtn = document.getElementById('driveImportBtn');
  const mergeStrategySelect = document.getElementById('mergeStrategy');

  // Drive Modal
  const driveModal = document.getElementById('driveModal');
  const closeDriveModal = document.getElementById('closeDriveModal');
  const driveSearch = document.getElementById('driveSearch');
  const driveFilesList = document.getElementById('driveFilesList');
  const refreshDriveList = document.getElementById('refreshDriveList');
  const importSelectedDriveFile = document.getElementById('importSelectedDriveFile');

  // Zerar Taredas
  const clearTasksBtn = document.getElementById('clearTasksBtn');

  // Variáveis
  let tasks = JSON.parse(localStorage.getItem('kanbanTasks')) || [];
  let currentEditId = null;

  // OAuth/Drive
  // Substitua pelo seu Client ID do Google Cloud (Web application)
  const GOOGLE_CLIENT_ID = '142878768076-ar18fagcfkqdq00pl2dphssl0hggo3tg.apps.googleusercontent.com';
  //const GOOGLE_CLIENT_ID = 'COLOQUE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com';
  const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const GOOGLE_API_BASE = 'https://www.googleapis.com';
  let googleAccessToken = null;
  let tokenClient = null;

  // Inicializações
  renderAllTasks();
  updateCounters();
  initGoogleOAuth();

  // Event Listeners
  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addTask();
  });

  filterTasks.addEventListener('input', filterTaskList);

  // Botões de Exportar e Importar (arquivo local)
  exportBtn.addEventListener('click', exportToJSON);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', importFromJSONFile);

  // Google Auth
  googleLoginBtn.addEventListener('click', requestGoogleTokenInteractive);
  googleLogoutBtn.addEventListener('click', () => setGoogleToken(null));

  // Drive ações
  driveExportBtn.addEventListener('click', exportToDrive);
  driveImportBtn.addEventListener('click', openDriveModal);
  closeDriveModal.addEventListener('click', closeDriveFilesModal);
  refreshDriveList.addEventListener('click', listDriveFiles);
  importSelectedDriveFile.addEventListener('click', importFromSelectedDriveFile);
  driveSearch.addEventListener('input', filterDriveListUI);

  // Zerar Tarefas
  clearTasksBtn.addEventListener('click', clearAllTasks);

  // Eventos de clique nos botões das tasks
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('delete-btn')) {
      const taskId = e.target.closest('.task-card').dataset.id;
      deleteTask(taskId);
    }

    if (e.target.classList.contains('edit-btn')) {
      const taskCard = e.target.closest('.task-card');
      const taskId = taskCard.dataset.id;
      const task = tasks.find(t => t.id == taskId);
      if (task) openEditModal(task);
    }

    // Mover de backlog para kanban
    if (e.target.classList.contains('move-to-kanban')) {
      const taskId = e.target.closest('.task-card').dataset.id;
      moveTaskToKanban(taskId);
    }

    // Voltar de "A Fazer" para backlog
    if (e.target.classList.contains('move-to-backlog')) {
      const taskId = e.target.closest('.task-card').dataset.id;
      updateTaskStatus(taskId, 'backlog');
    }
  });

  // Drag and drop
  document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('task-card')) {
      e.target.classList.add('dragging');
      e.dataTransfer.setData('text/plain', e.target.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('task-card')) {
      e.target.classList.remove('dragging');
    }
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('highlight');
      e.dataTransfer.dropEffect = 'move';
    });

    zone.addEventListener('dragleave', function() {
      this.classList.remove('highlight');
    });

    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('highlight');

      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = this.dataset.status;
      updateTaskStatus(taskId, newStatus);
    });
  });

  // Modal edição
  cancelEditBtn.addEventListener('click', closeEditModal);
  saveEditBtn.addEventListener('click', saveEditedTask);

  // -----------------------------
  // Funções principais (Tarefas)
  // -----------------------------
  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const newTask = {
      id: Date.now().toString(),
      text,
      status: 'backlog',
      createdAt: new Date().toISOString(),
      // Campo opcional para futuras mesclagens
      updatedAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveTasks();
    renderTaskInList(newTask);
    taskInput.value = '';
    filterTaskList();
    updateCounters();
  }

  function renderAllTasks() {
    tasksList.innerHTML = '';
    todoTasks.innerHTML = '';
    doingTasks.innerHTML = '';
    doneTasks.innerHTML = '';

    const backlogTasks = tasks.filter(task => task.status === 'backlog');
    backlogTasks.forEach(renderTaskInList);

    tasks.forEach(task => {
      if (task.status !== 'backlog') renderTaskInKanban(task);
    });

    filterTaskList();
  }

  function renderTaskInList(task) {
    if (task.status !== 'backlog') return;
    const taskElement = document.createElement('div');
    taskElement.className = 'task-card bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow';
    taskElement.dataset.id = task.id;
    taskElement.draggable = false;

    taskElement.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="text-gray-800">${escapeHtml(task.text)}</span>
        <div class="flex gap-1">
          <button class="move-to-kanban text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200">
            <i class="fas fa-arrow-right"></i>
          </button>
          <button class="edit-btn text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded hover:bg-yellow-200">
            <i class="fas fa-edit"></i>
          </button>
          <button class="delete-btn text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    tasksList.appendChild(taskElement);
  }

  function renderTaskInKanban(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-card bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow';
    taskElement.dataset.id = task.id;
    taskElement.draggable = true;

    let buttons = '';
    if (task.status === 'todo') {
      buttons += `
        <button class="move-to-backlog text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200">
          <i class="fas fa-arrow-left"></i>
        </button>
      `;
    }
    buttons += `
      <button class="edit-btn text-xs bg-yellow-100 text-yellow-600 px-2 py-1 rounded hover:bg-yellow-200">
        <i class="fas fa-edit"></i>
      </button>
      <button class="delete-btn text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">
        <i class="fas fa-trash"></i>
      </button>
    `;

    taskElement.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="text-gray-800">${escapeHtml(task.text)}</span>
        <div class="flex gap-1">
          ${buttons}
        </div>
      </div>
    `;

    switch (task.status) {
      case 'todo':
        todoTasks.appendChild(taskElement);
        break;
      case 'doing':
        doingTasks.appendChild(taskElement);
        break;
      case 'done':
        doneTasks.appendChild(taskElement);
        break;
    }
  }

  function moveTaskToKanban(taskId) {
    updateTaskStatus(taskId, 'todo');
  }

  function updateTaskStatus(taskId, newStatus) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;
    tasks[taskIndex].status = newStatus;
    tasks[taskIndex].updatedAt = new Date().toISOString();
    saveTasks();
    renderAllTasks();
    updateCounters();
  }

  function deleteTask(taskId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderAllTasks();
    updateCounters();
  }

  function openEditModal(task) {
    currentEditId = task.id;
    editTaskInput.value = task.text;
    editModal.classList.remove('hidden');
  }

  function closeEditModal() {
    editModal.classList.add('hidden');
    currentEditId = null;
  }

  function saveEditedTask() {
    const newText = editTaskInput.value.trim();
    if (!newText || !currentEditId) return;
    const taskIndex = tasks.findIndex(task => task.id === currentEditId);
    if (taskIndex === -1) return;
    tasks[taskIndex].text = newText;
    tasks[taskIndex].updatedAt = new Date().toISOString();
    saveTasks();
    renderAllTasks();
    closeEditModal();
  }

  function filterTaskList() {
    const filterText = filterTasks.value.toLowerCase();
    const allTaskCards = tasksList.querySelectorAll('.task-card');
    allTaskCards.forEach(card => {
      const taskText = card.querySelector('span').textContent.toLowerCase();
      card.style.display = taskText.includes(filterText) ? 'block' : 'none';
    });
  }

  function updateCounters() {
    document.getElementById('todoCounter').textContent = tasks.filter(t => t.status === 'todo').length;
    document.getElementById('doingCounter').textContent = tasks.filter(t => t.status === 'doing').length;
    document.getElementById('doneCounter').textContent = tasks.filter(t => t.status === 'done').length;
  }

  function saveTasks() {
    localStorage.setItem('kanbanTasks', JSON.stringify(tasks));
  }

  function clearAllTasks() {
    if (!confirm("Tem certeza que deseja apagar todas as tarefas?")) return;

    // Limpa array de tarefas
    tasks = [];

    // Atualiza armazenamento local
    saveTasks();

    // Limpa DOM
    tasksList.innerHTML = '';
    todoTasks.innerHTML = '';
    doingTasks.innerHTML = '';
    doneTasks.innerHTML = '';

    // Zera contadores
    document.getElementById("todoCounter").textContent = "0";
    document.getElementById("doingCounter").textContent = "0";
    document.getElementById("doneCounter").textContent = "0";
  }


  // -----------------------------
  // Export/Import Local
  // -----------------------------
  function exportToJSON() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileName = `kanban-tasks-${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  }

  function importFromJSONFile(event) {
    const file = event.target.files[0];
    importInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const incoming = JSON.parse(e.target.result);
        handleIncomingTasksMerge(incoming);
      } catch (err) {
        alert("Erro ao ler o arquivo. Verifique o formato do JSON.");
      }
    };
    reader.readAsText(file);
  }

  // -----------------------------
  // Mesclagem de tarefas
  // -----------------------------
  function handleIncomingTasksMerge(incoming) {
    if (!Array.isArray(incoming)) {
      alert('Arquivo inválido: esperado um array de tarefas.');
      return;
    }
    const strategy = mergeStrategySelect.value;
    tasks = mergeTasks(tasks, sanitizeTasks(incoming), strategy);
    saveTasks();
    renderAllTasks();
    updateCounters();
    alert('Importação concluída com mesclagem: ' + strategy);
  }

  function sanitizeTasks(list) {
    return list
      .filter(t => t && typeof t === 'object' && t.id && typeof t.text === 'string')
      .map(t => ({
        id: String(t.id),
        text: String(t.text),
        status: ['backlog','todo','doing','done'].includes(t.status) ? t.status : 'backlog',
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || t.createdAt || new Date().toISOString()
      }));
  }

  function mergeTasks(existing, incoming, strategy = 'keepExisting') {
    const map = new Map(existing.map(t => [t.id, t]));
    const result = [...existing];

    for (const item of incoming) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
        result.push(item);
      } else {
        if (strategy === 'overwriteExisting') {
          const idx = result.findIndex(t => t.id === item.id);
          if (idx !== -1) result[idx] = item;
        } else if (strategy === 'duplicateWithNewIds') {
          const cloned = { ...item, id: item.id + '-' + Date.now() + '-' + Math.floor(Math.random()*1000) };
          result.push(cloned);
        }
        // keepExisting: não faz nada quando já existe
      }
    }
    return result;
  }

  // -----------------------------
  // Google OAuth e Drive
  // -----------------------------
  function initGoogleOAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      prompt: '', // silencioso quando possível
      callback: (resp) => {
        if (resp && resp.access_token) {
          setGoogleToken(resp.access_token);
        } else {
          alert('Falha ao obter token do Google.');
        }
      }
    });
    // Se desejar restaurar token de sessão (opcional, simples): deixamos desativado por segurança
  }

  function requestGoogleTokenInteractive() {
    if (!tokenClient) {
      alert('Cliente Google não inicializado.');
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function setGoogleToken(token) {
    googleAccessToken = token;
    if (googleAccessToken) {
      googleStatus.textContent = 'Google: autenticado';
      googleStatus.classList.remove('text-gray-600');
      googleStatus.classList.add('text-green-700');
      googleLoginBtn.classList.add('hidden');
      googleLogoutBtn.classList.remove('hidden');
    } else {
      googleStatus.textContent = 'Google: não autenticado';
      googleStatus.classList.add('text-gray-600');
      googleStatus.classList.remove('text-green-700');
      googleLoginBtn.classList.remove('hidden');
      googleLogoutBtn.classList.add('hidden');
    }
  }

  async function exportToDrive() {
    if (!googleAccessToken) {
      alert('Entre com o Google para exportar ao Drive.');
      return;
    }
    try {
      const filename = `kanban-tasks-${new Date().toISOString().slice(0,10)}.json`;
      const fileContent = JSON.stringify(tasks, null, 2);
      const metadata = {
        name: filename,
        mimeType: 'application/json'
      };
      const body = buildMultipartBody(metadata, fileContent, 'application/json');

      const res = await fetch(`${GOOGLE_API_BASE}/upload/drive/v3/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': body.contentType
        },
        body: body.body
      });
      if (!res.ok) {
        const errText = await safeText(res);
        throw new Error('Falha ao exportar: ' + errText);
      }
      alert('Exportado ao Drive com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar ao Drive.');
    }
  }

  // Modal e listagem de arquivos do Drive
  let driveFilesCache = [];
  let selectedDriveFileId = null;

  function openDriveModal() {
    if (!googleAccessToken) {
      alert('Entre com o Google para importar do Drive.');
      return;
    }
    driveSearch.value = '';
    selectedDriveFileId = null;
    driveFilesList.innerHTML = '';
    driveModal.classList.remove('hidden');
    driveModal.classList.add('flex');
    listDriveFiles();
  }

  function closeDriveFilesModal() {
    driveModal.classList.add('hidden');
    driveModal.classList.remove('flex');
  }

  async function listDriveFiles() {
    if (!googleAccessToken) return;
    try {
      // Busca arquivos JSON potencialmente relevantes
      const qParts = [
        "mimeType='application/json'",
        "trashed=false"
      ];
      // Opcional: priorizar nomes contendo 'kanban-tasks'
      const nameFilter = driveSearch.value.trim();
      if (nameFilter) {
        qParts.push(`name contains '${nameFilter.replace(/'/g, "\\'")}'`);
      }

      const q = qParts.join(' and ');

      const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=50`, {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`
        }
      });
      if (!res.ok) {
        const errText = await safeText(res);
        throw new Error(errText);
      }
      const data = await res.json();
      driveFilesCache = data.files || [];
      renderDriveFilesList(driveFilesCache);
    } catch (e) {
      console.error(e);
      alert('Erro ao listar arquivos do Drive.');
    }
  }

  function renderDriveFilesList(files) {
    driveFilesList.innerHTML = '';
    if (!files.length) {
      driveFilesList.innerHTML = `<div class="p-3 text-sm text-gray-600">Nenhum arquivo encontrado.</div>`;
      return;
    }
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'drive-file-item';
      item.dataset.id = file.id;
      item.innerHTML = `
        <div>
          <div class="font-medium text-sm">${escapeHtml(file.name)}</div>
          <div class="drive-file-meta">Modificado: ${formatDate(file.modifiedTime)} — ${formatSize(file.size)}</div>
        </div>
        <div>
          <input type="radio" name="driveFileSelect" />
        </div>
      `;
      item.addEventListener('click', () => selectDriveItem(item));
      driveFilesList.appendChild(item);
    });
  }

  function selectDriveItem(item) {
    Array.from(driveFilesList.children).forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    selectedDriveFileId = item.dataset.id;
    const radio = item.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }

  function filterDriveListUI() {
    // Filtra na UI se já tem cache; senão dispara listagem
    if (!driveFilesCache.length) {
      listDriveFiles();
      return;
    }
    const term = driveSearch.value.toLowerCase().trim();
    const filtered = driveFilesCache.filter(f => f.name.toLowerCase().includes(term));
    renderDriveFilesList(filtered);
  }

  async function importFromSelectedDriveFile() {
    if (!selectedDriveFileId) {
      alert('Selecione um arquivo.');
      return;
    }
    try {
      const content = await downloadDriveFileContent(selectedDriveFileId);
      const incoming = JSON.parse(content);
      handleIncomingTasksMerge(incoming);
      closeDriveFilesModal();
    } catch (e) {
      console.error(e);
      alert('Erro ao importar do Drive. Verifique o arquivo.');
    }
  }

  async function downloadDriveFileContent(fileId) {
    const res = await fetch(`${GOOGLE_API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (!res.ok) {
      const errText = await safeText(res);
      throw new Error('Falha no download: ' + errText);
    }
    return await res.text();
  }

  // -----------------------------
  // Helpers diversos
  // -----------------------------
  function buildMultipartBody(metadataObj, fileContent, fileMimeType) {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    const contentType = `multipart/related; boundary=${boundary}`;

    const metadata = JSON.stringify(metadataObj);
    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      delimiter +
      `Content-Type: ${fileMimeType}\r\n\r\n` +
      fileContent +
      closeDelimiter;

    return { contentType, body };
  }

  function safeText(res) {
    return res.text().catch(() => 'Erro desconhecido');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth()+1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return iso;
    }
  }

  function formatSize(size) {
    const n = Number(size);
    if (!isFinite(n) || n <= 0) return '-';
    const units = ['B','KB','MB','GB'];
    let idx = 0, v = n;
    while (v >= 1024 && idx < units.length-1) { v /= 1024; idx++; }
    return `${v.toFixed(1)} ${units[idx]}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }
});
