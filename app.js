;(function() {
  const COLUMNS = [
    { id: 'todo', label: 'Por hacer', dot: 'blue' },
    { id: 'progress', label: 'En proceso', dot: 'amber' },
    { id: 'done', label: 'Hecho', dot: 'green' },
  ];

  const STORAGE_KEY = 'kanban-board';

  let cards = [];
  let nextId = 1;
  let editingId = null;
  let draggedId = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        cards = data.cards || [];
        nextId = data.nextId || 1;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, nextId }));
  }

  function seedExampleData() {
    cards = [
      { id: nextId++, title: 'Diseñar landing page', desc: 'Crear mockups en Figma para la página principal del producto', column: 'todo' },
      { id: nextId++, title: 'Configurar base de datos', desc: 'Instalar PostgreSQL y definir el esquema de tablas inicial', column: 'todo' },
      { id: nextId++, title: 'Escribir tests unitarios', desc: 'Cubrir los módulos de autenticación y API con Jest', column: 'todo' },
      { id: nextId++, title: 'Implementar inicio de sesión', desc: 'Desarrollar formulario de login con validación y JWT', column: 'progress' },
      { id: nextId++, title: 'Crear API REST', desc: 'Endpoints CRUD para usuarios, proyectos y tareas', column: 'progress' },
      { id: nextId++, title: 'Planificación del proyecto', desc: 'Definir alcance, tecnologías y cronograma del desarrollo', column: 'done' },
      { id: nextId++, title: 'Investigación UX', desc: 'Entrevistas con usuarios y análisis de competencia realizado', column: 'done' },
      { id: nextId++, title: 'Diseñar identidad visual', desc: 'Logotipo, paleta de colores y tipografía definidos', column: 'done' },
    ];
    saveState();
  }

  function addCard(title, desc, column) {
    const card = { id: nextId++, title, desc, column };
    cards.push(card);
    saveState();
    renderColumn(column);
    updateCounts();
    return card;
  }

  function updateCard(id, title, desc) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    card.title = title;
    card.desc = desc;
    saveState();
    renderColumn(card.column);
    updateCounts();
  }

  function deleteCard(id) {
    const idx = cards.findIndex(c => c.id === id);
    if (idx === -1) return;
    const column = cards[idx].column;
    cards.splice(idx, 1);
    saveState();
    renderColumn(column);
    updateCounts();
  }

  function moveCard(id, targetColumn, insertBeforeId) {
    const card = cards.find(c => c.id === id);
    if (!card || card.column === targetColumn) return;
    card.column = targetColumn;
    if (insertBeforeId) {
      const insertIdx = cards.findIndex(c => c.id === insertBeforeId);
      const currIdx = cards.findIndex(c => c.id === id);
      if (insertIdx !== -1 && currIdx !== -1) {
        cards.splice(currIdx, 1);
        const newIdx = cards.findIndex(c => c.id === insertBeforeId);
        cards.splice(newIdx, 0, card);
      }
    }
    saveState();
    renderBoard();
  }

  function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    COLUMNS.forEach(col => {
      const colCards = cards.filter(c => c.column === col.id);
      const el = document.createElement('div');
      el.className = 'column';
      el.dataset.column = col.id;
      el.innerHTML = `
        <div class="column-header">
          <div class="column-title">
            <span class="column-dot ${col.dot}"></span>
            <h2>${col.label}</h2>
            <span class="column-count">${colCards.length}</span>
          </div>
          <button class="add-card-btn" data-add="${col.id}">+</button>
        </div>
        <div class="column-body" data-body="${col.id}"></div>
      `;
      board.appendChild(el);

      const body = el.querySelector('.column-body');
      colCards.forEach(card => {
        body.appendChild(createCardElement(card));
      });

      if (colCards.length === 0) {
        body.appendChild(createEmptyState());
      }

      el.querySelector('[data-add]').addEventListener('click', () => openAddModal(col.id));

      el.addEventListener('dragover', onDragOver);
      el.addEventListener('dragenter', onDragEnter);
      el.addEventListener('dragleave', onDragLeave);
      el.addEventListener('drop', onDrop);
    });
  }

  function renderColumn(columnId) {
    const body = document.querySelector(`[data-body="${columnId}"]`);
    if (!body) return;
    const colCards = cards.filter(c => c.column === columnId);
    body.innerHTML = '';
    colCards.forEach(card => {
      body.appendChild(createCardElement(card));
    });
    if (colCards.length === 0) {
      body.appendChild(createEmptyState());
    }
  }

  function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.draggable = true;
    div.dataset.id = card.id;

    if (window._initialRenderDone) {
      div.classList.add('card-enter');
    }

    div.innerHTML = `
      <div class="card-title">${escapeHtml(card.title)}</div>
      ${card.desc ? `<div class="card-desc">${escapeHtml(card.desc)}</div>` : ''}
      <button class="card-delete" data-delete="${card.id}" title="Eliminar">&times;</button>
    `;

    div.addEventListener('click', (e) => {
      if (e.target.closest('.card-delete')) return;
      openEditModal(card.id);
    });

    div.querySelector('.card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta tarea?')) {
        deleteCard(card.id);
      }
    });

    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragend', onDragEnd);

    return div;
  }

  function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'column-empty';
    div.textContent = 'Arrastra tareas aquí';
    return div;
  }

  function updateCounts() {
    COLUMNS.forEach(col => {
      const count = cards.filter(c => c.column === col.id).length;
      const el = document.querySelector(`[data-column="${col.id}"] .column-count`);
      if (el) el.textContent = count;
    });
  }

  function onDragStart(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    draggedId = parseInt(cardEl.dataset.id);
    cardEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId);
  }

  function onDragEnd(e) {
    const cardEl = e.target.closest('.card');
    if (cardEl) cardEl.classList.remove('dragging');
    document.querySelectorAll('.column.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedId = null;
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDragEnter(e) {
    e.preventDefault();
    const col = e.currentTarget.closest('.column');
    if (col) col.classList.add('drag-over');
  }

  function onDragLeave(e) {
    const col = e.currentTarget.closest('.column');
    if (!col) return;
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const col = e.currentTarget.closest('.column');
    if (!col) return;
    col.classList.remove('drag-over');

    const targetColumn = col.dataset.column;
    if (!targetColumn || draggedId === null) return;

    const card = cards.find(c => c.id === draggedId);
    if (!card) return;

    if (card.column === targetColumn) return;

    const body = col.querySelector('.column-body');
    const afterElement = getDragAfterElement(body, e.clientY);

    let insertBeforeId = null;
    if (afterElement) {
      insertBeforeId = parseInt(afterElement.dataset.id);
    }

    moveCard(draggedId, targetColumn, insertBeforeId);
    draggedId = null;
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function openAddModal(column) {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Nueva tarea';
    document.getElementById('cardTitle').value = '';
    document.getElementById('cardDesc').value = '';
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('modalSave').dataset.column = column;
    setTimeout(() => document.getElementById('cardTitle').focus(), 100);
  }

  function openEditModal(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    editingId = cardId;
    document.getElementById('modalTitle').textContent = 'Editar tarea';
    document.getElementById('cardTitle').value = card.title;
    document.getElementById('cardDesc').value = card.desc;
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('modalSave').dataset.column = card.column;
    setTimeout(() => document.getElementById('cardTitle').focus(), 100);
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    editingId = null;
  }

  function saveModal() {
    const title = document.getElementById('cardTitle').value.trim();
    const desc = document.getElementById('cardDesc').value.trim();
    if (!title) {
      document.getElementById('cardTitle').focus();
      document.getElementById('cardTitle').style.borderColor = '#ff6b6b';
      setTimeout(() => document.getElementById('cardTitle').style.borderColor = '', 1500);
      return;
    }
    const column = document.getElementById('modalSave').dataset.column;

    if (editingId !== null) {
      updateCard(editingId, title, desc);
    } else {
      addCard(title, desc, column);
    }
    closeModal();
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function init() {
    if (!loadState() || cards.length === 0) {
      seedExampleData();
    }
    renderBoard();
    window._initialRenderDone = true;

    document.getElementById('modalSave').addEventListener('click', saveModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open') && document.activeElement === document.getElementById('cardTitle')) {
        document.getElementById('cardDesc').focus();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && document.getElementById('modalOverlay').classList.contains('open')) {
        saveModal();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
