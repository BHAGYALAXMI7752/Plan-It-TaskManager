// ========== script.js ==========
(function () {
  // ----- DOM elements -----
  const titleInput = document.getElementById('titleInput');
  const descInput = document.getElementById('descInput');
  const dateInput = document.getElementById('dateInput');
  const priorityInput = document.getElementById('priorityInput');
  const tagsInput = document.getElementById('tagsInput');
  const addUpdateBtn = document.getElementById('addUpdateBtn');
  const formError = document.getElementById('formError');
  const tasksGrid = document.getElementById('tasksGrid');
  const searchInput = document.getElementById('searchInput');
  const filterSelect = document.getElementById('filterSelect');
  const exportBtn = document.getElementById('exportBtn');
  const darkToggle = document.getElementById('darkToggle');
  const taskCounter = document.getElementById('taskCounter');
  const clearAllBtn = document.getElementById('clearAllBtn');

  // ----- state -----
  let tasks = [];
  let currentEditId = null;
  let draggedTaskId = null;

  // ----- load from localStorage -----
  function loadTasks() {
    const stored = localStorage.getItem('planit_tasks');
    if (stored) {
      try {
        tasks = JSON.parse(stored);
      } catch {
        tasks = [];
      }
    } else {
      // seed demo tasks
      tasks = [
        {
          id: Date.now() - 100000,
          title: 'Design homepage',
          description: 'Create wireframes',
          dueDate: getTodayString(),
          priority: 'high',
          completed: false,
          tags: ['design'],
        },
        {
          id: Date.now() - 200000,
          title: 'Write documentation',
          description: 'Explain features',
          dueDate: getTomorrowString(),
          priority: 'medium',
          completed: false,
          tags: ['docs'],
        },
      ];
    }
    tasks = tasks.map((t) => ({
      ...t,
      tags: Array.isArray(t.tags) ? t.tags : [],
    }));
    renderTasks();
  }

  function getTodayString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
  function getTomorrowString() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  // ----- save to localStorage -----
  function saveTasks() {
    localStorage.setItem('planit_tasks', JSON.stringify(tasks));
  }

  // ----- render with filter & search -----
  function renderTasks() {
    const filter = filterSelect.value;
    const searchTerm = searchInput.value.trim().toLowerCase();

    let html = '';
    for (let task of tasks) {
      if (filter === 'completed' && !task.completed) continue;
      if (filter === 'pending' && task.completed) continue;
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm)) continue;

      const dueDateStr = task.dueDate || 'no date';
      const priorityClass = `priority-badge priority-${task.priority || 'medium'}`;
      const completedClass = task.completed ? 'completed' : '';
      const tagsHTML = (task.tags || [])
        .map((t) => `<span class="tag">${escapeHTML(t)}</span>`)
        .join('');
      const completeButtonText = task.completed ? 'Undo' : 'Complete';

      html += `
        <div class="task-card ${completedClass}" draggable="true" data-id="${task.id}">
          <div class="task-header">
            <span class="task-title">${escapeHTML(task.title)}</span>
            <span class="${priorityClass}">${task.priority || 'medium'}</span>
          </div>
          <div class="task-desc">${escapeHTML(task.description) || '—'}</div>
          <div class="task-meta">
            <span class="task-due">📅 ${escapeHTML(dueDateStr)}</span>
          </div>
          <div class="tag-list">${tagsHTML}</div>
          <div class="task-actions">
            <button class="complete-btn ${task.completed ? 'completed' : ''}" data-id="${task.id}">${completeButtonText}</button>
            <button class="edit-btn" data-id="${task.id}">Edit</button>
            <button class="delete-btn" data-id="${task.id}">Delete</button>
          </div>
        </div>
      `;
    }
    tasksGrid.innerHTML =
      html ||
      `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--placeholder);">✨ no tasks match</div>`;

    attachDragListeners();
    const visibleCount = tasksGrid.querySelectorAll('.task-card').length;
    taskCounter.textContent = `${visibleCount} task${visibleCount !== 1 ? 's' : ''} • total ${tasks.length}`;

    document.querySelectorAll('.complete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        toggleComplete(id);
      });
    });
    document.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        populateEditForm(id);
      });
    });
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        deleteTask(id);
      });
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return m;
    });
  }

  // ----- drag & drop reorder -----
  function attachDragListeners() {
    const cards = document.querySelectorAll('.task-card');
    cards.forEach((card) => {
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('drop', handleDrop);
      card.addEventListener('dragend', handleDragEnd);
    });
  }

  function handleDragStart(e) {
    const card = e.target.closest('.task-card');
    if (!card) return;
    draggedTaskId = Number(card.dataset.id);
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', draggedTaskId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    const targetCard = e.target.closest('.task-card');
    if (!targetCard || draggedTaskId === null) return;

    const targetId = Number(targetCard.dataset.id);
    if (draggedTaskId === targetId) return;

    const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId);
    const targetIndex = tasks.findIndex((t) => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedTask] = tasks.splice(draggedIndex, 1);
    const newTargetIndex = tasks.findIndex((t) => t.id === targetId);
    tasks.splice(newTargetIndex, 0, draggedTask);

    saveTasks();
    renderTasks();
    draggedTaskId = null;
  }

  function handleDragEnd(e) {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
    draggedTaskId = null;
  }

  // ----- CRUD & helpers -----
  function validateForm() {
    const title = titleInput.value.trim();
    if (!title) return 'Task title cannot be empty';
    const due = dateInput.value;
    if (due) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(due);
      dueDate.setHours(0, 0, 0, 0);
      if (dueDate < today) return 'Due date must not be in the past';
    }
    const duplicate = tasks.some(
      (t) =>
        t.title.toLowerCase() === title.toLowerCase() &&
        (currentEditId === null || t.id !== currentEditId)
    );
    if (duplicate) return 'Task with this title already exists';
    return '';
  }

  function getFormData() {
    return {
      id: currentEditId || Date.now(),
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      dueDate: dateInput.value,
      priority: priorityInput.value,
      completed: false,
      tags: tagsInput.value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };
  }

  function resetForm() {
    titleInput.value = '';
    descInput.value = '';
    dateInput.value = '';
    priorityInput.value = 'medium';
    tagsInput.value = '';
    currentEditId = null;
    addUpdateBtn.textContent = 'Add Task';
    formError.textContent = '';
  }

  function addTask(e) {
    e?.preventDefault();
    const error = validateForm();
    if (error) {
      formError.textContent = error;
      return;
    }
    const newTask = getFormData();
    if (currentEditId) {
      const existing = tasks.find((t) => t.id === currentEditId);
      newTask.completed = existing ? existing.completed : false;
      tasks = tasks.map((t) => (t.id === currentEditId ? newTask : t));
    } else {
      newTask.completed = false;
      tasks.push(newTask);
    }
    saveTasks();
    resetForm();
    renderTasks();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    if (currentEditId === id) resetForm();
    renderTasks();
  }

  function toggleComplete(id) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    saveTasks();
    renderTasks();
  }

  function populateEditForm(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    titleInput.value = task.title || '';
    descInput.value = task.description || '';
    dateInput.value = task.dueDate || '';
    priorityInput.value = task.priority || 'medium';
    tagsInput.value = (task.tags || []).join(', ');
    currentEditId = task.id;
    addUpdateBtn.textContent = 'Update Task';
    formError.textContent = '';
  }

  function handleFilterChange() {
    renderTasks();
  }
  function handleSearchInput() {
    renderTasks();
  }

  function exportToJSON() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planit_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAllTasks() {
    if (tasks.length && confirm('Delete all tasks? This cannot be undone.')) {
      tasks = [];
      saveTasks();
      resetForm();
      renderTasks();
    }
  }

  function initDarkMode() {
    const isDark = localStorage.getItem('planit_theme') === 'dark';
    if (isDark) document.body.classList.add('dark');
    darkToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';

    darkToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const darkNow = document.body.classList.contains('dark');
      localStorage.setItem('planit_theme', darkNow ? 'dark' : 'light');
      darkToggle.textContent = darkNow ? '☀️ Light' : '🌙 Dark';
    });
  }

  function setDateMin() {
    const today = getTodayString();
    dateInput.min = today;
    if (dateInput.value && dateInput.value < today) dateInput.value = today;
  }

  // ----- initialization -----
  loadTasks();
  setDateMin();
  initDarkMode();

  addUpdateBtn.addEventListener('click', addTask);
  searchInput.addEventListener('input', handleSearchInput);
  filterSelect.addEventListener('change', handleFilterChange);
  exportBtn.addEventListener('click', exportToJSON);
  clearAllBtn.addEventListener('click', clearAllTasks);
  document.querySelector('.form-card').addEventListener('submit', (e) => e.preventDefault());
  dateInput.addEventListener('input', setDateMin);
})();