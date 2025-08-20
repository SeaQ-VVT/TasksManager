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

  // Thêm một mảng để lưu trữ các ID tài liệu đã thấy
  let seenDocIds = new Set();
  let firstLoad = true;

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

    // === Đây là phần thay đổi để không thông báo khi tải lần đầu ===
    // Nếu đây là lần tải đầu tiên, chỉ cập nhật danh sách đã xem và không hiển thị toast
    if (firstLoad) {
      snapshot.docs.forEach(doc => seenDocIds.add(doc.id));
      firstLoad = false;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      // Chỉ hiển thị toast cho các tài liệu mới được thêm vào và chưa từng được xem
      if (change.type === "added" && !seenDocIds.has(change.doc.id)) {
        const data = change.doc.data();
        const userDisplayName = getUserDisplayName(data.user);
        showToast(`${userDisplayName} đã ${data.action}.`);
        seenDocIds.add(change.doc.id); // Thêm ID mới vào danh sách đã xem
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

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-teal-200">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-bold text-red-600">To Do</h3>
          <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
            + Group
          </button>
        </div>
        <div id="groupContainer" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-blue-200">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-green-400">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
    </div>

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

    // Cập nhật biểu đồ tiến độ nhóm
    const groupProgressBar = document.getElementById(`group-progress-bar-${groupId}`);
    const groupProgressValue = document.getElementById(`group-progress-value-${groupId}`);
    if (groupProgressBar && groupProgressValue) {
      groupProgressBar.style.width = `${groupProgress}%`;
      groupProgressValue.textContent = `${groupProgress}%`;
    }

    // Duyệt qua các thay đổi để cập nhật giao diện
    snapshot.docChanges().forEach((change) => {
      const docSnap = change.doc;
      const tid = docSnap.id;
      const oldElement = document.getElementById(`task-${tid}`);
      if (oldElement) oldElement.remove();

      // Chỉ thêm các task có status là "todo", còn lại sẽ được hiển thị ở cột khác
      if (change.type !== "removed" && docSnap.data().status === "todo") {
        renderTask(docSnap);
      }
    });

    // Cập nhật các cột inprogress và done
    const inprogressCol = document.getElementById(`inprogress-${groupId}`);
    const doneCol = document.getElementById(`done-${groupId}`);
    if (inprogressCol) inprogressCol.innerHTML = "";
    if (doneCol) doneCol.innerHTML = "";

    tasks.forEach(t => {
      if (t.status === "inprogress") {
        renderTaskInColumn(t, inprogressCol, false);
      } else if (t.status === "done") {
        renderTaskInColumn(t, doneCol, false);
      }
    });
  });
}

function renderTask(docSnap) {
  const task = docSnap.data();
  const tid = docSnap.id;
  const el = document.createElement("div");
  el.id = `task-${tid}`;
  el.className = "bg-white p-2 border rounded-md shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200";
  el.draggable = true;
  el.setAttribute("data-task-id", tid);
  el.innerHTML = `
    <div class="flex justify-between items-center mb-1">
      <span class="font-medium text-gray-800">${task.title}</span>
      <span class="text-xs font-semibold text-gray-500">
        ${task.progress}%
      </span>
    </div>
    <div class="w-full bg-gray-200 rounded-full h-1">
      <div class="bg-blue-500 h-1 rounded-full transition-all duration-300" style="width: ${task.progress}%;"></div>
    </div>
    <div class="flex items-center mt-2 space-x-2 text-gray-500 text-sm">
      <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa task">✏️</button>
      <button class="delete-task text-red-600 hover:text-red-700" title="Xóa task">🗑️</button>
    </div>
  `;
  document.getElementById(`tasks-${task.groupId}`).appendChild(el);

  // Thêm sự kiện cho nút sửa và xóa task
  el.querySelector(".edit-task").addEventListener("click", (e) => {
    e.stopPropagation();
    editTask(tid, task);
  });
  el.querySelector(".delete-task").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTask(tid, task);
  });
}

function renderTaskInColumn(task, container, isNew) {
  if (!container) return;
  const el = document.createElement("div");
  el.id = `task-${task.id}`;
  el.className = "bg-white p-2 border rounded-md shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200";
  el.draggable = true;
  el.setAttribute("data-task-id", task.id);
  el.innerHTML = `
    <div class="flex justify-between items-center mb-1">
      <span class="font-medium text-gray-800">${task.title}</span>
      <span class="text-xs font-semibold text-gray-500">
        ${task.progress}%
      </span>
    </div>
    <div class="w-full bg-gray-200 rounded-full h-1">
      <div class="bg-blue-500 h-1 rounded-full transition-all duration-300" style="width: ${task.progress}%;"></div>
    </div>
    <div class="flex items-center mt-2 space-x-2 text-gray-500 text-sm">
      <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa task">✏️</button>
      <button class="delete-task text-red-600 hover:text-red-700" title="Xóa task">🗑️</button>
    </div>
  `;
  container.appendChild(el);

  // Thêm sự kiện cho nút sửa và xóa task
  el.querySelector(".edit-task").addEventListener("click", (e) => {
    e.stopPropagation();
    editTask(task.id, task);
  });
  el.querySelector(".delete-task").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTask(task.id, task);
  });
}


// ===== CRUD Operations =====
async function addGroup(projectId) {
  // Đảm bảo người dùng đã xác thực trước khi thực hiện
  if (!isAuthReady) return showToast("Vui lòng đợi hệ thống xác thực.");

  openModal("Thêm Group", [
    { id: "title", placeholder: "Tên Group" }
  ], async (values) => {
    try {
      if (!values.title) {
        showToast("Tên group không được để trống!");
        return;
      }
      const newDoc = await addDoc(collection(db, "groups"), {
        title: values.title,
        projectId: projectId,
        createdAt: serverTimestamp()
      });
      console.log("Group added with ID: ", newDoc.id);
      await logAction(projectId, `thêm group "${values.title}"`);
    } catch (e) {
      console.error("Error adding group: ", e);
      showToast("Lỗi khi thêm group.");
    }
  });
}

async function editGroup(gid, currentData) {
  // Đảm bảo người dùng đã xác thực trước khi thực hiện
  if (!isAuthReady) return showToast("Vui lòng đợi hệ thống xác thực.");

  openModal("Sửa Group", [
    { id: "title", placeholder: "Tên Group", value: currentData.title },
    { id: "deadline", type: "date", label: "Hạn chót", value: currentData.deadline }
  ], async (values) => {
    try {
      const groupRef = doc(db, "groups", gid);
      const updatePayload = {
        title: values.title,
        deadline: values.deadline || deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      };

      await updateDoc(groupRef, updatePayload);
      console.log("Group updated!");
      await logAction(currentData.projectId, `cập nhật group "${currentData.title}"`);
      showToast("Đã cập nhật group thành công.");
    } catch (e) {
      console.error("Error updating group: ", e);
      showToast("Lỗi khi cập nhật group.");
    }
  });
}

async function deleteGroup(gid, groupData) {
  // Đảm bảo người dùng đã xác thực trước khi thực hiện
  if (!isAuthReady) return showToast("Vui lòng đợi hệ thống xác thực.");
  if (!window.confirm(`Bạn có chắc muốn xóa group "${groupData.title}" và toàn bộ task con của nó?`)) return;

  try {
    // Xóa tất cả các task con trước
    const tasksQuery = query(collection(db, "tasks"), where("groupId", "==", gid));
    const taskDocs = await getDocs(tasksQuery);
    const deletePromises = taskDocs.docs.map(d => deleteDoc(doc(db, "tasks", d.id)));
    await Promise.all(deletePromises);

    // Sau đó xóa group
    await deleteDoc(doc(db, "groups", gid));
    console.log("Group and its tasks deleted!");
    await logAction(groupData.projectId, `xóa group "${groupData.title}"`);
    showToast("Đã xóa group thành công.");
  } catch (e) {
    console.error("Error deleting group: ", e);
    showToast("Lỗi khi xóa group.");
  }
}

async function openTaskModal(groupId, projectId, tid = null, currentData = {}) {
  // Đảm bảo người dùng đã xác thực trước khi thực hiện
  if (!isAuthReady) return showToast("Vui lòng đợi hệ thống xác thực.");

  const isEditing = tid !== null;
  const modalTitle = isEditing ? "Sửa Task" : "Thêm Task";

  openModal(modalTitle, [
    { id: "title", placeholder: "Tên Task", value: currentData.title || "" },
    { id: "description", type: "textarea", placeholder: "Mô tả", value: currentData.description || "" },
    { id: "progress", type: "range", value: currentData.progress || 0 },
  ], async (values) => {
    try {
      if (!values.title) {
        showToast("Tên task không được để trống!");
        return;
      }
      const taskPayload = {
        title: values.title,
        description: values.description,
        progress: parseInt(values.progress, 10),
        groupId,
        projectId,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      };
      if (isEditing) {
        const taskRef = doc(db, "tasks", tid);
        await updateDoc(taskRef, taskPayload);
        console.log("Task updated!");
        await logAction(projectId, `cập nhật task "${values.title}"`, groupId);
        showToast("Đã cập nhật task thành công.");
      } else {
        const newDoc = await addDoc(collection(db, "tasks"), {
          ...taskPayload,
          status: "todo",
          createdAt: serverTimestamp()
        });
        console.log("Task added with ID: ", newDoc.id);
        await logAction(projectId, `thêm task "${values.title}"`, groupId);
        showToast("Đã thêm task thành công.");
      }
    } catch (e) {
      console.error("Error saving task: ", e);
      showToast("Lỗi khi lưu task.");
    }
  });
}

function editTask(tid, taskData) {
  openTaskModal(taskData.groupId, taskData.projectId, tid, taskData);
}

async function deleteTask(tid, taskData) {
  // Đảm bảo người dùng đã xác thực trước khi thực hiện
  if (!isAuthReady) return showToast("Vui lòng đợi hệ thống xác thực.");
  if (!window.confirm(`Bạn có chắc muốn xóa task "${taskData.title}"?`)) return;

  try {
    await deleteDoc(doc(db, "tasks", tid));
    console.log("Task deleted!");
    await logAction(taskData.projectId, `xóa task "${taskData.title}"`, taskData.groupId);
    showToast("Đã xóa task thành công.");
  } catch (e) {
    console.error("Error deleting task: ", e);
    showToast("Lỗi khi xóa task.");
  }
}

// ===== Thiết lập kéo thả (Drag and Drop) =====
function setupDragDrop() {
  let draggedTask = null;

  document.addEventListener("dragstart", (e) => {
    if (e.target.matches("[draggable='true']")) {
      draggedTask = e.target;
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("taskId", draggedTask.getAttribute("data-task-id"));
    }
  });

  document.querySelectorAll("#inprogressCol, #doneCol").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("border-dashed", "border-2", "border-blue-500");
    });

    col.addEventListener("dragleave", (e) => {
      e.preventDefault();
      col.classList.remove("border-dashed", "border-2", "border-blue-500");
    });

    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("border-dashed", "border-2", "border-blue-500");

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const colId = col.id;
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


// ===== Thiết lập Listener cho Group (để xử lý xóa group) =====
let groupListeners = new Map();

function setupGroupListeners(projectId) {
  // Hủy tất cả listener cũ trước khi tạo listener mới
  groupListeners.forEach(unsub => unsub());
  groupListeners.clear();

  const groupsCol = collection(db, "groups");
  const q = query(groupsCol, where("projectId", "==", projectId));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const gid = change.doc.id;
      if (change.type === "removed") {
        // Xóa các phần tử UI của group đã bị xóa
        document.getElementById(`group-${gid}`)?.remove();
        document.getElementById(`inprogress-${gid}`)?.parentElement.remove();
        document.getElementById(`done-${gid}`)?.parentElement.remove();
        // Hủy listener task của group đó
        if (groupListeners.has(gid)) {
          groupListeners.get(gid)();
          groupListeners.delete(gid);
        }
      }
    });
  });
}

// Hàm khởi tạo ban đầu, được gọi từ main.js
export function initTasksModule() {
  document.addEventListener("DOMContentLoaded", () => {
    // Không làm gì ở đây, logic chính được gọi qua showTaskBoard
  });
}

initTasksModule();
