// --- Supabase Configuration ---
// Make sure these match your Supabase API settings!
const SUPABASE_URL = 'https://iirxsqpmpvfeaatrbxjn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oInzwnwn4OQZa1XmVypnMq_iHMCkZ2A';
supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State Management ---
let currentUser = null;
let tasks = [];
let activeFilter = 'all';
let searchQuery = '';

// --- DOM Elements ---
const loginContainer = document.getElementById('loginContainer');
const registerContainer = document.getElementById('registerContainer');
const appContainer = document.getElementById('appContainer');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

const registerForm = document.getElementById('registerForm');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

const goToRegisterBtn = document.getElementById('goToRegisterBtn');
const goToLoginBtn = document.getElementById('goToLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userWelcome = document.getElementById('userWelcome');

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskSubject = document.getElementById('taskSubject');
const taskPriority = document.getElementById('taskPriority');
const taskDueDate = document.getElementById('taskDueDate');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const loadingSpinner = document.getElementById('loadingSpinner');

const totalCount = document.getElementById('totalCount');
const completedCount = document.getElementById('completedCount');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');

// --- View Navigation ---
goToRegisterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  loginContainer.classList.add('hidden');
  registerContainer.classList.remove('hidden');
  clearMessages();
});

goToLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  registerContainer.classList.add('hidden');
  loginContainer.classList.remove('hidden');
  clearMessages();
});

function clearMessages() {
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');
}

// --- Auth State Initialization & Session Management ---
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  handleSession(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

function handleSession(session) {
  currentUser = session?.user || null;
  if (currentUser) {
    loginContainer.classList.add('hidden');
    registerContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userWelcome.textContent = `Logged in as: ${currentUser.email}`;
    fetchTasks();
  } else {
    appContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    registerContainer.classList.add('hidden');
    tasks = [];
  }
}

// --- Login Handler ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Incorrect email or password. Please try again.');
      }
      throw error;
    }
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

// --- Register Handler ---
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) throw error;

    if (data?.user) {
      registerSuccess.textContent = 'Account created successfully! Click "Back to Login" below to sign in.';
      registerSuccess.classList.remove('hidden');
      registerForm.reset();
    }
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
  }
});

// --- Logout ---
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

// --- Task Database Queries ---
async function fetchTasks() {
  if (!currentUser) return;
  showSpinner(true);
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    tasks = data || [];
    render();
  } catch (err) {
    console.error('Error fetching tasks:', err.message);
  } finally {
    showSpinner(false);
  }
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const titleVal = taskTitle.value.trim();
  const subjectVal = taskSubject.value.trim();

  if (!titleVal || !subjectVal) {
    alert('Please provide both a title and a subject.');
    return;
  }

  const newTask = {
    user_id: currentUser.id,
    title: titleVal,
    subject: subjectVal,
    priority: taskPriority.value,
    due_date: taskDueDate.value || null,
    completed: false
  };

  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert([newTask])
      .select();

    if (error) throw error;

    tasks.unshift(data[0]);
    taskForm.reset();
    render();
  } catch (err) {
    console.error('Error adding task:', err.message);
  }
});

async function toggleTask(id, completed) {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !completed })
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    tasks = tasks.map(t => t.id === id ? { ...t, completed: !completed } : t);
    render();
  } catch (err) {
    console.error('Error updating task:', err.message);
  }
}

async function deleteSelectedTask(id) {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    tasks = tasks.filter(t => t.id !== id);
    render();
  } catch (err) {
    console.error('Error deleting task:', err.message);
  }
}

// --- Render Dashboard UI ---
function render() {
  const filteredTasks = tasks.filter(task => {
    const matchesFilter = 
      activeFilter === 'all' ? true :
      activeFilter === 'completed' ? task.completed :
      !task.completed;

    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.subject.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  taskList.innerHTML = '';
  if (filteredTasks.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    filteredTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <div class="task-left">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} />
          <div class="task-details">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <div class="task-meta">
              <span class="badge badge-subject">${escapeHtml(task.subject)}</span>
              <span class="badge badge-${task.priority}">${task.priority}</span>
              ${task.due_date ? `<span>📅 ${task.due_date}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="btn-delete" title="Delete Task">&times;</button>
      `;

      li.querySelector('.task-checkbox').addEventListener('change', () => toggleTask(task.id, task.completed));
      li.querySelector('.btn-delete').addEventListener('click', () => deleteSelectedTask(task.id));

      taskList.appendChild(li);
    });
  }

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  totalCount.textContent = total;
  completedCount.textContent = completed;
  progressPercent.textContent = `${percentage}%`;
  progressBar.style.width = `${percentage}%`;
}

// --- Filter & Search Controls ---
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  render();
});

function showSpinner(show) {
  if (show) loadingSpinner.classList.remove('hidden');
  else loadingSpinner.classList.add('hidden');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

// Start app
initAuth();