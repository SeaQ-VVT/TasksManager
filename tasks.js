// ========================================================================
// === Đây là toàn bộ code cho file tasks.js. Bạn có thể thay thế hoàn  ===
// === toàn file cũ của mình bằng đoạn code này.                          ===
// ========================================================================

// ===== Firebase SDKs (vui lòng sử dụng phiên bản này để đảm bảo ổn định) =====
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
  increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config (Sử dụng config từ file của bạn) =====
const firebaseConfig = {
  apiKey: "AIzaSyBw3hWbWLvr2W2pdPL8_wKNB5x_BcnwrOI",
  authDomain: "task-806e4.firebaseapp.com",
  projectId: "task-806e4",
  storageBucket: "task-806e4.firebasestorage.app",
  messagingSenderId: "6...",
};

// Khởi tạo Firebase và các services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Biến toàn cục
let currentUser = null;
let isAuthReady = false;
let logsUnsub;
let progressUnsub;
let groupsUnsub;
let taskboardUnsubs = {};

// ===== Helper Functions =====
const showToast = (message) => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = 'toast show';
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }
};

const openModal = (title, formHtml, onFormSubmit) => {
  const modal = document.getElementById('myModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = formHtml;
  modal.style.display = 'block';

  const form = modalBody.querySelector('form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      onFormSubmit(form);
      modal.style.display = 'none';
    };
  }

  const closeBtn = document.querySelector('.modal .close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }

  window.onclick = (e) => {
    if (e.target == modal) {
      modal.style.display = 'none';
    }
  };
};

const logAction = async (projectId, message) => {
  await addDoc(collection(db, `projects/${projectId}/logs`), {
    message: message,
    timestamp: serverTimestamp(),
    user: currentUser?.email || "Ẩn danh",
  });
};

const calculateGroupProgress = (tasks) => {
  if (tasks.length === 0) return 0;
  const doneTasks = tasks.filter(task => task.status === 'done').length;
  return Math.round((doneTasks / tasks.length) * 100);
};

// ===== Main Functions =====
export const showTaskBoard = (projectId, projectTitle) => {
  if (!isAuthReady) return;

  // Hủy các listener cũ nếu có
  if (logsUnsub) logsUnsub();
  if (progressUnsub) progressUnsub();
  if (groupsUnsub) groupsUnsub();
  for (const unsub of Object.values(taskboardUnsubs)) {
    if (unsub) unsub();
  }
  taskboardUnsubs = {};

  const appContent = document.getElementById('appContent');
  if (!appContent) return;

  appContent.innerHTML = `
    <div class="container mx-auto p-4">
      <div class="flex justify-between items-center mb-6">
        <h1 id="projectTitle" class="text-3xl font-bold text-gray-800">${projectTitle}</h1>
        <button id="btnBackToProjects" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-transform duration-200 transform hover:scale-105">
          <i class="fas fa-arrow-left mr-2"></i> Quay lại
        </button>
      </div>

      <!-- Biểu đồ tiến độ dự án -->
      <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">Tiến độ Dự án</h2>
        <canvas id="projectProgressChart"></canvas>
      </div>

      <!-- Log hoạt động -->
      <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">Hoạt động Gần đây</h2>
        <ul id="logList" class="space-y-2">
          <!-- Logs sẽ được thêm vào đây -->
        </ul>
      </div>

      <!-- Bảng Task Kanban -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Cột To Do -->
        <div id="todoCol" class="bg-gray-100 rounded-xl p-4 shadow-md h-full min-h-[500px]">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-700">TO DO</h2>
            <button id="btnNewGroup" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-3 rounded-full text-sm shadow transition-transform duration-200 transform hover:scale-110">
              <i class="fas fa-plus mr-1"></i> Nhóm
            </button>
          </div>
          <div id="groupsContainer" class="space-y-4">
            <!-- Groups sẽ được render vào đây -->
          </div>
        </div>

        <!-- Cột In Progress -->
        <div id="inprogressCol" class="bg-gray-100 rounded-xl p-4 shadow-md h-full min-h-[500px] drag-zone">
          <h2 class="text-xl font-bold text-gray-700 mb-4">IN PROGRESS</h2>
          <!-- Tasks sẽ được kéo vào đây -->
        </div>

        <!-- Cột Done -->
        <div id="doneCol" class="bg-gray-100 rounded-xl p-4 shadow-md h-full min-h-[500px] drag-zone">
          <h2 class="text-xl font-bold text-gray-700 mb-4">DONE</h2>
          <!-- Tasks sẽ được kéo vào đây -->
        </div>
      </div>
    </div>
  `;

  // Xử lý nút quay lại
  document.getElementById('btnBackToProjects').addEventListener('click', () => {
    // Hủy các listener trước khi chuyển trang
    if (logsUnsub) logsUnsub();
    if (progressUnsub) progressUnsub();
    if (groupsUnsub) groupsUnsub();
    for (const unsub of Object.values(taskboardUnsubs)) {
      if (unsub) unsub();
    }
    window.location.hash = '';
  });

  const todoCol = document.getElementById('todoCol');
  const inprogressCol = document.getElementById('inprogressCol');
  const doneCol = document.getElementById('doneCol');

  // Đăng ký sự kiện kéo và thả
  const dragZones = [inprogressCol, doneCol];
  dragZones.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('border-indigo-400');
    });
    col.addEventListener('dragleave', () => {
      col.classList.remove('border-indigo-400');
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('border-indigo-400');

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const newStatus = col.id === "inprogressCol" ? "inprogress" : "done";

      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) return;
      const taskData = taskSnap.data();
      const groupData = (await getDoc(doc(db, "groups", taskData.groupId))).data();

      // Cập nhật trạng thái và tiến độ
      const updatePayload = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      };

      if (newStatus === "done") {
        updatePayload.progress = 100;
      }

      await updateDoc(taskRef, updatePayload);

      // Ghi log hoạt động
      let logMessage = `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`;
      if (newStatus === "done") {
        logMessage += ` và hoàn thành 100%`;
      }
      logMessage += ` trong group "${groupData.title}"`;
      await logAction(taskData.projectId, logMessage);
    });
  });

  // Sự kiện thêm nhóm mới
  document.getElementById('btnNewGroup').addEventListener('click', () => {
    openModal(
      'Tạo Nhóm Mới',
      `
      <form class="space-y-4">
        <label for="groupTitle" class="block text-gray-700 font-semibold">Tên Nhóm:</label>
        <input type="text" id="groupTitle" name="groupTitle" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Tạo Nhóm</button>
      </form>
      `,
      async (form) => {
        const groupTitle = form.groupTitle.value;
        await addDoc(collection(db, "groups"), {
          title: groupTitle,
          projectId: projectId,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.email || "Ẩn danh",
        });
        await logAction(projectId, `đã tạo một nhóm mới: "${groupTitle}"`);
        showToast(`Nhóm "${groupTitle}" đã được tạo thành công.`);
      }
    );
  });

  // Lắng nghe và hiển thị log hoạt động
  logsUnsub = onSnapshot(query(collection(db, `projects/${projectId}/logs`), where("timestamp", ">", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))), (snapshot) => {
    const logList = document.getElementById('logList');
    if (!logList) return;
    logList.innerHTML = '';
    snapshot.docs.sort((a, b) => b.data().timestamp - a.data().timestamp).forEach(doc => {
      const logData = doc.data();
      const logItem = document.createElement('li');
      logItem.className = 'text-sm text-gray-600 bg-gray-50 p-2 rounded';
      logItem.innerHTML = `<span class="font-semibold text-gray-800">${logData.user}</span> ${logData.message} <span class="text-xs text-gray-400">(${logData.timestamp?.toDate().toLocaleString()})</span>`;
      logList.appendChild(logItem);
    });
  });

  // Lắng nghe và cập nhật biểu đồ tiến độ dự án
  const listenForProjectProgress = () => {
    progressUnsub = onSnapshot(collection(db, "tasks"), async (snapshot) => {
      const tasks = snapshot.docs.filter(doc => doc.data().projectId === projectId).map(doc => doc.data());
      const totalTasks = tasks.length;
      const doneTasks = tasks.filter(task => task.status === 'done').length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      const progressChartCtx = document.getElementById('projectProgressChart');
      if (progressChartCtx && typeof Chart !== 'undefined') {
        if (projectChart) {
          projectChart.data.datasets[0].data = [progress, 100 - progress];
          projectChart.update();
        } else {
          projectChart = new Chart(progressChartCtx, {
            type: 'doughnut',
            data: {
              labels: ['Hoàn thành', 'Chưa hoàn thành'],
              datasets: [{
                data: [progress, 100 - progress],
                backgroundColor: ['#4ade80', '#e5e7eb'],
                borderWidth: 0,
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (tooltipItem) => {
                      return `${tooltipItem.label}: ${tooltipItem.raw}%`;
                    }
                  }
                }
              }
            }
          });
        }
      }
    });
  };

  listenForProjectProgress();
  loadGroups(projectId);
};

// Lắng nghe sự kiện click trên các nút cảm xúc thông qua event delegation
document.addEventListener('click', async (e) => {
  const reactionBtn = e.target.closest('.reaction-btn');
  if (!reactionBtn) return;

  const taskId = reactionBtn.dataset.taskId;
  const reactionType = reactionBtn.dataset.reaction;

  if (taskId && reactionType) {
    const taskRef = doc(db, "tasks", taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      showToast("Không tìm thấy task để thả cảm xúc.");
      return;
    }
    const taskData = taskSnap.data();

    // Tăng giá trị cảm xúc
    await updateDoc(taskRef, {
      [`reactions.${reactionType}`]: increment(1)
    });

    // Ghi log hoạt động
    await logAction(taskData.projectId, `đã thả cảm xúc "${reactionType}" vào task "${taskData.title}"`);
    showToast(`Bạn đã thả cảm xúc "${reactionType}" vào task "${taskData.title}".`);
  }
});

const loadGroups = (projectId) => {
  groupsUnsub = onSnapshot(query(collection(db, "groups"), where("projectId", "==", projectId)), (snapshot) => {
    const groupsContainer = document.getElementById('groupsContainer');
    if (!groupsContainer) return;
    const existingGroupIds = new Set();
    snapshot.docChanges().forEach(change => {
      const groupDoc = change.doc;
      existingGroupIds.add(groupDoc.id);

      if (change.type === "added" || change.type === "modified") {
        renderGroup(groupDoc);
      } else if (change.type === "removed") {
        const groupEl = document.getElementById(`group-${groupDoc.id}`);
        if (groupEl) {
          groupEl.remove();
        }
      }
    });

    // Hủy các listener task cũ của những group đã bị xóa
    for (const groupId in taskboardUnsubs) {
      if (!existingGroupIds.has(groupId)) {
        if (taskboardUnsubs[groupId]) {
          taskboardUnsubs[groupId]();
          delete taskboardUnsubs[groupId];
        }
      }
    }
  });
};

const renderGroup = (groupDoc) => {
  const groupData = groupDoc.data();
  const groupId = groupDoc.id;
  const groupsContainer = document.getElementById('groupsContainer');
  if (!groupsContainer) return;

  let groupEl = document.getElementById(`group-${groupId}`);
  if (!groupEl) {
    groupEl = document.createElement('div');
    groupEl.id = `group-${groupId}`;
    groupEl.className = 'bg-white rounded-lg p-3 shadow-md border border-gray-200';
    groupEl.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-bold text-lg text-gray-800">${groupData.title}</h3>
        <div class="flex space-x-1">
          <button class="btn-edit-group text-gray-500 hover:text-blue-500 transition-colors" data-id="${groupId}" data-title="${groupData.title}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete-group text-gray-500 hover:text-red-500 transition-colors" data-id="${groupId}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
        <div id="group-progress-${groupId}" class="bg-green-500 h-2.5 rounded-full" style="width: 0%;"></div>
      </div>
      <div id="tasks-${groupId}" class="space-y-3">
        <!-- Tasks sẽ được thêm vào đây -->
      </div>
      <button class="btn-new-task w-full bg-gray-200 hover:bg-gray-300 text-gray-600 font-semibold py-2 rounded-md mt-4 transition-colors" data-group-id="${groupId}" data-project-id="${groupData.projectId}">
        <i class="fas fa-plus mr-2"></i> Thêm Task
      </button>
    `;
    groupsContainer.appendChild(groupEl);
  } else {
    // Nếu group đã tồn tại, chỉ cập nhật tiêu đề
    groupEl.querySelector('h3').textContent = groupData.title;
    groupEl.querySelector('.btn-edit-group').dataset.title = groupData.title;
  }

  // Sự kiện thêm task mới
  groupEl.querySelector('.btn-new-task').addEventListener('click', () => {
    openModal(
      'Tạo Task Mới',
      `
      <form class="space-y-4">
        <label for="taskTitle" class="block text-gray-700 font-semibold">Tiêu đề:</label>
        <input type="text" id="taskTitle" name="taskTitle" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
        <label for="taskAssignee" class="block text-gray-700 font-semibold">Người phụ trách (Email):</label>
        <input type="email" id="taskAssignee" name="taskAssignee" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
        <label for="taskDeadline" class="block text-gray-700 font-semibold">Hạn chót:</label>
        <input type="date" id="taskDeadline" name="taskDeadline" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Tạo Task</button>
      </form>
      `,
      async (form) => {
        const taskTitle = form.taskTitle.value;
        const taskAssignee = form.taskAssignee.value;
        const taskDeadline = form.taskDeadline.value;

        await addDoc(collection(db, "tasks"), {
          title: taskTitle,
          assignee: taskAssignee,
          deadline: taskDeadline,
          status: 'todo',
          groupId: groupId,
          projectId: groupData.projectId,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.email || "Ẩn danh",
          reactions: {} // Khởi tạo trường reactions
        });
        await logAction(groupData.projectId, `đã thêm một task mới: "${taskTitle}" vào nhóm "${groupData.title}"`);
        showToast(`Task "${taskTitle}" đã được tạo thành công.`);
      }
    );
  });

  // Sự kiện chỉnh sửa nhóm
  groupEl.querySelector('.btn-edit-group').addEventListener('click', (e) => {
    const groupId = e.currentTarget.dataset.id;
    const currentTitle = e.currentTarget.dataset.title;
    openModal(
      'Chỉnh Sửa Nhóm',
      `
      <form class="space-y-4">
        <label for="editGroupTitle" class="block text-gray-700 font-semibold">Tên Nhóm:</label>
        <input type="text" id="editGroupTitle" name="editGroupTitle" value="${currentTitle}" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
        <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors">Lưu</button>
      </form>
      `,
      async (form) => {
        const newTitle = form.editGroupTitle.value;
        const groupRef = doc(db, "groups", groupId);
        await updateDoc(groupRef, {
          title: newTitle,
          updatedAt: serverTimestamp(),
        });
        await logAction(groupData.projectId, `đã chỉnh sửa tên nhóm từ "${currentTitle}" thành "${newTitle}"`);
        showToast(`Nhóm đã được cập nhật thành công.`);
      }
    );
  });

  // Sự kiện xóa nhóm
  groupEl.querySelector('.btn-delete-group').addEventListener('click', async (e) => {
    if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${groupData.title}" và tất cả các task của nó không?`)) {
      const groupId = e.currentTarget.dataset.id;
      const groupRef = doc(db, "groups", groupId);

      // Xóa tất cả các task trong nhóm
      const q = query(collection(db, "tasks"), where("groupId", "==", groupId));
      const tasksSnapshot = await getDocs(q);
      const batch = getFirestore().batch();
      tasksSnapshot.forEach(taskDoc => {
        batch.delete(taskDoc.ref);
      });
      await batch.commit();

      // Xóa nhóm
      await deleteDoc(groupRef);
      await logAction(groupData.projectId, `đã xóa nhóm: "${groupData.title}"`);
      showToast(`Nhóm "${groupData.title}" đã được xóa.`);
    }
  });

  loadTasks(groupId);
};

const loadTasks = (groupId) => {
  if (taskboardUnsubs[groupId]) {
    taskboardUnsubs[groupId]();
  }

  const tasksRef = collection(db, "tasks");
  const q = query(tasksRef, where("groupId", "==", groupId));

  taskboardUnsubs[groupId] = onSnapshot(q, async (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inprogressTasks = tasks.filter(t => t.status === 'inprogress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    const todoContainer = document.getElementById(`tasks-${groupId}`);
    const inprogressCol = document.getElementById('inprogressCol');
    const doneCol = document.getElementById('doneCol');

    if (!todoContainer || !inprogressCol || !doneCol) return;

    // Cập nhật tiến độ của nhóm
    const progressEl = document.getElementById(`group-progress-${groupId}`);
    if (progressEl) {
      const progress = calculateGroupProgress(tasks);
      progressEl.style.width = `${progress}%`;
      progressEl.classList.toggle('bg-green-500', progress < 100);
      progressEl.classList.toggle('bg-green-600', progress === 100);
    }

    // Xóa tất cả task cũ để render lại từ đầu
    const allTaskElements = [...todoContainer.children, ...inprogressCol.children, ...doneCol.children];
    allTaskElements.forEach(el => {
      const elTaskId = el.dataset.taskId;
      if (elTaskId && tasks.find(t => t.id === elTaskId) === undefined) {
        el.remove();
      }
    });

    // Render lại các task
    todoContainer.innerHTML = '';
    todoTasks.forEach(task => renderTask(task, todoContainer));

    inprogressCol.innerHTML = '';
    inprogressTasks.forEach(task => renderTask(task, inprogressCol));

    doneCol.innerHTML = '';
    doneTasks.forEach(task => renderTask(task, doneCol));
  });
};

const renderTask = (taskData, container) => {
  const taskId = taskData.id;
  let taskItem = document.getElementById(`task-${taskId}`);
  if (!taskItem) {
    taskItem = document.createElement('div');
    taskItem.id = `task-${taskId}`;
    taskItem.className = 'task-item bg-white rounded-lg p-3 shadow-md border border-gray-200 cursor-pointer transition-transform duration-200 transform hover:scale-105';
    taskItem.setAttribute('draggable', true);
    taskItem.dataset.taskId = taskId;
    taskItem.dataset.type = 'task';

    taskItem.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('taskId', taskId);
      e.dataTransfer.setData('type', 'task');
      e.dataTransfer.effectAllowed = 'move';
    });
    container.appendChild(taskItem);
  }

  // Cập nhật nội dung của task
  taskItem.innerHTML = `
    <h4 class="font-semibold text-gray-800">${taskData.title}</h4>
    <p class="text-xs text-gray-500">
      <i class="fas fa-user-circle mr-1"></i> ${taskData.assignee}
    </p>
    <p class="text-xs text-gray-500">
      <i class="fas fa-calendar-alt mr-1"></i> ${taskData.deadline}
    </p>
    <div class="flex items-center mt-2 space-x-2 text-xs text-gray-500">
      <button class="reaction-btn hover:scale-125 transition-transform duration-200" data-task-id="${taskId}" data-reaction="like">👍 <span class="reaction-count text-sm font-semibold">${taskData.reactions?.like || 0}</span></button>
      <button class="reaction-btn hover:scale-125 transition-transform duration-200" data-task-id="${taskId}" data-reaction="love">❤️ <span class="reaction-count text-sm font-semibold">${taskData.reactions?.love || 0}</span></button>
      <button class="reaction-btn hover:scale-125 transition-transform duration-200" data-task-id="${taskId}" data-reaction="hooray">🎉 <span class="reaction-count text-sm font-semibold">${taskData.reactions?.hooray || 0}</span></button>
      <button class="reaction-btn hover:scale-125 transition-transform duration-200" data-task-id="${taskId}" data-reaction="sad">😢 <span class="reaction-count text-sm font-semibold">${taskData.reactions?.sad || 0}</span></button>
    </div>
  `;
};

// ========================================================================
// === Đây là đoạn code được thêm vào để xử lý xác thực người dùng  ===
// === và khởi chạy ứng dụng sau khi xác thực thành công.              ===
// ========================================================================
let isInitialRun = true;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (!isAuthReady) {
      isAuthReady = true;
      console.log("Xác thực thành công. Sẵn sàng khởi chạy ứng dụng.");
      // Chạy ứng dụng lần đầu
      if (isInitialRun) {
        window.dispatchEvent(new Event('hashchange'));
        isInitialRun = false;
      }
    }
  } else {
    currentUser = null;
    isAuthReady = false;
    console.log("Người dùng chưa được xác thực.");
    // Có thể chuyển hướng đến trang đăng nhập nếu cần
    // window.location.hash = '#login';
  }
});

// Sự kiện hashchange để điều hướng trang
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if (hash.startsWith('taskboard/')) {
    const parts = hash.split('/');
    if (parts.length === 3) {
      const projectId = parts[1];
      const projectTitle = decodeURIComponent(parts[2]);
      showTaskBoard(projectId, projectTitle);
    }
  }
});
