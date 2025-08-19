// ===== Firebase SDKs =====
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  getDocs,
  deleteField,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { showTaskBoard } from "./tasks.js";

// Debug log để kiểm tra file đã được tải
console.log("addproject.js loaded OK");

// ===== Cấu hình Firebase =====
// Sử dụng biến toàn cục được cung cấp bởi môi trường Canvas
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// ===== Khởi tạo Firebase =====
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Lỗi khi khởi tạo Firebase:", error);
}

// ===== Các phần tử DOM =====
const projectArea = document.getElementById("projectArea");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModal = document.getElementById("projectModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
const projectStartInput = document.getElementById("projectStartDate");
const projectEndInput = document.getElementById("projectEndDate");
const projectCommentInput = document.getElementById("projectComment");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

// Khởi tạo các phần tử modal sao chép nếu chúng chưa tồn tại
let copyModal = null;
let newProjectTitleInput = null;
let confirmCopyBtn = null;
let cancelCopyBtn = null;

function ensureCopyModal() {
  if (copyModal) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="copyModal" class="hidden fixed inset-0 z-50 items-center justify-center bg-black bg-opacity-40">
      <div class="bg-white w-full max-w-md mx-4 rounded-lg shadow-lg p-5">
        <h3 class="text-lg font-semibold mb-3">Sao chép dự án</h3>
        <label class="block text-sm text-gray-600 mb-1">Tên dự án mới</label>
        <input id="newProjectTitle" class="w-full border rounded px-3 py-2 mb-4" placeholder="Nhập tên dự án mới" />
        <div class="flex justify-end gap-2">
          <button id="cancelCopyBtn" class="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Hủy</button>
          <button id="confirmCopyBtn" class="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white">Sao chép</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  copyModal = document.getElementById("copyModal");
  newProjectTitleInput = document.getElementById("newProjectTitle");
  confirmCopyBtn = document.getElementById("confirmCopyBtn");
  cancelCopyBtn = document.getElementById("cancelCopyBtn");

  if (cancelCopyBtn) {
    cancelCopyBtn.addEventListener("click", () => hideModal("copyModal"));
  }
}

// ===== State =====
let isEditing = false;
let currentProjectId = null;
let openedProjectId = null;

// ===== Hàm tiện ích =====
function showModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove("hidden");
    el.classList.add("flex");
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function displayName(email) {
  return email ? String(email).split("@")[0] : "Ẩn danh";
}

// ===== Cuộn đến tiêu đề dự án =====
function scrollToProjectTitle() {
  const projectTitle = document.querySelector("#taskBoard h2");
  if (projectTitle) {
    projectTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ===== Cập nhật đếm ngược và màu sắc thẻ dự án =====
function updateCountdownAndColor(projectCard, endDate) {
  if (!endDate) {
    const countdownElement = projectCard.querySelector(".countdown");
    if (countdownElement) countdownElement.remove();
    return;
  }

  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let countdownElement = projectCard.querySelector(".countdown");
  if (!countdownElement) {
    countdownElement = document.createElement("p");
    countdownElement.className = "text-gray-800 text-3xl countdown";
    const titleElement = projectCard.querySelector("h4");
    if (titleElement) {
      projectCard.insertBefore(countdownElement, titleElement.nextSibling);
    }
  }

  if (diffMs <= 0) {
    countdownElement.textContent = "Đã đến hạn";
    projectCard.classList.remove("bg-white", "border-gray-200");
    projectCard.classList.add("bg-red-200", "border-red-400");
  } else if (diffDays <= 7) {
    countdownElement.textContent = `Còn ${diffDays} ngày`;
    projectCard.classList.remove("bg-white", "border-gray-200");
    projectCard.classList.add("bg-yellow-200", "border-yellow-400");
  } else {
    countdownElement.textContent = `Còn ${diffDays} ngày`;
    projectCard.classList.remove("bg-red-200", "border-red-400", "bg-yellow-200", "border-yellow-400");
    projectCard.classList.add("bg-white", "border-gray-200");
  }
}

// ===== Hiển thị thẻ dự án =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  const projectCard = document.createElement("div");
  projectCard.className =
    "bg-white p-6 rounded-lg shadow-md border border-gray-200 transition-transform transform hover:scale-105 mb-4";

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "-";

  projectCard.innerHTML = `
    <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
    <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
    <p class="text-gray-500 text-sm"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Ghi chú:</b> ${data.comment || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
    <p class="text-gray-500 text-sm mb-4"><b>Ngày tạo:</b> ${createdAt}</p>
    <div class="flex space-x-2 mt-2">
      <button data-id="${id}" class="view-tasks-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">👁️</button>
      <button data-id="${id}" class="copy-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm">📋</button>
      <button data-id="${id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm">✏️</button>
      <button data-id="${id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm">🗑️</button>
    </div>
  `;
  projectArea.appendChild(projectCard);

  updateCountdownAndColor(projectCard, data.endDate);
  setInterval(() => updateCountdownAndColor(projectCard, data.endDate), 60000); // Cập nhật mỗi phút
}

// ===== Lắng nghe thay đổi của các dự án trong thời gian thực =====
function setupProjectListener() {
  if (!db) return;
  const projectsCol = collection(db, "projects");
  const q = query(projectsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    projectArea.innerHTML = "";
    snapshot.forEach((doc) => {
      renderProject(doc);
    });

    // Gắn sự kiện cho các nút sau khi render
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToEdit = snapshot.docs.find((d) => d.id === id);
        if (docToEdit) editProject(id, docToEdit.data());
      });
    });
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => showDeleteConfirmation(e.currentTarget.dataset.id));
    });
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToCopy = snapshot.docs.find((d) => d.id === id);
        if (docToCopy) copyProject(id, docToCopy.data());
      });
    });
    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToView = snapshot.docs.find((d) => d.id === id);
        if (docToView) {
          const projectTitle = docToView.data().title;
          openedProjectId = id;
          console.log("Viewing tasks for project:", id);
          showTaskBoard(id, projectTitle);
          setTimeout(scrollToProjectTitle, 100);
        }
      });
    });
  });
}

// ===== Xử lý Thêm / Cập nhật dự án =====
saveProjectBtn.addEventListener("click", async () => {
  const title = projectTitleInput.value.trim();
  const description = projectDescriptionInput.value.trim();
  const startDate = projectStartInput.value;
  const endDate = projectEndInput.value;
  const comment = projectCommentInput.value.trim();

  if (!title) {
    console.error("Vui lòng nhập tên dự án.");
    return;
  }

  try {
    const user = auth.currentUser;
    const projectData = {
      title,
      description,
      startDate,
      endDate,
      comment,
      updatedAt: serverTimestamp(),
    };

    if (isEditing) {
      const projectDocRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectDocRef, projectData);
    } else {
      await addDoc(collection(db, "projects"), {
        ...projectData,
        createdAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
    }

    hideModal("projectModal");
    // Xóa form sau khi lưu
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    projectStartInput.value = "";
    projectEndInput.value = "";
    projectCommentInput.value = "";
  } catch (e) {
    console.error("Lỗi khi thêm/cập nhật dự án:", e);
  }
});

// ===== Chỉnh sửa dự án =====
function editProject(id, data) {
  isEditing = true;
  currentProjectId = id;
  projectModalTitle.textContent = "Cập nhật dự án";
  projectTitleInput.value = data.title || "";
  projectDescriptionInput.value = data.description || "";
  projectStartInput.value = data.startDate || "";
  projectEndInput.value = data.endDate || "";
  projectCommentInput.value = data.comment || "";
  showModal("projectModal");
}

// ===== Sao chép dự án =====
function copyProject(id, data) {
  ensureCopyModal();
  currentProjectId = id;
  newProjectTitleInput.value = `${data.title} (Bản sao)`;
  showModal("copyModal");
}

// Gắn sự kiện cho nút sao chép trong modal
if (confirmCopyBtn) {
  confirmCopyBtn.addEventListener("click", async () => {
    const newTitle = (newProjectTitleInput?.value || "").trim();
    if (!newTitle) {
      console.error("Vui lòng nhập tên cho dự án mới.");
      return;
    }
    confirmCopyBtn.disabled = true;

    try {
      const user = auth.currentUser;
      const srcDoc = await getDoc(doc(db, "projects", currentProjectId));
      if (!srcDoc.exists()) throw new Error("Dự án gốc không tồn tại.");
      const src = srcDoc.data() || {};

      const newProjectRef = await addDoc(collection(db, "projects"), {
        ...src,
        title: newTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      const newProjectId = newProjectRef.id;

      // Sao chép các nhóm
      const groupsQ = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
      const groupsSnap = await getDocs(groupsQ);
      const groupIdMap = new Map();
      await Promise.all(
        groupsSnap.docs.map(async (g) => {
          const gData = g.data();
          const newGRef = await addDoc(collection(db, "groups"), {
            ...gData,
            projectId: newProjectId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          groupIdMap.set(g.id, newGRef.id);
        })
      );

      // Sao chép các task
      const tasksQ = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
      const tasksSnap = await getDocs(tasksQ);
      await Promise.all(
        tasksSnap.docs.map(async (t) => {
          const tData = t.data();
          const newTaskRef = await addDoc(collection(db, "tasks"), {
            ...tData,
            projectId: newProjectId,
            groupId: tData.groupId ? groupIdMap.get(tData.groupId) || null : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        })
      );
      hideModal("copyModal");
      console.log("Đã sao chép dự án và toàn bộ dữ liệu liên quan thành công!");
    } catch (e) {
      console.error("Lỗi khi sao chép dự án:", e);
    } finally {
      confirmCopyBtn.disabled = false;
    }
  });
}

// ===== Xóa dự án và dữ liệu liên quan =====
function showDeleteConfirmation(id) {
  currentProjectId = id;
  showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
  try {
    const collectionsToDelete = ["tasks", "groups", "logs", "progress_history"];
    for (const colName of collectionsToDelete) {
      const q = query(collection(db, colName), where("projectId", "==", currentProjectId));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    }
    
    await deleteDoc(doc(db, "projects", currentProjectId));
    if (openedProjectId === currentProjectId) {
      const taskBoard = document.getElementById("taskBoard");
      if (taskBoard) taskBoard.innerHTML = "";
      openedProjectId = null;
    }
    hideModal("deleteModal");
  } catch (e) {
    console.error("Lỗi khi xóa dự án và dữ liệu liên quan:", e);
  }
});

// ===== Gắn sự kiện cho các nút =====
cancelDeleteBtn.addEventListener("click", () => hideModal("deleteModal"));
cancelProjectBtn.addEventListener("click", () => hideModal("projectModal"));
addProjectBtn.addEventListener("click", () => {
  isEditing = false;
  projectModalTitle.textContent = "Tạo dự án mới";
  projectTitleInput.value = "";
  projectDescriptionInput.value = "";
  projectStartInput.value = "";
  projectEndInput.value = "";
  projectCommentInput.value = "";
  showModal("projectModal");
});

// ===== Thêm thanh công cụ bên trái (Sidebar) =====
function setupSidebar() {
  let homeIcon = document.getElementById("homeIcon");
  if (!homeIcon) {
    homeIcon = document.createElement("button");
    homeIcon.id = "homeIcon";
    homeIcon.innerHTML = "🏠";
    homeIcon.className = "fixed top-10 left-4 z-50 text-3xl bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition";
    document.body.appendChild(homeIcon);
  }

  let sidebar = document.getElementById("projectSidebar");
  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = "projectSidebar";
    // Mặc định ẩn
    sidebar.className = "fixed top-0 left-0 h-full w-[2cm] bg-gradient-to-b from-green-900 to-black text-white shadow-lg z-40 overflow-y-auto p-4 pt-[3cm] hidden";
    sidebar.innerHTML = `
      <h3 class="text-lg font-bold mb-4 text-green-200"></h3>
      <div id="username" class="text-sm mb-2"></div>
      <div id="username" class="text-sm mb-2"></div>
      <div id="username" class="text-sm mb-2"></div>
      <div id="username" class="text-sm mb-2"></div>
      <ul id="sidebarProjectList" class="space-y-2"></ul>
    `;
    document.body.appendChild(sidebar);
  }

  // Sự kiện click để bật/tắt hiển thị sidebar
  homeIcon.addEventListener("click", () => {
    sidebar.classList.toggle("hidden");
  });

  // Lắng nghe thay đổi của các dự án để cập nhật sidebar
  const projectsCol = collection(db, "projects");
  const q = query(projectsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const sidebarList = document.getElementById("sidebarProjectList");
    sidebarList.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const id = doc.id;
      const listItem = document.createElement("li");
      listItem.className = "cursor-pointer text-green-200 hover:text-green-100 transition";
      listItem.textContent = data.title;
      listItem.addEventListener("click", () => {
        openedProjectId = id;
        showTaskBoard(id, data.title);
        sidebar.classList.add("hidden");
        setTimeout(scrollToProjectTitle, 100);
      });
      sidebarList.appendChild(listItem);
    });
  });
}

// ===== Lắng nghe trạng thái xác thực người dùng =====
auth.onAuthStateChanged((user) => {
  if (user) {
    addProjectBtn.classList.remove("hidden");
    setupProjectListener();
    setupSidebar();
  } else {
    projectArea.innerHTML = "";
    addProjectBtn.classList.add("hidden");
    const sidebar = document.getElementById("projectSidebar");
    if (sidebar) sidebar.remove();
    const homeIcon = document.getElementById("homeIcon");
    if (homeIcon) homeIcon.remove();
  }
});
