// date formatting
const fmtDate = (d) => {
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
};

let state = {
  tasks: [],       
  selectedDate: null,
  viewYear: null,
  viewMonth: null
};

const todayLabel = document.getElementById("todayLabel");
const monthYear = document.getElementById("monthYear");
const calendarEl = document.getElementById("calendar");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const dateInput = document.getElementById("dateInput");
const addTaskBtn = document.getElementById("addTaskBtn");

const tasksContainer = document.getElementById("tasksContainer");
const completedCountEl = document.getElementById("completedCount");
const pendingCountEl = document.getElementById("pendingCount");


const editModal = document.getElementById("editModal");
const editTitle = document.getElementById("editTitle");
const editDate = document.getElementById("editDate");
const editDesc = document.getElementById("editDesc");
const saveEdit = document.getElementById("saveEdit");
const cancelEdit = document.getElementById("cancelEdit");

let editingId = null;

// initial load
function loadState() {
  const raw = localStorage.getItem("luq_tasks_v1");
  state.tasks = raw ? JSON.parse(raw) : [];
}

function saveState() {
  localStorage.setItem("luq_tasks_v1", JSON.stringify(state.tasks));
}

// set today label and initial calendar view
function initCalendarView() {
  const now = new Date();
  todayLabel.textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  state.selectedDate = now.toISOString().slice(0,10);
  dateInput.value = state.selectedDate;
}

// render calendar month 
function renderCalendar() {
  calendarEl.innerHTML = "";

  const year = state.viewYear, month = state.viewMonth;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay(); // 0..6 (Sun..Sat)
  const daysInMonth = last.getDate();

  
  monthYear.textContent = first.toLocaleString(undefined, { month: "long", year: "numeric" });

  const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  names.forEach(n => {
    const dn = document.createElement("div");
    dn.className = "day-name";
    dn.textContent = n;
    calendarEl.appendChild(dn);
  });

  // fill blanks for days before first 
  for (let i=0;i<startWeekday;i++){
    const blank = document.createElement("div");
    blank.className = "calendar-cell muted";
    calendarEl.appendChild(blank);
  }

  // create day cells
  for (let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    const iso = d.toISOString().slice(0,10);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.textContent = day;

    // today highlight
    const todayIso = new Date().toISOString().slice(0,10);
    if (iso === todayIso) cell.classList.add("today");

    if (iso === state.selectedDate) cell.classList.add("selected");

    cell.addEventListener("click", () => {
      state.selectedDate = iso;
      dateInput.value = iso;
      renderCalendar();
      renderTasks(); 
    });

    calendarEl.appendChild(cell);
  }
}

// next/prev handlers
prevMonthBtn.addEventListener("click", () => {
  state.viewMonth--;
  if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  state.viewMonth++;
  if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
  renderCalendar();
});


function renderTasks() {
  tasksContainer.innerHTML = "";

  const sorted = [...state.tasks].sort((a,b) => {
    if (a.date === b.date) return new Date(b.createdAt) - new Date(a.createdAt);
    return a.date.localeCompare(b.date);
  });

  sorted.forEach(task => {
    const card = document.createElement("article");
    card.className = "task-card";
    if (task.completed) card.classList.add("completed");

    // highlight card slightly if it matches selected date
    if (state.selectedDate && task.date === state.selectedDate) {
      card.style.border = "1px solid rgba(150,120,200,0.12)";
      card.style.boxShadow = "0 10px 30px rgba(120,90,200,0.06)";
    }

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="flex:1">
          <h4>${escapeHtml(task.title)}</h4>
          <p>${escapeHtml(task.desc || "")}</p>
        </div>
        <div class="actions">
          <button class="action-btn complete" data-id="${task.id}" title="${task.completed ? 'Mark as pending' : 'Mark as completed'}" aria-label="complete">
            ${checkIcon(task.completed)}
          </button>
          <button class="action-btn edit" data-id="${task.id}" title="Edit task" aria-label="edit">
            ${editIcon()}
          </button>
          <button class="action-btn delete" data-id="${task.id}" title="Delete task" aria-label="delete">
            ${trashIcon()}
          </button>
        </div>
      </div>
      <div class="task-meta">
        <div>${task.date ? fmtDate(task.date) : "No date"}</div>
        <div style="font-size:12px;color:var(--muted)">Added: ${new Date(task.createdAt).toLocaleDateString()}</div>
      </div>
    `;

    // events
    card.querySelector(".action-btn.complete").addEventListener("click", (e)=> {
      toggleComplete(task.id);
    });
    card.querySelector(".action-btn.edit").addEventListener("click", ()=> openEdit(task.id));
    card.querySelector(".action-btn.delete").addEventListener("click", ()=> {
      if (confirm("Delete this task?")) deleteTask(task.id);
    });

    tasksContainer.appendChild(card);
  });

  updateCounters();
}

function updateCounters(){
  const total = state.tasks.length;
  const completed = state.tasks.filter(t=>t.completed).length;
  const pending = total - completed;
  completedCountEl.textContent = completed;
  pendingCountEl.textContent = pending;
}

// add new task
addTaskBtn.addEventListener("click", handleAddTask);
[titleInput, descInput].forEach(el => {
  el.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && document.activeElement === titleInput) {
      handleAddTask();
    }
  });
});

function handleAddTask(){
  const title = titleInput.value.trim();
  if (!title) { alert("Please add a title for the task."); titleInput.focus(); return; }
  const desc = descInput.value.trim();
  const date = dateInput.value || state.selectedDate || new Date().toISOString().slice(0,10);

  const newTask = {
    id: cryptoId(),
    title, desc, date,
    completed:false,
    createdAt: new Date().toISOString()
  };
  state.tasks.push(newTask);
  saveState();
  renderTasks();
  // clear inputs
  titleInput.value = ""; descInput.value = "";
}

// toggle complete
function toggleComplete(id){
  const t = state.tasks.find(x=>x.id===id);
  if (!t) return;
  t.completed = !t.completed;
  saveState();
  renderTasks();
}

// delete
function deleteTask(id){
  state.tasks = state.tasks.filter(x=>x.id !== id);
  saveState();
  renderTasks();
}

// edit flow
function openEdit(id){
  const t = state.tasks.find(x=>x.id===id);
  if (!t) return;
  editingId = id;
  editTitle.value = t.title;
  editDesc.value = t.desc;
  editDate.value = t.date;
  editModal.setAttribute("aria-hidden","false");
}
cancelEdit.addEventListener("click", ()=> {
  editingId = null;
  editModal.setAttribute("aria-hidden","true");
});
saveEdit.addEventListener("click", ()=> {
  if (!editingId) return;
  const t = state.tasks.find(x=>x.id===editingId);
  if (!t) return;
  t.title = editTitle.value.trim() || t.title;
  t.desc = editDesc.value.trim();
  t.date = editDate.value || t.date;
  saveState();
  renderTasks();
  editingId = null;
  editModal.setAttribute("aria-hidden","true");
});

function cryptoId(){
  return "id_" + Math.random().toString(36).slice(2,9);
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// icons (inline SVG)
function checkIcon(isDone=false){
  return `<svg viewBox="0 0 24 24" fill="${isDone ? '#1f9d5a' : 'none'}" stroke="${isDone ? '#1f9d5a' : '#8b6b7a'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="21" height="21" rx="5" ry="5" fill="${isDone ? 'rgba(35,160,110,0.08)' : 'transparent'}"></rect>
    <path d="M6 12l4 4 8-8" /></svg>`;
}
function editIcon(){ return `<svg viewBox="0 0 24 24" stroke="#6b3a4a" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>` }
function trashIcon(){ return `<svg viewBox="0 0 24 24" stroke="#d64b60" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>` }

function start(){
  loadState();
  initCalendarView();
  renderCalendar();
  renderTasks();
}

// keep calendar in sync if user changes date input
dateInput.addEventListener("change", (e) => {
  state.selectedDate = e.target.value;
  // adjust view to selected month
  const d = new Date(state.selectedDate);
  state.viewYear = d.getFullYear();
  state.viewMonth = d.getMonth();
  renderCalendar();
  renderTasks();
});

// initial start
start();
