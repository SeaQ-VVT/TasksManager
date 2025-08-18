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
  writeBatch
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
      <div class="bg-white rounded-lg p-4 w-96 shadow-lg">
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
          <input id="${f.id}" type="color" class="border p-1 w-full rounded-md" value="${f.value || "#e5e7eb"}">
        </div>`;
    } else if (f.type === "range") {
      fieldsDiv.innerHTML += `
        <div class="flex flex-col">
          <label for="${f.id}" class="text-gray-700">Tiến độ (<span id="progress-value-${f.id}">${f.value || 0}</span>%)</label>
          <input id="${f.id}" type="range" min="0" max="100" value="${f.value || 0}" class="w-full">
        </div>`;
    } else if (f.type === "date") {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="date" class="border p-2 w-full rounded-md" value="${f.value || ""}">`;
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
async function logAction(projectId, action, groupId = null, systemId = null) {
  if (!isAuthReady) return; // Đảm bảo người dùng đã xác thực

  const user = currentUser?.email || "Ẩn danh";
  let logMessage = action;

  // Lấy thông tin group và system nếu có
  if (groupId) {
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      logMessage += ` trong group "${groupData.title}"`;
    }
  }
  if (systemId) {
    const systemSnap = await getDoc(doc(db, "systems", systemId));
    if (systemSnap.exists()) {
      const systemData = systemSnap.data();
      logMessage += ` (system "${systemData.title}")`;
    }
  }

  await addDoc(collection(db, "logs"), {
    projectId,
    action: logMessage,
    user,
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
      logs.sort((a, b) => b.timestamp - a.timestamp);

      logEntries.innerHTML = "";
      logs.forEach((data) => {
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
        const userDisplayName = getUserDisplayName(data.user);
        const logItem = document.createElement("div");
        logItem.textContent = `[${timestamp}] ${userDisplayName} đã ${data.action}.`;
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
        showToast(`${userDisplayName} đã ${data.action}.`);
      }
    });
  });
}

// ===== Cấu hình và Helpers cho Deadline =====
const DEADLINE_CFG = {
  thresholds: [14, 7, 3], // <=14 cam, <=7 vàng, <=3 đỏ
  classes: ["ring-2 ring-orange-300", "ring-2 ring-yellow-400", "ring-2 ring-red-500"],
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

function getSystemWarnClass(s) {
  if (!s || !s.deadline) return "";
  const left = daysUntil(s.deadline);
  if (s.status === "todo" || s.status === "inprogress") {
    return colorClassByDaysLeft(left);
  }
  return "";
}

function removeWarnClasses(el) {
  if (!el) return;
  [...el.classList].forEach(c => {
    if (c.startsWith("ring-")) el.classList.remove(c);
  });
}

function applySystemColor(sid, s) {
  const cls = getSystemWarnClass(s);

  // Thẻ System (To Do)
  const todoCard = document.getElementById(`system-${sid}`);
  if (todoCard) {
    removeWarnClasses(todoCard);
    if (s.status === "todo" && cls) {
      todoCard.classList.add(...cls.split(" "));
    }
  }

  // Khung In Progress
  const ipWrapper = document.getElementById(`inprogress-wrapper-${sid}`);
  if (ipWrapper) {
    removeWarnClasses(ipWrapper);
    if (s.status === "inprogress" && cls) {
      ipWrapper.classList.add(...cls.split(" "));
    }
  }

  // Khung Done (luôn bỏ cảnh báo)
  const doneWrapper = document.getElementById(`done-wrapper-${sid}`);
  if (doneWrapper) removeWarnClasses(doneWrapper);
}

// ===== Render Bảng Công Việc (Project View) =====
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

    <!-- Cập nhật lớp Tailwind cho các cột để có cùng chiều cao và thanh cuộn -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
      <!-- Cột To Do -->
      <div id="todoCol" class="bg-white p-3 rounded shadow flex flex-col">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-bold text-red-600">To Do</h3>
          <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
            + Group
          </button>
        </div>
        <!-- Thêm chiều cao cố định và thanh cuộn cho group container -->
        <div id="groupContainer" class="space-y-3 mt-2 h-[30cm] overflow-y-auto"></div>
      </div>
      <!-- Cột In Progress -->
      <div id="inprogressCol" class="bg-white p-3 rounded shadow flex flex-col">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <!-- Thêm chiều cao cố định và thanh cuộn cho cột In Progress -->
        <div id="inprogressSystems" class="space-y-3 mt-2 h-[30cm] overflow-y-auto"></div>
      </div>
      <!-- Cột Done -->
      <div id="doneCol" class="bg-white p-3 rounded shadow flex flex-col">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <!-- Thêm chiều cao cố định và thanh cuộn cho cột Done -->
        <div id="doneSystems" class="space-y-3 mt-2 h-[30cm] overflow-y-auto"></div>
      </div>
    </div>

    <!-- Biểu đồ tổng tiến độ dự án -->
    <div id="project-progress-chart-container" class="mt-8 bg-white p-4 rounded shadow">
        <h3 class="font-bold text-gray-800 mb-2">Tiến độ tổng thể dự án</h3>
        <canvas id="project-progress-chart" class="w-full h-64"></canvas>
    </div>
  `;

  // Thêm Chart.js CDN
  const chartJsScript = document.createElement("script");
  chartJsScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(chartJsScript);
  
  // Sửa lỗi biểu đồ kéo dài
  const style = document.createElement("style");
  style.textContent = `
    #project-progress-chart-container {
      width: 100%;
      max-width: 100%;
      height: 300px;
    }
  `;
  document.head.appendChild(style);

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

  // Gọi các hàm tải dữ liệu và thiết lập listener với projectId cụ thể
  loadGroups(projectId);
  setupGroupListeners(projectId);
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

    // Lắng nghe dữ liệu lịch sử tiến độ từ Firestore
    const historyCol = collection(db, "progress_history");
    const qHistory = query(historyCol, where("projectId", "==", projectId));
    
    progressUnsub = onSnapshot(qHistory, (snapshot) => {
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

    // Lắng nghe thay đổi tiến độ của các task và cập nhật lịch sử
    const tasksCol = collection(db, "tasks");
    const qTasks = query(tasksCol, where("projectId", "==", projectId));

    onSnapshot(qTasks, async (snapshot) => {
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
}

function updateProjectChart(projectHistory) {
    const ctx = document.getElementById('project-progress-chart').getContext('2d');
    
    const labels = projectHistory.map(h => {
        // Kiểm tra đối tượng timestamp trước khi gọi toDate()
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
    
    // Clear all existing group elements
    const existingGroups = document.querySelectorAll('[id^="group-"]');
    existingGroups.forEach(el => el.remove());
    
    // Clear all existing system elements from all columns
    const existingSystems = document.querySelectorAll('[id^="system-"], [id^="inprogress-wrapper-"], [id^="done-wrapper-"]');
    existingSystems.forEach(el => el.remove());

    // Clear all existing task elements from all columns
    const existingTasks = document.querySelectorAll('[id^="task-"]');
    existingTasks.forEach(el => el.remove());

    snapshot.forEach((docSnap) => {
      renderGroup(docSnap);
    });
  });
}

// ===== Render Group (Cột To Do) =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;

  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-100 shadow";
  div.id = `group-${gid}`;

  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-gray-800">${g.title}</span>
      <div class="space-x-1">
        <button class="add-system text-green-600 hover:text-green-700" title="Thêm System">➕</button>
        <button class="edit-group text-yellow-600 hover:text-yellow-700" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600 hover:text-red-700" title="Xóa group">🗑️</button>
      </div>
    </div>
    <div id="systems-${gid}" class="space-y-3 mt-2"></div>
  `;

  document.getElementById("groupContainer").appendChild(div);

  // Tải các system con của group này
  loadSystems(gid);

  // Thêm sự kiện cho các nút
  div.querySelector(".add-system").addEventListener("click", () => addSystem(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Tải Systems theo thời gian thực =====
function loadSystems(groupId) {
  const systemsCol = collection(db, "systems");
  const qSystems = query(systemsCol, where("groupId", "==", groupId));

  onSnapshot(qSystems, (snapshot) => {
    const systemsContainer = document.getElementById(`systems-${groupId}`);
    if (!systemsContainer) return;

    // Lọc và xóa các system cũ của group này khỏi tất cả các cột
    const oldSystems = document.querySelectorAll(`[data-group-id="${groupId}"]`);
    oldSystems.forEach(el => el.remove());

    snapshot.forEach((docSnap) => {
      renderSystemCards(docSnap);
    });
  });
}

// ===== Render System Card (tại 3 cột To Do, In Progress và Done) =====
function renderSystemCards(docSnap) {
  const s = docSnap.data();
  const sid = docSnap.id;
  const groupId = s.groupId;

  // Render card cho cột To Do
  const todoContainer = document.getElementById(`systems-${groupId}`);
  if (todoContainer) {
    const todoCard = document.createElement("div");
    todoCard.className = "border rounded p-2 bg-gray-50 shadow";
    todoCard.id = `system-${sid}`;
    todoCard.draggable = true;
    todoCard.dataset.systemId = sid;
    todoCard.dataset.groupId = groupId;
    todoCard.dataset.projectId = s.projectId;
    
    const deadlineText = s.deadline ? `<span class="text-xs text-gray-500 ml-2">⏰ ${formatDateVN(s.deadline)}</span>` : "";

    todoCard.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="font-semibold text-blue-700">${s.title}${deadlineText}</span>
        <div class="space-x-1">
          <button class="add-task text-green-600 text-xs hover:text-green-700" title="Thêm Task">+</button>
          <button class="edit-system text-yellow-600 hover:text-yellow-700" title="Sửa System">✏️</button>
          <button class="delete-system text-red-600 hover:text-red-700" title="Xóa System">🗑️</button>
        </div>
      </div>
      <div id="tasks-${sid}" class="space-y-1 mt-2 min-h-[30px]"></div>
      
      <div class="progress-bar-container mt-4" id="system-progress-container-${sid}">
        <div class="flex items-center mb-1">
          <span class="text-sm font-semibold text-gray-700 mr-2">Tiến độ system:</span>
          <span id="system-progress-value-${sid}" class="text-sm font-medium text-blue-500">0%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div id="system-progress-bar-${sid}" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%;"></div>
        </div>
      </div>
    `;
    todoContainer.appendChild(todoCard);

    // Thêm sự kiện cho các nút
    todoCard.querySelector(".add-task").addEventListener("click", () => openTaskModal(sid, s.groupId, s.projectId));
    todoCard.querySelector(".edit-system").addEventListener("click", () => editSystem(sid, s));
    todoCard.querySelector(".delete-system").addEventListener("click", () => deleteSystem(sid, s));

    // Sự kiện kéo thả
    todoCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "system");
        e.dataTransfer.setData("systemId", sid);
        e.dataTransfer.setData("groupId", s.groupId);
    });
  }

  // Render card cho cột In Progress
  const ipCol = document.getElementById("inprogressSystems");
  const ipSectionWrapper = document.createElement("div");
  ipSectionWrapper.className = "border rounded p-2 bg-gray-50 shadow";
  ipSectionWrapper.dataset.systemId = sid;
  ipSectionWrapper.dataset.groupId = groupId;
  ipSectionWrapper.id = `inprogress-wrapper-${sid}`;
  ipSectionWrapper.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-yellow-700">${s.title}</span>
    </div>
    <div id="inprogress-${sid}" class="space-y-1 mt-2 min-h-[30px]"></div>
  `;
  ipCol.appendChild(ipSectionWrapper);

  // Render card cho cột Done
  const doneCol = document.getElementById("doneSystems");
  const doneSectionWrapper = document.createElement("div");
  doneSectionWrapper.className = "border rounded p-2 bg-gray-50 shadow";
  doneSectionWrapper.dataset.systemId = sid;
  doneSectionWrapper.dataset.groupId = groupId;
  doneSectionWrapper.id = `done-wrapper-${sid}`;
  doneSectionWrapper.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-green-700">${s.title}</span>
    </div>
    <div id="done-${sid}" class="space-y-1 mt-2 min-h-[30px]"></div>
  `;
  doneCol.appendChild(doneSectionWrapper);

  // Áp màu cảnh báo dựa trên deadline và trạng thái
  applySystemColor(sid, s);

  // Tải các task con của system này
  loadTasks(sid);
}


// ===== Tải Tasks theo thời gian thực (Realtime Tasks) =====
function loadTasks(systemId) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("systemId", "==", systemId));

  onSnapshot(qTasks, async (snapshot) => {
    const tasks = [];
    let totalProgress = 0;
    
    // Xóa các task cũ của system này khỏi tất cả các cột
    const oldTasks = document.querySelectorAll(`[data-system-id-task="${systemId}"]`);
    oldTasks.forEach(el => el.remove());

    snapshot.forEach((d) => {
      const taskData = d.data();
      tasks.push({ id: d.id, ...taskData });
      totalProgress += taskData.progress || 0;
    });
    
    const systemProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;
    
    // Cập nhật biểu đồ tiến độ system
    const systemProgressBar = document.getElementById(`system-progress-bar-${systemId}`);
    const systemProgressValue = document.getElementById(`system-progress-value-${systemId}`);
    
    if (systemProgressBar && systemProgressValue) {
      systemProgressBar.style.width = `${systemProgress}%`;
      systemProgressValue.textContent = `${systemProgress}%`;
    }

    // Render lại tất cả task
    tasks.forEach(task => renderTask({ id: task.id, data: () => task }));

    // Cập nhật trạng thái của System dựa trên trạng thái của các Task
    let newStatus = "todo";
    const hasAny = tasks.length > 0;
    if (hasAny && tasks.some(t => t.status === "inprogress")) newStatus = "inprogress";
    else if (hasAny && tasks.every(t => t.status === "done")) newStatus = "done";

    const sRef = doc(db, "systems", systemId);
    const sSnap = await getDoc(sRef);
    const sData = sSnap.exists() ? sSnap.data() : {};

    if (sData.status !== newStatus) {
      await updateDoc(sRef, { status: newStatus, updatedAt: serverTimestamp() });
    }

    // Áp dụng lại màu cảnh báo sau khi trạng thái thay đổi
    applySystemColor(systemId, { ...sData, status: newStatus });
  });
}

// ===== Render task row (từng thẻ task) =====
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  // Xác định cột để đặt task dựa trên trạng thái của nó
  let colId;
  if (t.status === "todo") colId = `tasks-${t.systemId}`;
  else if (t.status === "inprogress") colId = `inprogress-${t.systemId}`;
  else if (t.status === "done") colId = `done-${t.systemId}`;

  const col = document.getElementById(colId);
  if (!col) return;

  let row = document.createElement("div");
  row.id = `task-${tid}`;
  row.className = "flex flex-col bg-white p-2 rounded-md text-sm cursor-move shadow-sm hover:shadow transition-shadow";
  row.style.borderLeft = `4px solid ${t.color || '#e5e7eb'}`;
  row.draggable = true;
  row.dataset.systemIdTask = t.systemId;

  row.innerHTML = `
    <div class="flex justify-between items-center w-full">
      <span class="truncate font-medium">${t.title}</span>
      <div class="space-x-1 flex-shrink-0">
        <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa">✏️</button>
        <button class="comment-task text-gray-400 hover:text-blue-600" title="Comment">💬</button>
        <button class="delete-task text-red-600 hover:text-red-700" title="Xóa">🗑️</button>
      </div>
    </div>
    <div id="progress-container-${tid}" class="mt-1 w-full bg-gray-200 rounded-full h-2">
      <div class="bg-green-600 h-2 rounded-full transition-all duration-300" style="width: ${t.progress || 0}%;"></div>
    </div>`;

  col.appendChild(row);

  // Sự kiện kéo thả
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
  });

  // Sự kiện click nút sửa
  row.querySelector(".edit-task").addEventListener("click", () => {
    openModal("Sửa Task", [
      { id: "title", placeholder: "Task title", type: "text", value: t.title },
      { id: "progress", label: "Tiến độ", type: "range", value: t.progress || 0 },
      { id: "color", label: "Màu", type: "color", value: t.color || "#e5e7eb" }
    ], async (vals) => {
      const oldTitle = t.title;
      const oldProgress = t.progress;

      await updateDoc(doc(db, "tasks", tid), {
        title: vals.title,
        color: vals.color,
        progress: parseInt(vals.progress),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      });

      if (oldTitle !== vals.title) {
        await logAction(t.projectId, `cập nhật task "${oldTitle}" thành "${vals.title}"`, t.groupId, t.systemId);
      }
      if (oldProgress !== parseInt(vals.progress)) {
        await logAction(t.projectId, `cập nhật tiến độ task "${vals.title}" từ ${oldProgress || 0}% lên ${parseInt(vals.progress)}%`, t.groupId, t.systemId);
      }
    });
  });

  // Sự kiện click nút comment
  row.querySelector(".comment-task").addEventListener("click", () => {
    openModal("Comment Task", [
      { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
    ], async (vals) => {
      if (vals.comment && vals.comment.trim().length > 0) {
        await updateDoc(doc(db, "tasks", tid), {
          comment: vals.comment.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.email || "Ẩn danh"
        });
        await logAction(t.projectId, `thêm comment vào task "${t.title}"`, t.groupId, t.systemId);
      } else {
        await updateDoc(doc(db, "tasks", tid), {
          comment: deleteField(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.email || "Ẩn danh"
        });
        await logAction(t.projectId, `xóa comment của task "${t.title}"`, t.groupId, t.systemId);
      }
    });
  });

  // Sự kiện click nút xóa
  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (confirm("Bạn có chắc muốn xóa task này?")) {
      await deleteDoc(doc(db, "tasks", tid));
      await logAction(t.projectId, `xóa task "${t.title}"`, t.groupId, t.systemId);
    }
  });

  // Cập nhật trạng thái nút comment và thanh tiến độ
  const hasComment = t.comment && t.comment.trim().length > 0;
  const commentBtn = row.querySelector(".comment-task");
  if (hasComment) {
    commentBtn.classList.add("text-blue-600", "font-bold");
  } else {
    commentBtn.classList.remove("text-blue-600", "font-bold");
  }

  const progressBar = row.querySelector(`#progress-container-${tid} div`);
  if (progressBar) {
    progressBar.style.width = `${t.progress || 0}px`;
  }
}

// ===== Group CRUD (Thêm/Sửa/Xóa) =====
async function addGroup(projectId) {
  openModal("Thêm Group", [
    { id: "title", placeholder: "Tên Group" }
  ], async (vals) => {
    if (!isAuthReady) return;
    const newDocRef = await addDoc(collection(db, "groups"), {
      title: vals.title,
      projectId,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });

    await logAction(projectId, `thêm group mới "${vals.title}"`, newDocRef.id);
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [
    { id: "title", placeholder: "Tên", value: g.title }
  ], async (vals) => {
    if (!isAuthReady) return;
    const oldTitle = g.title;

    await updateDoc(doc(db, "groups", groupId), {
      title: vals.title,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    });

    if (oldTitle !== vals.title) {
      await logAction(g.projectId, `cập nhật group "${oldTitle}" thành "${vals.title}"`, groupId);
    }
  });
}

async function deleteGroup(groupId, g) {
  if (!isAuthReady) return;
  if (!confirm("Bạn có chắc muốn xóa group này và tất cả System/Task con?")) return;

  const batch = writeBatch(db);

  // Lấy tất cả systems trong group
  const systemsSnap = await getDocs(query(collection(db, "systems"), where("groupId", "==", groupId)));
  const systemsToDelete = systemsSnap.docs.map(s => s.id);

  // Xóa tất cả tasks trong các systems này
  for (const sid of systemsToDelete) {
    const tasksSnap = await getDocs(query(collection(db, "tasks"), where("systemId", "==", sid)));
    tasksSnap.forEach(t => batch.delete(doc(db, "tasks", t.id)));
    batch.delete(doc(db, "systems", sid));
  }

  // Xóa group
  batch.delete(doc(db, "groups", groupId));

  await batch.commit();

  await logAction(g.projectId, `xóa group "${g.title}" và tất cả các mục con.`);
}

// ===== System CRUD (Thêm/Sửa/Xóa) =====
async function addSystem(groupId, projectId) {
  openModal("Thêm System", [
    { id: "title", placeholder: "Tên System" },
    { id: "deadline", placeholder: "Deadline", type: "date" }
  ], async (vals) => {
    if (!isAuthReady) return;
    const deadline = vals.deadline && vals.deadline.trim() ? vals.deadline.trim() : null;
    const newDocRef = await addDoc(collection(db, "systems"), {
      title: vals.title,
      projectId,
      groupId,
      status: "todo",
      deadline,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });

    await logAction(projectId,
      `thêm system mới "${vals.title}"` +
      (deadline ? ` (deadline ${formatDateVN(deadline)})` : ``), groupId, newDocRef.id
    );
  });
}

async function editSystem(systemId, s) {
  openModal("Sửa System", [
    { id: "title", placeholder: "Tên", value: s.title },
    { id: "deadline", placeholder: "Deadline", type: "date", value: s.deadline || "" }
  ], async (vals) => {
    if (!isAuthReady) return;
    const oldTitle = s.title;
    const oldDeadline = s.deadline || null;
    const newDeadline = (vals.deadline && vals.deadline.trim()) ? vals.deadline.trim() : null;

    const payload = {
      title: vals.title,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh",
      ...(newDeadline ? { deadline: newDeadline } : { deadline: deleteField() })
    };

    await updateDoc(doc(db, "systems", systemId), payload);

    if (oldTitle !== vals.title) {
      await logAction(s.projectId, `cập nhật system "${oldTitle}" thành "${vals.title}"`, s.groupId, systemId);
    }
    if (!oldDeadline && newDeadline) {
      await logAction(s.projectId, `đặt deadline cho system "${vals.title}" là ${formatDateVN(newDeadline)}`, s.groupId, systemId);
    } else if (oldDeadline && newDeadline && oldDeadline !== newDeadline) {
      await logAction(s.projectId, `đổi deadline system "${vals.title}" từ ${formatDateVN(oldDeadline)} sang ${formatDateVN(newDeadline)}`, s.groupId, systemId);
    } else if (oldDeadline && !newDeadline) {
      await logAction(s.projectId, `xóa deadline của system "${vals.title}"`, s.groupId, systemId);
    }

    const newData = { ...s, ...payload };
    applySystemColor(systemId, newData);
  });
}

async function deleteSystem(systemId, s) {
  if (!isAuthReady) return;
  if (!confirm("Bạn có chắc muốn xóa system này và tất cả task con?")) return;

  const batch = writeBatch(db);

  // Xóa tất cả tasks trong system này
  const tasksSnap = await getDocs(query(collection(db, "tasks"), where("systemId", "==", systemId)));
  tasksSnap.forEach(t => batch.delete(doc(db, "tasks", t.id)));

  // Xóa system
  batch.delete(doc(db, "systems", systemId));

  await batch.commit();

  await logAction(s.projectId, `xóa system "${s.title}" và ${tasksSnap.size} task bên trong.`, s.groupId, systemId);
}

// ===== Task CRUD (Thêm) =====
function openTaskModal(systemId, groupId, projectId) {
  openModal("Thêm Task", [
    { id: "title", placeholder: "Tên Task" },
    { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" },
    { id: "color", label: "Màu", type: "color" },
    { id: "progress", label: "Tiến độ", type: "range", value: 0 }
  ], async (vals) => {
    if (!isAuthReady) return;
    await addDoc(collection(db, "tasks"), {
      title: vals.title,
      comment: vals.comment || "",
      color: vals.color || null,
      progress: parseInt(vals.progress),
      projectId,
      groupId,
      systemId,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });
    await logAction(projectId, `thêm task mới "${vals.title}"`, groupId, systemId);
  });
}

// ===== Kéo & Thả (Drag & Drop) =====
function setupDragDrop() {
  const inprogressCol = document.getElementById("inprogressSystems");
  const doneCol = document.getElementById("doneSystems");

  [inprogressCol, doneCol].forEach(col => {
    if (!col) return;
    
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dropZone = e.target.closest('[data-system-id]');
      if (dropZone) {
        dropZone.classList.add('bg-blue-100');
      }
    });

    col.addEventListener("dragleave", (e) => {
      e.target.closest('[data-system-id]')?.classList.remove('bg-blue-100');
    });

    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.target.closest('[data-system-id]')?.classList.remove('bg-blue-100');

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;
      
      const dropTarget = e.target.closest('[data-system-id]');
      if (!dropTarget) return;

      const newStatus = col.id === "inprogressSystems" ? "inprogress" : "done";
      const newSystemId = dropTarget.dataset.systemId;
      const newGroupId = dropTarget.dataset.groupId;

      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) return;
      const taskData = taskSnap.data();

      // Cập nhật trạng thái, tiến độ và system/group mới
      const updatePayload = {
        status: newStatus,
        systemId: newSystemId,
        groupId: newGroupId,
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
      await logAction(taskData.projectId, logMessage, newGroupId, newSystemId);
    });
  });
}

// ===== Listener cho các nút chức năng chính =====
function setupGroupListeners(projectId) {
  const addGroupBtn = document.getElementById("addGroupBtn");
  if (addGroupBtn) {
    addGroupBtn.addEventListener("click", () => addGroup(projectId));
  }
}
