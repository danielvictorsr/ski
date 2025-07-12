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
      
      // Elementos do Modal
      const editModal = document.getElementById('editModal');
      const editTaskInput = document.getElementById('editTaskInput');
      const cancelEditBtn = document.getElementById('cancelEditBtn');
      const saveEditBtn = document.getElementById('saveEditBtn');
      
      // Variáveis
      let tasks = JSON.parse(localStorage.getItem('kanbanTasks')) || [];
      let currentEditId = null;
      
      // Inicializações
      renderAllTasks();
      updateCounters();
      
      // Event Listeners
      addTaskBtn.addEventListener('click', addTask);
      taskInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addTask();
      });
      
      filterTasks.addEventListener('input', filterTaskList);
      
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
          if (task) {
            openEditModal(task);
          }
        }
        
        // Botão que move de "Minhas Tarefas" para "A Fazer" (já existente)
        if (e.target.classList.contains('move-to-kanban')) {
          const taskId = e.target.closest('.task-card').dataset.id;
          moveTaskToKanban(taskId);
        }
        
        // Botão para voltar de "A Fazer" para "Minhas Tarefas"
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
      
      // Eventos do Modal
      cancelEditBtn.addEventListener('click', closeEditModal);
      saveEditBtn.addEventListener('click', saveEditedTask);
      
      // Botões de Exportar e Importar
      exportBtn.addEventListener('click', exportToJSON);
      
      importBtn.addEventListener('click', function() {
        importInput.click();
      });
      
      importInput.addEventListener('change', importFromJSON);
      
      // Funções
      function addTask() {
        const text = taskInput.value.trim();
        if (text) {
          const newTask = {
            id: Date.now().toString(),
            text: text,
            status: 'backlog', // Status inicial
            createdAt: new Date().toISOString()
          };
          
          tasks.push(newTask);
          saveTasks();
          renderTaskInList(newTask);
          taskInput.value = '';
          filterTaskList();
        }
      }
      
      function renderAllTasks() {
        // Limpa todas as listas
        tasksList.innerHTML = '';
        todoTasks.innerHTML = '';
        doingTasks.innerHTML = '';
        doneTasks.innerHTML = '';
        
        // Renderiza as tarefas do "Minhas Tarefas" (backlog)
        const backlogTasks = tasks.filter(task => task.status === 'backlog');
        backlogTasks.forEach(renderTaskInList);
        
        // Renderiza as tarefas do quadro Kanban
        tasks.forEach(task => {
          if (task.status !== 'backlog') {
            renderTaskInKanban(task);
          }
        });
        
        filterTaskList();
      }
      
      function renderTaskInList(task) {
        if (task.status === 'backlog') {
          const taskElement = document.createElement('div');
          taskElement.className = 'task-card bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow';
          taskElement.dataset.id = task.id;
          taskElement.draggable = false;
          
          taskElement.innerHTML = `
            <div class="flex justify-between items-start">
              <span class="text-gray-800">${task.text}</span>
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
      }
      
      function renderTaskInKanban(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-card bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow';
        taskElement.dataset.id = task.id;
        taskElement.draggable = true;
        
        let buttons = '';
        // Se a tarefa estiver no quadro "A Fazer", adiciona o botão para voltar ao backlog
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
            <span class="text-gray-800">${task.text}</span>
            <div class="flex gap-1">
              ${buttons}
            </div>
          </div>
        `;
        
        switch(task.status) {
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
      
      // Movimenta a tarefa da lista "Minhas Tarefas" para o quadro Kanban ("A Fazer")
      function moveTaskToKanban(taskId) {
        updateTaskStatus(taskId, 'todo');
      }
      
      function updateTaskStatus(taskId, newStatus) {
        const taskIndex = tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
          tasks[taskIndex].status = newStatus;
          saveTasks();
          renderAllTasks();
          updateCounters();
        }
      }
      
      function deleteTask(taskId) {
        if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
          tasks = tasks.filter(task => task.id !== taskId);
          saveTasks();
          renderAllTasks();
          updateCounters();
        }
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
        if (newText && currentEditId) {
          const taskIndex = tasks.findIndex(task => task.id === currentEditId);
          if (taskIndex !== -1) {
            tasks[taskIndex].text = newText;
            saveTasks();
            renderAllTasks();
            closeEditModal();
          }
        }
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
      
      function exportToJSON() {
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileName = `kanban-tasks-${new Date().toISOString().slice(0,10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileName);
        linkElement.click();
      }
      
      function importFromJSON(event) {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            try {
              tasks = JSON.parse(e.target.result);
              saveTasks();
              renderAllTasks();
              updateCounters();
            } catch (err) {
              alert("Erro ao ler o arquivo. Verifique o formato do JSON.");
            }
          };
          reader.readAsText(file);
        }
      }
    });
