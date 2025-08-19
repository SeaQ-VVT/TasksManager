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
async function logAction(projectId, action, groupId = null) {
  if (!isAuthReady) return; // Đảm bảo người dùng đã xác thực

  const user = currentUser?.email || "Ẩn danh";
  let logMessage = action;

  // Lấy thông tin group nếu có
  if (groupId) {
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      logMessage += ` trong group "${groupData.title}"`;
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
  // Chỉ áp dụng cảnh báo cho các group có trạng thái "todo" hoặc "inprogress"
  if (g.status === "todo" || g.status === "inprogress") {
    return colorClassByDaysLeft(left);
  }
  // Loại bỏ cảnh báo cho các group đã hoàn thành
  if (g.status === "done") {
    return "";
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

  // Khung Done (áp dụng cảnh báo, nếu có)
  const doneWrapper = document.getElementById(`done-${gid}`)?.parentElement;
  if (doneWrapper) {
    removeWarnClasses(doneWrapper);
    // Logic mới: Không áp dụng màu cảnh báo nếu trạng thái là "done"
    // Dù hàm getGroupWarnClass có trả về gì đi nữa, ta vẫn không thêm màu
    // vào khung Done.
    // Nếu bạn muốn bỏ hoàn toàn, bạn có thể comment dòng dưới hoặc để trống
    // if (g.status === "done" && cls) {
    //   doneWrapper.classList.add(...cls.split(" "));
    // }
  }
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

    <!-- Cập nhật lớp Tailwind cho các cột để có cùng chiều cao và thanh cuộn -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
      <!-- Cột To Do -->
      <div class="bg-white p-3 rounded shadow flex flex-col">
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
      <div class="bg-white p-3 rounded shadow flex flex-col">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <!-- Thêm chiều cao cố định và thanh cuộn cho cột In Progress -->
        <div id="inprogressCol" class="space-y-3 mt-2 h-[30cm] overflow-y-auto"></div>
      </div>
      <!-- Cột Done -->
      <div class="bg-white p-3 rounded shadow flex flex-col">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <!-- Thêm chiều cao cố định và thanh cuộn cho cột Done -->
        <div id="doneCol" class="space-y-3 mt-2 h-[30cm] overflow-y-auto"></div>
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
// Tải các group có projectId khớp với projectId hiện tại
// Đây là logic quan trọng để đảm bảo dữ liệu không bị trộn lẫn
let groupsUnsub = null; // Biến lưu listener để có thể hủy khi đổi dự án
function loadGroups(projectId) {
  // Hủy listener cũ trước khi tạo listener mới
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
    // Xóa toàn bộ nội dung cũ để render lại từ đầu
    groupContainer.innerHTML = "";
    inprogressCol.innerHTML = "";
    doneCol.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const gid = docSnap.id;
      const g = docSnap.data();
      // Hiển thị phần "In Progress"
      const ipSection = document.createElement("div");
      ipSection.className = "border rounded p-2 bg-gray-50 shadow";
      ipSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-yellow-700">${g.title}</span>
        </div>
        <div id="inprogress-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
      `;
      inprogressCol.appendChild(ipSection);
      // Hiển thị phần "Done"
      const doneSection = document.createElement("div");
      doneSection.className = "border rounded p-2 bg-gray-50 shadow";
      doneSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-green-700">${g.title}</span>
        </div>
        <div id="done-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
      `;
      doneCol.appendChild(doneSection);
      // Hiển thị thẻ Group ở cột To Do
      renderGroup(docSnap);
      // Áp màu cảnh báo dựa trên deadline và trạng thái
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
      <span class="font-semibold text-blue-700">${g.title}${deadlineText}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600 hover:text-yellow-700" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600 hover:text-red-700" title="Xóa group">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1 hover:text-green-700">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
    <!-- Biểu đồ tiến độ nhóm (Luôn hiển thị) -->
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

  // Tải các task con của group này
  loadTasks(gid);
  // Thêm sự kiện cho các nút
  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Tải Tasks theo thời gian thực (Realtime Tasks) =====
// Tải các task có groupId khớp với groupId hiện tại
function loadTasks(groupId) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("groupId", "==", groupId));

  onSnapshot(qTasks, async (snapshot) => {
    const tasks = [];
    let totalProgress = 0;
    snapshot.forEach((d) => {
      const taskData = d.data();
      tasks.push({ id: d.id, ...taskData });
      totalProgress += taskData.progress || 0;
    });

    const groupProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;
    updateGroupProgress(groupId, groupProgress);

    const groupElement = document.getElementById(`tasks-${groupId}`);
    const inprogressCol = document.getElementById(`inprogress-${groupId}`);
    const doneCol = document.getElementById(`done-${groupId}`);

    // Xóa nội dung cũ
    if (groupElement) groupElement.innerHTML = "";
    if (inprogressCol) inprogressCol.innerHTML = "";
    if (doneCol) doneCol.innerHTML = "";
    
    tasks.sort((a,b) => (a.order || 0) - (b.order || 0));

    tasks.forEach((t) => {
      if (t.status === "todo") {
        renderTask(t, `tasks-${groupId}`);
      } else if (t.status === "inprogress") {
        renderTask(t, `inprogress-${groupId}`);
      } else if (t.status === "done") {
        renderTask(t, `done-${groupId}`);
      }
    });
  });
}

function updateGroupProgress(groupId, progress) {
  const progressBar = document.getElementById(`group-progress-bar-${groupId}`);
  const progressValue = document.getElementById(`group-progress-value-${groupId}`);
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    if (progressValue) {
      progressValue.textContent = `${progress}%`;
    }
  }
}

// ===== Render Task =====
function renderTask(taskData, containerId) {
  const taskEl = document.createElement("div");
  taskEl.id = `task-${taskData.id}`;
  taskEl.className = "bg-white p-2 rounded shadow-sm hover:shadow-md transition-shadow cursor-grab text-sm";
  taskEl.setAttribute("draggable", true);

  // Thêm màu cảnh báo cho task
  let warnClass = "";
  if (taskData.deadline && taskData.status !== "done") {
      const daysLeft = daysUntil(taskData.deadline);
      warnClass = colorClassByDaysLeft(daysLeft);
  }
  taskEl.classList.add(warnClass);

  const deadlineText = taskData.deadline ? `<span class="text-xs text-gray-500 ml-1">⏰ ${formatDateVN(taskData.deadline)}</span>` : "";

  taskEl.innerHTML = `
    <div class="flex justify-between items-start">
      <span class="font-semibold text-gray-800">${taskData.title}</span>
      <div class="flex items-center space-x-1">
        <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa task">✏️</button>
        <button class="delete-task text-red-600 hover:text-red-700" title="Xóa task">🗑️</button>
      </div>
    </div>
    <p class="text-xs text-gray-600 mt-1">${taskData.description || ""}</p>
    <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
      <span>Đã tạo bởi: ${getUserDisplayName(taskData.createdBy)}</span>
      <span class="flex items-center">
        ${deadlineText}
        <span class="ml-2 font-bold text-blue-500">${taskData.progress || 0}%</span>
      </span>
    </div>
  `;
  document.getElementById(containerId).appendChild(taskEl);

  // Thêm sự kiện cho các nút của task
  taskEl.querySelector(".edit-task").addEventListener("click", () => editTask(taskData));
  taskEl.querySelector(".delete-task").addEventListener("click", () => deleteTask(taskData));

  // Thêm sự kiện kéo và thả cho task
  taskEl.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", taskData.id);
  });
}


// ===== CRUD cho Task (Tạo, Sửa, Xóa) =====
function openTaskModal(groupId, projectId) {
  const title = "Tạo Task Mới";
  const fields = [
    { id: "title", placeholder: "Tên task", type: "text" },
    { id: "description", placeholder: "Mô tả", type: "textarea" },
    { id: "deadline", label: "Hạn chót", type: "date" },
    { id: "progress", value: 0, type: "range" }
  ];
  const onSave = async (values) => {
    if (!values.title) return showToast("Tên task không được để trống!");
    const newTask = {
      projectId,
      groupId,
      title: values.title,
      description: values.description,
      deadline: values.deadline,
      progress: parseInt(values.progress),
      status: "todo",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh",
      updatedBy: currentUser?.email || "Ẩn danh"
    };
    await addDoc(collection(db, "tasks"), newTask);
    await logAction(projectId, `tạo task "${values.title}"`, groupId);
  };
  openModal(title, fields, onSave);
}

function editTask(taskData) {
  const title = "Sửa Task";
  const fields = [
    { id: "title", placeholder: "Tên task", type: "text", value: taskData.title },
    { id: "description", placeholder: "Mô tả", type: "textarea", value: taskData.description },
    { id: "deadline", label: "Hạn chót", type: "date", value: taskData.deadline },
    { id: "progress", value: taskData.progress || 0, type: "range" }
  ];
  const onSave = async (values) => {
    if (!values.title) return showToast("Tên task không được để trống!");
    const updatedTask = {
      title: values.title,
      description: values.description,
      deadline: values.deadline,
      progress: parseInt(values.progress),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    };
    await updateDoc(doc(db, "tasks", taskData.id), updatedTask);
    await logAction(taskData.projectId, `cập nhật task "${taskData.title}"`, taskData.groupId);
  };
  openModal(title, fields, onSave);
}

async function deleteTask(taskData) {
  if (confirm(`Bạn có chắc muốn xóa task "${taskData.title}" không?`)) {
    await deleteDoc(doc(db, "tasks", taskData.id));
    await logAction(taskData.projectId, `xóa task "${taskData.title}"`, taskData.groupId);
    showToast(`Đã xóa task "${taskData.title}".`);
  }
}

// ===== CRUD cho Group (Tạo, Sửa, Xóa) =====
function setupGroupListeners(projectId) {
  document.getElementById("addGroupBtn").addEventListener("click", () => {
    const title = "Tạo Group Mới";
    const fields = [
      { id: "title", placeholder: "Tên group", type: "text" },
      { id: "deadline", label: "Hạn chót", type: "date" }
    ];
    const onSave = async (values) => {
      if (!values.title) return showToast("Tên group không được để trống!");
      const newGroup = {
        projectId,
        title: values.title,
        deadline: values.deadline,
        status: "todo",
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "groups"), newGroup);
      await logAction(projectId, `tạo group "${values.title}"`);
    };
    openModal(title, fields, onSave);
  });
}

function editGroup(groupId, groupData) {
  const title = "Sửa Group";
  const fields = [
    { id: "title", placeholder: "Tên group", type: "text", value: groupData.title },
    { id: "deadline", label: "Hạn chót", type: "date", value: groupData.deadline }
  ];
  const onSave = async (values) => {
    if (!values.title) return showToast("Tên group không được để trống!");
    const updatedGroup = {
      title: values.title,
      deadline: values.deadline || deleteField()
    };
    await updateDoc(doc(db, "groups", groupId), updatedGroup);
    await logAction(groupData.projectId, `cập nhật group "${groupData.title}"`);
  };
  openModal(title, fields, onSave);
}

async function deleteGroup(groupId, groupData) {
  if (confirm(`Bạn có chắc muốn xóa group "${groupData.title}" không? TẤT CẢ các task trong group này cũng sẽ bị xóa.`)) {
    // Xóa tất cả các task con trước
    const tasksQuery = query(collection(db, "tasks"), where("groupId", "==", groupId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const deletePromises = tasksSnapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // Sau đó xóa group
    await deleteDoc(doc(db, "groups", groupId));
    await logAction(groupData.projectId, `xóa group "${groupData.title}"`);
    showToast(`Đã xóa group "${groupData.title}" và tất cả các task của nó.`);
  }
}

// ===== Logic Kéo và Thả (Drag and Drop) =====
function setupDragDrop() {
  const cols = ["inprogressCol", "doneCol"];
  cols.forEach(colId => {
    const colEl = document.getElementById(colId);
    colEl.addEventListener("dragover", (e) => e.preventDefault());
    colEl.addEventListener("drop", async (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const newStatus = colId === "inprogressCol" ? "inprogress" : "done";

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
}

