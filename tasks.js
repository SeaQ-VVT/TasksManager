// ========================================================================
// === Đây là toàn bộ code đã được sửa lỗi cho file tasks.js. Bạn có    ===
// === thể thay thế hoàn toàn file cũ của mình bằng đoạn code này.        ===
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
  deleteField
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config (Sử dụng config từ file của bạn) =====
const firebaseConfig = {
  apiKey: "AIzaSyBw3hWbWLvr2W2pdPL8_wKNB5x_BcnwrOI",
  authDomain: "task-806e4.firebaseapp.com",
  projectId: "task-806e4",
  storageBucket: "task-806e4.firebasestorage.app",
  messagingSenderId: "638366751634",
  appId: "1:638366751634:web:1cff140df54007edecff4b",
  measurementId: "G-TLJSXWQBZD"
};

// ===== Khởi tạo Firebase =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Biến lưu trữ người dùng hiện tại và trạng thái đăng nhập
let currentUser = null;
let isAuthReady = false;

// Đảm bảo các hoạt động Firestore chỉ chạy sau khi xác thực xong
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAuthReady = true;
});

// ===== Helper cho Modal (Popup) =====
function openModal(title, fields, onSave) {
  let modal = document.getElementById("popupModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "popupModal";
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-4 w-11/12 md:w-1/2 lg:w-1/3 shadow-lg">
        <h3 id="modalTitle" class="font-semibold text-lg mb-2"></h3>
        <div id="modalFields" class="space-y-2"></div>
        <div class="flex justify-end space-x-2 mt-4">
          <button id="modalCancel" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">Hủy</button>
          <button id="modalSave" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Lưu</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById("modalTitle").textContent = title;
  const fieldsDiv = document.getElementById("modalFields");
  fieldsDiv.innerHTML = "";
  fields.forEach(f => {
    if (f.type === "textarea") {
      fieldsDiv.innerHTML += `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full rounded-md">${f.value || ""}</textarea>`;
    } else if (f.type === "color") {
      fieldsDiv.innerHTML += `
        <div class="flex items-center space-x-2">
          <label for="${f.id}" class="text-gray-700 w-20">Màu:</label>
          <input id="${f.id}" type="color" class="border p-1 w-full rounded-md" value="${f.value || "#000000"}">
        </div>`;
    } else if (f.type === "range") {
      fieldsDiv.innerHTML += `
        <div class="flex flex-col">
          <label for="${f.id}" class="text-gray-700">Tiến độ (<span id="progress-value-${f.id}">${f.value || 0}</span>%)</label>
          <input id="${f.id}" type="range" min="0" max="100" value="${f.value || 0}" class="w-full">
        </div>`;
    } else if (f.type === "date") {
      fieldsDiv.innerHTML += `
        <div class="flex flex-col">
          <label for="${f.id}" class="text-gray-700">${f.label || 'Hạn Chót'}:</label>
          <input id="${f.id}" type="date" class="border p-2 w-full rounded-md" value="${f.value || ""}">
        </div>`;
    } else {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full rounded-md" value="${f.value || ""}">`;
    }
  });

  modal.classList.remove("hidden");

  const progressInput = document.getElementById("progress");
  if (progressInput) {
    const progressValueSpan = document.getElementById("progress-value-progress");
    progressInput.addEventListener("input", (e) => {
      progressValueSpan.textContent = e.target.value;
    });
  }

  document.getElementById("modalCancel").onclick = () => modal.classList.add("hidden");
  document.getElementById("modalSave").onclick = () => {
    const values = {};
    fields.forEach(f => values[f.id] = document.getElementById(f.id).value);
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===== Các hàm tiện ích chung =====
function getUserDisplayName(email) {
  if (!email) return "Ẩn danh";
  return email.split('@')[0];
}

function showToast(message) {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-2";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = "bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl animate-fade-in-up transition-opacity duration-500 ease-in-out";
  toast.textContent = message;

  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes fadeInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .animate-fade-in-up { animation: fadeInUp 0.5s ease-in-out; }`;
  document.head.appendChild(style);

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

function formatDateVN(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${d}/${m}/${y}`;
}

// ===== Nhật ký hoạt động (Logs) =====
async function logAction(projectId, action, emoji = null, groupId = null) {
  if (!isAuthReady) return; // Đảm bảo người dùng đã xác thực

  const user = currentUser?.email || "Ẩn danh";
  let logMessage = action;

  // Ghi log vào Firestore
  await addDoc(collection(db, "logs"), {
    projectId,
    action: logMessage,
    user,
    emoji: emoji,
    timestamp: serverTimestamp()
  });
}

// Biến lưu trữ listener logs để có thể hủy khi đổi dự án
let logsUnsub = null;

function listenForLogs(projectId) {
  // Hủy listener cũ để không bị nhận thông báo từ dự án khác
  if (logsUnsub) {
    logsUnsub();
    logsUnsub = null;
  }

  const logsCol = collection(db, "logs");
  const q = query(logsCol, where("projectId", "==", projectId));

  let initial = true;

  logsUnsub = onSnapshot(q, (snapshot) => {
    const logEntries = document.getElementById("logEntries");
    if (logEntries) {
      const logs = [];
      snapshot.forEach((doc) => logs.push(doc.data()));
      logs.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
        return dateB - dateA;
      });

      logEntries.innerHTML = "";
      logs.forEach((data) => {
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
        const userDisplayName = getUserDisplayName(data.user);
        const logItem = document.createElement("div");
        logItem.className = "flex items-center space-x-2";
        logItem.innerHTML = `
          <span class="text-sm text-gray-600">[${timestamp}] ${userDisplayName} đã ${data.action}</span>
          ${data.emoji ? `<span class="text-sm">${data.emoji}</span>` : ''}
        `;
        logEntries.appendChild(logItem);
      });
    }

    if (initial) {
      initial = false;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const userDisplayName = getUserDisplayName(data.user);
        let toastMessage = `${userDisplayName} đã ${data.action}.`;
        if (data.emoji) {
          toastMessage += ` ${data.emoji}`;
        }
        showToast(toastMessage);
      }
    });
  });
}

// ===== Cấu hình và Helpers cho Deadline =====
const DEADLINE_CFG = {
  thresholds: [14, 7, 3], // <=14 cam, <=7 vàng, <=3 đỏ
  classes: ["bg-orange-100", "bg-yellow-300", "bg-red-400"],
};

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  const d = new Date(dateStr + "T23:59:59");
  return Math.floor((d - today) / (1000 * 60 * 60 * 24));
}

function colorClassByDaysLeft(days, cfg = DEADLINE_CFG) {
  const { thresholds, classes } = cfg;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (days <= thresholds[i]) return classes[i];
  }
  return "";
}

function getGroupWarnClass(g) {
  if (!g || !g.deadline) return "";
  const left = daysUntil(g.deadline);
  if (g.status === "todo" || g.status === "inprogress") {
    return colorClassByDaysLeft(left);
  }
  return "";
}

function removeWarnClasses(el) {
  if (!el) return;
  [...el.classList].forEach(c => {
    if (c.startsWith("bg-")) el.classList.remove(c);
  });
}

function applyGroupColor(gid, g) {
  const cls = getGroupWarnClass(g);

  // Thẻ Group (To Do)
  const todoCard = document.getElementById(`group-${gid}`);
  if (todoCard) {
    removeWarnClasses(todoCard);
    if (g.status === "todo" && cls) {
      todoCard.classList.add(...cls.split(" "));
    }
  }

  // Khung In Progress
  const ipWrapper = document.getElementById(`inprogress-${gid}`)?.parentElement;
  if (ipWrapper) {
    removeWarnClasses(ipWrapper);
    if (g.status === "inprogress" && cls) {
      ipWrapper.classList.add(...cls.split(" "));
    }
  }

  // Khung Done (luôn bỏ cảnh báo)
  const doneWrapper = document.getElementById(`done-${gid}`)?.parentElement;
  if (doneWrapper) removeWarnClasses(doneWrapper);
}

// ===== Render Bảng Công Việc (Project View) =====
// Đây là hàm chính để hiển thị giao diện bảng công việc
// Nó nhận projectId, do đó mỗi lần gọi sẽ chỉ hiển thị đúng dự án đó
export function showTaskBoard(projectId, projectTitle) {
  const taskBoard = document.getElementById("taskBoard");

  taskBoard.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Bạn đang ở dự án: ${projectTitle}</h2>

    <div id="logArea" class="mt-4 bg-gray-100 p-4 rounded-lg">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-semibold text-gray-700">Nhật ký hoạt động</h4>
        <button id="toggleLogBtn" class="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-400 transition-colors">Hiện log</button>
      </div>
      <div id="logEntries" class="space-y-2 text-sm text-gray-600 hidden"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4 overflow-x-hidden">
      <!-- Cột To Do -->
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-teal-200 h-full">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-bold text-red-600">To Do</h3>
          <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
            + Group
          </button>
        </div>
        <div id="groupContainer" class="space-y-3 mt-2 h-[60vh] overflow-y-auto"></div>
      </div>
      <!-- Cột In Progress -->
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-blue-200 h-full">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-3 mt-2 h-[60vh] overflow-y-auto"></div>
      </div>
      <!-- Cột Done -->
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-green-400 h-full">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-3 mt-2 h-[60vh] overflow-y-auto"></div>
      </div>
    </div>

    <!-- Biểu đồ tổng tiến độ dự án -->
    <div id="project-progress-chart-container" class="mt-8 bg-white p-4 rounded shadow">
        <h3 class="font-bold text-gray-800 mb-2">Tiến độ tổng thể dự án</h3>
        <canvas id="project-progress-chart" class="w-full h-[200px]"></canvas>
    </div>
  `;

  // Thêm Chart.js CDN
  const chartJsScript = document.createElement("script");
  chartJsScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(chartJsScript);

  // Thêm sự kiện cho nút "Hiện/Ẩn log"
  document.getElementById("toggleLogBtn").addEventListener("click", () => {
    const logEntries = document.getElementById("logEntries");
    const button = document.getElementById("toggleLogBtn");
    if (logEntries.classList.contains("hidden")) {
      logEntries.classList.remove("hidden");
      button.textContent = "Ẩn log";
    } else {
      logEntries.classList.add("hidden");
      button.textContent = "Hiện log";
    }
  });

  // Gắn sự kiện cho nút "Thêm Group"
  document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));

  // Gọi các hàm tải dữ liệu và thiết lập listener với projectId cụ thể
  loadGroups(projectId);
  setupDragDrop();
  listenForLogs(projectId);
  listenForProjectProgress(projectId); // Thêm listener cho tiến độ tổng dự án
}

// ===== Biểu đồ tổng tiến độ dự án =====
let projectChart = null;
let progressUnsub = null; // Thêm biến để lưu listener của biểu đồ

function listenForProjectProgress(projectId) {
    // Hủy listener cũ để tránh lỗi dữ liệu
    if (progressUnsub) {
        progressUnsub();
        progressUnsub = null;
    }

    // Hủy biểu đồ cũ để tránh lỗi
    if (projectChart) {
      projectChart.destroy();
      projectChart = null;
    }

    const tasksCol = collection(db, "tasks");
    const qTasks = query(tasksCol, where("projectId", "==", projectId));
    const historyCol = collection(db, "progress_history");
    const qHistory = query(historyCol, where("projectId", "==", projectId));

    // Lắng nghe thay đổi tiến độ của các task và cập nhật lịch sử
    progressUnsub = onSnapshot(qTasks, async (snapshot) => {
        let totalProgress = 0;
        let totalTasks = 0;
        snapshot.forEach(doc => {
            const task = doc.data();
            totalProgress += task.progress || 0;
            totalTasks++;
        });

        const currentProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
        
        // Ghi lại tiến độ vào Firestore
        await addDoc(collection(db, "progress_history"), {
            projectId,
            progress: currentProgress,
            timestamp: serverTimestamp()
        });
    });

    // Lắng nghe dữ liệu lịch sử tiến độ từ Firestore
    onSnapshot(qHistory, (snapshot) => {
        let projectHistory = [];
        snapshot.forEach(doc => {
            projectHistory.push(doc.data());
        });
        
        projectHistory.sort((a, b) => {
            // Sắp xếp theo timestamp, kiểm tra tính hợp lệ của đối tượng timestamp
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
            return dateA - dateB;
        });
        
        updateProjectChart(projectHistory);
    });
}

function updateProjectChart(projectHistory) {
    const ctx = document.getElementById('project-progress-chart')?.getContext('2d');
    if (!ctx) return;

    const labels = projectHistory.map(h => {
        const date = h.timestamp?.toDate ? h.timestamp.toDate() : new Date();
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    });
    const data = projectHistory.map(h => h.progress);
    
    if (projectChart) {
        projectChart.data.labels = labels;
        projectChart.data.datasets[0].data = data;
        projectChart.update();
    } else {
        projectChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tiến độ dự án',
                    data: data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Tiến độ (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Thời gian'
                        }
                    }
                }
            }
        });
    }
}

// ===== Tải Groups theo thời gian thực (Realtime Groups) =====
let groupsUnsub = null;
function loadGroups(projectId) {
  if (groupsUnsub) {
    groupsUnsub();
    groupsUnsub = null;
  }
  const groupsCol = collection(db, "groups");
  const qGroups = query(groupsCol, where("projectId", "==", projectId));
  groupsUnsub = onSnapshot(qGroups, (snapshot) => {
    const groupContainer = document.getElementById("groupContainer");
    const inprogressCol = document.getElementById("inprogressCol");
    const doneCol = document.getElementById("doneCol");
    if (!groupContainer || !inprogressCol || !doneCol) return;
    
    groupContainer.innerHTML = "";
    inprogressCol.innerHTML = "";
    doneCol.innerHTML = "";
    
    const groups = [];
    snapshot.forEach(docSnap => groups.push({ id: docSnap.id, ...docSnap.data() }));

    // Sắp xếp groups theo createdAt để group mới nhất ở trên
    groups.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    groups.forEach((g) => {
        const gid = g.id;
        const ipSection = document.createElement("div");
        ipSection.className = "border rounded p-2 bg-gray-50 shadow";
        ipSection.innerHTML = `
            <div class="flex justify-between items-center">
            <span class="font-semibold text-yellow-700">${g.title || 'Không có tiêu đề'}</span>
            </div>
            <div id="inprogress-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
        `;
        inprogressCol.appendChild(ipSection);

        const doneSection = document.createElement("div");
        doneSection.className = "border rounded p-2 bg-gray-50 shadow";
        doneSection.innerHTML = `
            <div class="flex justify-between items-center">
            <span class="font-semibold text-green-700">${g.title || 'Không có tiêu đề'}</span>
            </div>
            <div id="done-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
        `;
        doneCol.appendChild(doneSection);

        renderGroup({ id: gid, data: () => g });
        applyGroupColor(gid, g);
    });
  });
}

// ===== Render Group (Cột To Do) =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;
  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-50 shadow";
  div.id = `group-${gid}`;
  const deadlineText = g.deadline ? `<span class="text-xs text-gray-500 ml-2">⏰ ${formatDateVN(g.deadline)}</span>` : "";
  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title || 'Không có tiêu đề'}${deadlineText}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600 hover:text-yellow-700" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600 hover:text-red-700" title="Xóa group">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1 hover:text-green-700">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
    <!-- Biểu đồ tiến độ nhóm -->
    <div class="progress-bar-container mt-4" id="group-progress-container-${gid}">
      <div class="flex items-center mb-1">
        <span class="text-sm font-semibold text-gray-700 mr-2">Tiến độ nhóm:</span>
        <span id="group-progress-value-${gid}" class="text-sm font-medium text-blue-500">0%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div id="group-progress-bar-${gid}" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%;"></div>
      </div>
    </div>
  `;
  document.getElementById("groupContainer").appendChild(div);

  loadTasks(gid);
  
  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Tải Tasks theo thời gian thực (Realtime Tasks) =====
function loadTasks(groupId) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("groupId", "==", groupId));
  onSnapshot(qTasks, async (snapshot) => {
    const tasks = [];
    let totalProgress = 0;
    const taskElements = {};
    
    snapshot.forEach((d) => {
      const taskData = d.data();
      tasks.push({ id: d.id, ...taskData });
      totalProgress += taskData.progress || 0;
      taskElements[d.id] = renderTask(d);
    });
    
    const groupProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;
    const groupProgressBar = document.getElementById(`group-progress-bar-${groupId}`);
    const groupProgressValue = document.getElementById(`group-progress-value-${groupId}`);
    if (groupProgressBar && groupProgressValue) {
      groupProgressBar.style.width = `${groupProgress}%`;
      groupProgressValue.textContent = `${groupProgress}%`;
    }

    const tasksTodoContainer = document.getElementById(`tasks-${groupId}`);
    const inprogressCol = document.getElementById(`inprogress-${groupId}`);
    const doneCol = document.getElementById(`done-${groupId}`);
    
    if (tasksTodoContainer) tasksTodoContainer.innerHTML = '';
    if (inprogressCol) inprogressCol.innerHTML = '';
    if (doneCol) doneCol.innerHTML = '';

    tasks.forEach(task => {
        const status = task.status || "todo";
        const taskElement = taskElements[task.id];
        if (taskElement) {
            if (status === "todo" && tasksTodoContainer) {
                tasksTodoContainer.appendChild(taskElement);
            } else if (status === "inprogress" && inprogressCol) {
                inprogressCol.appendChild(taskElement);
            } else if (status === "done" && doneCol) {
                doneCol.appendChild(taskElement);
            }
        }
    });
  });
}

// ===== Render Task (Hiển thị một Task cụ thể) =====
function renderTask(docSnap) {
  const task = docSnap.data();
  const tid = docSnap.id;
  
  const div = document.createElement("div");
  div.id = `task-${tid}`;
  div.className = "bg-white p-2 rounded shadow-sm flex flex-col cursor-pointer transition-transform transform hover:scale-105";
  div.setAttribute("draggable", "true");
  div.dataset.taskId = tid;
  div.dataset.groupId = task.groupId;
  div.dataset.projectId = task.projectId;
  div.dataset.status = task.status;

  const progressColor = task.progress >= 100 ? "bg-green-500" : "bg-blue-500";
  const progressText = `<span class="text-xs text-white font-semibold">${task.progress || 0}%</span>`;
  const progressLine = `<div class="h-2 ${progressColor} transition-all duration-300 rounded-full" style="width: ${task.progress || 0}%;"></div>`;

  const emojiDisplay = task.emoji ? `<span class="ml-2">${task.emoji}</span>` : '';

  div.innerHTML = `
    <div class="flex-grow">
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <span class="font-medium text-gray-800">${task.title || 'Không có tiêu đề'}</span>
                ${emojiDisplay}
            </div>
            <div class="flex space-x-1">
                <button class="select-emoji text-gray-400 hover:text-yellow-500" title="Chọn biểu tượng cảm xúc">😃</button>
                <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa task">✏️</button>
                <button class="delete-task text-red-600 hover:text-red-700" title="Xóa task">🗑️</button>
            </div>
        </div>
        <p class="text-sm text-gray-600 mt-1">${task.description || ''}</p>
        <div class="relative w-full bg-gray-200 rounded-full mt-2">
            ${progressLine}
            <div class="absolute inset-0 flex items-center justify-center">${progressText}</div>
        </div>
    </div>
  `;
  
  div.querySelector(".edit-task").addEventListener("click", (e) => { e.stopPropagation(); editTask(tid, task); });
  div.querySelector(".delete-task").addEventListener("click", (e) => { e.stopPropagation(); deleteTask(tid, task); });
  div.querySelector(".select-emoji").addEventListener("click", (e) => { e.stopPropagation(); openEmojiModal(tid, task); });
  
  return div;
}

// ===== Logic CRUD cho Task =====
function openTaskModal(groupId, projectId, taskData = null, taskId = null) {
  const isEditing = !!taskData;
  const title = isEditing ? `Sửa task: ${taskData.title || ''}` : "Tạo task mới";
  const fields = [
    { id: "taskTitle", type: "text", placeholder: "Tên task", value: taskData?.title },
    { id: "taskDescription", type: "textarea", placeholder: "Mô tả", value: taskData?.description },
    { id: "progress", type: "range", value: taskData?.progress || 0 },
  ];

  openModal(title, fields, async (values) => {
    const taskPayload = {
      title: values.taskTitle || 'Không có tiêu đề',
      description: values.taskDescription || '',
      progress: parseInt(values.progress, 10),
      status: taskData?.status || "todo",
      groupId,
      projectId,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    };

    if (isEditing) {
      await updateDoc(doc(db, "tasks", taskId), taskPayload);
      await logAction(projectId, `cập nhật task "${taskData.title || ''}"`);
    } else {
      await addDoc(collection(db, "tasks"), { ...taskPayload, createdAt: serverTimestamp() });
      await logAction(projectId, `tạo task "${values.taskTitle || ''}"`);
    }
  });
}

function openEmojiModal(taskId, taskData) {
  const emojis = ["👍", "🎉", "🔥", "❤️", "🚀", "💡", "🤔", "😊"];
  let modal = document.getElementById("emojiModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "emojiModal";
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-4 shadow-lg">
        <h3 class="font-semibold text-lg mb-4">Chọn một biểu tượng cảm xúc</h3>
        <div id="emoji-container" class="flex flex-wrap gap-2 text-2xl">
          ${emojis.map(e => `<button class="emoji-btn p-2 rounded-full hover:bg-gray-200 transition-colors">${e}</button>`).join('')}
        </div>
        <div class="flex justify-end mt-4">
          <button id="cancel-emoji" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Hủy</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.classList.remove("hidden");
  }

  document.getElementById("cancel-emoji").onclick = () => modal.classList.add("hidden");
  document.getElementById("emoji-container").addEventListener("click", async (e) => {
    if (e.target.classList.contains("emoji-btn")) {
      const selectedEmoji = e.target.textContent;
      await updateDoc(doc(db, "tasks", taskId), { emoji: selectedEmoji });
      await logAction(taskData.projectId, `cập nhật cảm xúc cho task "${taskData.title || ''}" thành`, selectedEmoji);
      modal.classList.add("hidden");
    }
  });
}

async function editTask(taskId, taskData) {
  openTaskModal(taskData.groupId, taskData.projectId, taskData, taskId);
}

async function deleteTask(taskId, taskData) {
  if (confirm(`Bạn có chắc muốn xóa task "${taskData.title || ''}" không?`)) {
    await deleteDoc(doc(db, "tasks", taskId));
    await logAction(taskData.projectId, `xóa task "${taskData.title || ''}"`);
  }
}

// ===== Logic CRUD cho Group =====
function openGroupModal(projectId, groupData = null, groupId = null) {
  const isEditing = !!groupData;
  const title = isEditing ? `Sửa group: ${groupData.title || ''}` : "Tạo group mới";
  const fields = [
    { id: "groupTitle", type: "text", placeholder: "Tên group", value: groupData?.title },
    { id: "groupDeadline", type: "date", label: "Hạn chót", value: groupData?.deadline },
  ];

  openModal(title, fields, async (values) => {
    const groupPayload = {
      title: values.groupTitle || 'Không có tiêu đề',
      deadline: values.groupDeadline || null,
      projectId,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    };

    if (isEditing) {
      await updateDoc(doc(db, "groups", groupId), groupPayload);
      await logAction(projectId, `cập nhật group "${groupData.title || ''}"`);
    } else {
      await addDoc(collection(db, "groups"), { ...groupPayload, createdAt: serverTimestamp() });
      await logAction(projectId, `tạo group "${values.groupTitle || ''}"`);
    }
  });
}

async function addGroup(projectId) {
  openGroupModal(projectId);
}

async function editGroup(groupId, groupData) {
  openGroupModal(groupData.projectId, groupData, groupId);
}

async function deleteGroup(groupId, groupData) {
  if (confirm(`Bạn có chắc muốn xóa group "${groupData.title || ''}" không?`)) {
    await deleteDoc(doc(db, "groups", groupId));
    await logAction(groupData.projectId, `xóa group "${groupData.title || ''}"`);
  }
}

// ===== Sự kiện Drag & Drop =====
function setupDragDrop() {
  const cols = document.querySelectorAll("#inprogressCol, #doneCol");
  let draggedTask = null;

  document.addEventListener("dragstart", (e) => {
    if (e.target.dataset.taskId) {
      draggedTask = e.target;
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("taskId", draggedTask.dataset.taskId);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => draggedTask.classList.add("hidden"), 0);
    }
  });

  document.addEventListener("dragend", (e) => {
    if (draggedTask) {
      draggedTask.classList.remove("hidden");
      draggedTask = null;
    }
  });

  cols.forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    col.addEventListener("drop", async (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const dropCol = e.target.closest("#inprogressCol, #doneCol");
      if (!dropCol) return;
      const colId = dropCol.id;

      const newStatus = colId === "inprogressCol" ? "inprogress" : "done";

      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) return;
      const taskData = taskSnap.data();

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
      
      let logMessage = `chuyển task "${taskData.title || ''}" sang trạng thái "${newStatus}"`;
      if (newStatus === "done") {
        logMessage += ` và hoàn thành 100%`;
      }
      logMessage += ` trong group "${taskData.groupId}"`;
      await logAction(taskData.projectId, logMessage);
    });
  });
}
