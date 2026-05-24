import { createAppHeader, createToast, escapeHTML, formatDate, getStatusClass, getStatusLabel, renderReportCard, updateNavLinks, createCustomSelects } from "./ui.js";
import { isAdminProfile, loginWithEmail, logoutUser, observeAuth, registerWithEmail } from "./auth.js";
import { createReport, getReportById, getReports, getReportsByUser, updateReportStatus } from "./reports.js";
import { uploadReportImage } from "./storage.js";

const page = document.body.dataset.page || "home";
const appRoot = document.getElementById("app");
const SESSION_KEY = "campusfix_session";

// Local storage helpers for role persistence
function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch (e) {
    return null;
  }
}

function setStoredRole(isAdmin, userLabel, user = null) {
  try {
    const current = getStoredSession();
    const session = {
      uid: user?.uid || current?.uid || "",
      email: user?.email || current?.email || "",
      name: userLabel || current?.name || "",
      role: isAdmin ? "admin" : "user",
      isAdmin,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    // ignore storage errors
  }
}

function clearStoredRole() {
  try {
    // Clear legacy keys too in case older versions left them behind.
    localStorage.removeItem("campusfix_isAdmin");
    localStorage.removeItem("campusfix_userLabel");
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

function syncRoleAndNav(activePage, user, profile) {
  const userLabel = profile?.name || user?.email || "";
  const admin = isAdminProfile(profile);

  setStoredRole(admin, userLabel, user);
  updateNavLinks(buildNavLinks(activePage, admin), userLabel);

  return admin;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  const serviceWorkerUrl = new URL("../service-worker.js", window.location.href).href;

  navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.error("No se pudo registrar el Service Worker", error);
    });
}

function redirectToLogin() {
  window.location.href = "./login.html";
}

function setShellMarkup({ title, subtitle }) {
  if (!appRoot) {
    return;
  }

  // Render header without links initially; links are populated after auth state resolves
  appRoot.innerHTML = `
    ${createAppHeader({ title, subtitle, links: [], userLabel: "" })}
    <section class="panel">
      <div data-page-content></div>
    </section>
  `;

  // Replace native selects inside the new content area with custom widgets
  const contentNode = getContentNode();
  if (contentNode) createCustomSelects(contentNode);
}

function getContentNode() {
  return document.querySelector("[data-page-content]");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function buildNavLinks(activePage, isAdmin) {
  if (isAdmin) {
    return [
      { label: "Dashboard", href: "./dashboard.html", active: activePage === "dashboard" },
      { label: "Admin", href: "./admin.html", active: activePage === "admin" },
    ];
  }

  return [
    { label: "Dashboard", href: "./dashboard.html", active: activePage === "dashboard" },
    { label: "Nuevo reporte", href: "./new-report.html", active: activePage === "new-report" },
    { label: "Reportes", href: "./reports.html", active: activePage === "reports" }
  ];
}

function buildDashboardActions(isAdmin) {
  if (isAdmin) {
    return `
      <a class="button button-secondary" href="./admin.html">Abrir panel de admin</a>
      <button id="logoutButton" class="button button-secondary" type="button">Cerrar sesión</button>
    `;
  }

  return `
    <a class="button button-primary" href="./new-report.html">Crear reporte</a>
    <a class="button button-secondary" href="./reports.html">Ver reportes</a>
    <button id="logoutButton" class="button button-secondary" type="button">Cerrar sesión</button>
  `;
}

function getAuthErrorMessage(error, action) {
  const code = error?.code || "";

  const messages = {
    "auth/configuration-not-found": "Firebase Authentication no está habilitado en el proyecto.",
    "auth/operation-not-allowed": "Activa el método Email/Password en Authentication.",
    "auth/unauthorized-domain": "Agrega localhost en Authorized domains.",
    "auth/invalid-api-key": "La configuración de Firebase es inválida.",
    "auth/invalid-email": "El correo tiene un formato inválido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/email-already-in-use": "Ese correo ya está registrado. Inicia sesión.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/invalid-credential": "Las credenciales no son válidas."
  };

  if (messages[code]) {
    return messages[code];
  }

  return action === "register"
    ? "No fue posible crear la cuenta. Revisa Auth, el dominio autorizado y los datos ingresados."
    : "No fue posible iniciar sesión. Revisa Auth, el dominio autorizado y tus credenciales.";
}

function isPermissionError(error) {
  const message = (error?.message || "").toLowerCase();
  return error?.code === "permission-denied" || message.includes("missing or insufficient permissions");
}

function getFirestoreErrorMessage(error) {
  if (isPermissionError(error)) {
    return "Firestore rechazó una consulta o escritura. Revisa las reglas publicadas.";
  }

  return "Ocurrió un error con Firestore.";
}

function bootstrapHome() {
  registerServiceWorker();

  observeAuth((user) => {
    if (user) {
      window.location.href = "./pages/dashboard.html";
    }
  });
}

function bootstrapLogin() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Acceso a reportes y panel técnico"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  content.innerHTML = `
    <section class="auth-card">
      <p class="eyebrow">Iniciar sesión</p>
      <h2>Accede para crear y seguir reportes</h2>
      <p class="subtitle">Usa tu correo institucional para registrar el historial de reportes por usuario.</p>
      <form id="loginForm" class="form-grid">
        <div class="field full">
          <label for="email">Correo electrónico</label>
          <input type="email" id="email" required placeholder="usuario@uaq.edu.mx" />
        </div>
        <div class="field full">
          <label for="password">Contraseña</label>
          <input type="password" id="password" required placeholder="Tu contraseña" />
        </div>
        <div class="field full">
          <button type="submit" class="button button-primary">Entrar</button>
        </div>
      </form>
      <div class="auth-switch">
        <p class="auth-switch-title">¿No tienes cuenta?</p>
        <a class="auth-switch-link" href="./register.html">Regístrate aquí</a>
      </div>
      <div id="loginFeedback" class="feedback hidden"></div>
    </section>
  `;

  const form = document.getElementById("loginForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const feedback = document.getElementById("loginFeedback");

    try {
      if (feedback) {
        feedback.classList.remove("hidden");
        feedback.textContent = "Validando credenciales...";
      }

      await loginWithEmail(email, password);
      createToast("Sesión iniciada correctamente", "success");
      window.location.href = "./dashboard.html";
    } catch (error) {
      console.error(error);
      if (feedback) {
        feedback.classList.remove("hidden");
        feedback.textContent = getAuthErrorMessage(error, "login");
      }
      createToast(getAuthErrorMessage(error, "login"), "error");
    }
  });
}

function bootstrapRegister() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Crear cuenta"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  content.innerHTML = `
    <section class="auth-card">
      <p class="eyebrow">Registro</p>
      <h2>Crea tu usuario para reportar fallas</h2>
      <p class="subtitle">Con una cuenta podrás guardar tus tickets y dar seguimiento a cada reporte.</p>
      <form id="registerForm" class="form-grid">
        <div class="field full">
          <label for="name">Nombre completo</label>
          <input type="text" id="name" required placeholder="Tu nombre" />
        </div>
        <div class="field full">
          <label for="email">Correo electrónico</label>
          <input type="email" id="email" required placeholder="usuario@uaq.edu.mx" />
        </div>
        <div class="field full">
          <label for="password">Contraseña</label>
          <input type="password" id="password" minlength="6" required placeholder="Mínimo 6 caracteres" />
        </div>
        <div class="field full">
          <label for="confirmPassword">Confirmar contraseña</label>
          <input type="password" id="confirmPassword" minlength="6" required placeholder="Repite tu contraseña" />
        </div>
        <div class="field full">
          <button type="submit" class="button button-primary">Crear cuenta</button>
        </div>
      </form>
      <div class="auth-switch">
        <p class="auth-switch-title">¿Ya tienes cuenta?</p>
        <a class="auth-switch-link" href="./login.html">Inicia sesión aquí</a>
      </div>
      <div id="registerFeedback" class="feedback hidden"></div>
    </section>
  `;

  const form = document.getElementById("registerForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const feedback = document.getElementById("registerFeedback");

    if (password !== confirmPassword) {
      if (feedback) {
        feedback.classList.remove("hidden");
        feedback.textContent = "Las contraseñas no coinciden.";
      }
      createToast("Las contraseñas no coinciden", "error");
      return;
    }

    try {
      if (feedback) {
        feedback.classList.remove("hidden");
        feedback.textContent = "Creando cuenta...";
      }

      await registerWithEmail(email, password, name);

      createToast("Cuenta creada correctamente", "success");
      window.location.href = "./dashboard.html";
    } catch (error) {
      console.error(error);
      if (feedback) {
        feedback.classList.remove("hidden");
        feedback.textContent = getAuthErrorMessage(error, "register");
      }
      createToast(getAuthErrorMessage(error, "register"), "error");
    }
  });
}

function bootstrapDashboard() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Panel principal"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  observeAuth(async (user, profile) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    const admin = syncRoleAndNav("dashboard", user, profile);

    let myReports = [];
    let allReports = [];
    let firestoreError = null;

    try {
      [myReports, allReports] = await Promise.all([
        getReportsByUser(user.uid),
        getReports()
      ]);
    } catch (error) {
      firestoreError = error;
      console.warn("No se pudieron cargar los reportes:", error);
    }

    const pending = allReports.filter((report) => report.status === "Pendiente").length;
    const resolved = allReports.filter((report) => report.status === "Resuelto").length;

    content.innerHTML = `
      <section class="dashboard-section">
        <p class="eyebrow">Bienvenido</p>
        <h2>${escapeHTML(profile?.name || user.email || "Usuario")}</h2>
        <p class="subtitle">${escapeHTML(admin ? "Tienes acceso al panel administrativo." : "Aquí puedes crear reportes y consultar su avance.")}</p>
      </section>
      ${firestoreError ? `<section class="dashboard-section"><div class="empty-state">${escapeHTML(getFirestoreErrorMessage(firestoreError))}</div></section>` : ""}
      <section class="stats-grid dashboard-section">
        <article class="metric-card"><div class="metric-value">${allReports.length}</div><div class="metric-label">Reportes totales</div></article>
        <article class="metric-card"><div class="metric-value">${pending}</div><div class="metric-label">Pendientes</div></article>
        <article class="metric-card"><div class="metric-value">${resolved}</div><div class="metric-label">Resueltos</div></article>
        <article class="metric-card"><div class="metric-value">${myReports.length}</div><div class="metric-label">Mis reportes</div></article>
      </section>
      <section class="dashboard-section">
        <div class="toolbar">
          ${buildDashboardActions(admin)}
        </div>
      </section>
      <section class="dashboard-section">
        <h3>Últimos reportes</h3>
        <div id="recentReports" class="report-list"></div>
      </section>
    `;

    const recentContainer = document.getElementById("recentReports");
    if (recentContainer) {
      const recentReports = allReports.slice(0, 3);
      recentContainer.innerHTML = recentReports.length
        ? recentReports.map((report) => renderReportCard(report)).join("")
        : '<div class="empty-state">Aún no hay reportes registrados.</div>';
    }

    document.getElementById("logoutButton")?.addEventListener("click", async () => {
      await logoutUser();
      clearStoredRole();
      window.location.href = "../index.html";
    });
  });
}

function bootstrapNewReport() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Crear reporte"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  observeAuth((user, profile) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    syncRoleAndNav("new-report", user, profile);

    content.innerHTML = `
      <section class="form-section">
        <p class="eyebrow">Nuevo ticket</p>
        <h2>Registrar una falla técnica</h2>
        <p class="subtitle">La imagen se sube a Firebase Storage y el ticket se guarda en Firestore.</p>
        <form id="reportForm" class="form-grid">
          <div class="field full">
            <label for="title">Título del problema</label>
            <input type="text" id="title" required placeholder="Ej. Proyector no funciona" />
          </div>
          <div class="field">
            <label for="category">Categoría</label>
            <select id="category" required>
              <option value="">Selecciona una categoría</option>
              <option>Internet</option>
              <option>Computadora</option>
              <option>Proyector</option>
              <option>Electricidad</option>
              <option>Mobiliario</option>
              <option>Baño</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="field">
            <label for="priority">Prioridad</label>
            <select id="priority" required>
              <option value="">Selecciona prioridad</option>
              <option>Baja</option>
              <option>Media</option>
              <option>Alta</option>
            </select>
          </div>
          <div class="field">
            <label for="building">Edificio</label>
            <select id="building" required>
              <option value="">Selecciona un edificio</option>
              <option>Edificio A</option>
              <option>Edificio de innovación</option>
              <option>Laboratorios</option>
              <option>Biblioteca</option>
            </select>
          </div>
          <div class="field">
            <label for="locationType">Tipo de ubicación</label>
            <select id="locationType" required>
              <option value="">Selecciona una opción</option>
              <option>Salón</option>
              <option>Baño</option>
              <option>Pasillo</option>
              <option>Oficina</option>
            </select>
          </div>
          <div class="field" id="roomField" style="display:none">
            <label for="roomSelect">Salón</label>
            <select id="roomSelect">
              <option value="">Selecciona un salón</option>
            </select>
          </div>
          <!-- Campo de descripción eliminado: usamos solo el Salón cuando aplica -->
          <div class="field full">
            <label for="description">Descripción del problema</label>
            <textarea id="description" required placeholder="Describe el problema con detalle"></textarea>
          </div>
          <div class="field full">
            <label for="image">Foto del problema</label>
            <input type="file" id="image" accept="image/*" />
          </div>
          <div class="field full">
            <button type="submit" class="button button-primary">Enviar reporte</button>
          </div>
        </form>
        <div id="reportFeedback" class="feedback hidden"></div>
      </section>
    `;

    const form = document.getElementById("reportForm");
    const buildingSelect = document.getElementById("building");
    const locationTypeSelect = document.getElementById("locationType");
    const roomField = document.getElementById("roomField");
    const roomSelect = document.getElementById("roomSelect");

    function getRoomsFor(building) {
      if (!building) return [];
      if (building === "Edificio A") {
        const rooms = [];
        for (let i = 1; i <= 26; i++) {
          rooms.push(`A${String(i).padStart(2, "0")}`);
        }
        return rooms;
      }

      if (building === "Laboratorios") {
        const labs = [];
        for (let i = 1; i <= 9; i++) {
          labs.push(`D0${i}`);
        }
        return labs.concat([
          "Laboratorio de cómputo paralelo",
          "Laboratorio de electrónica",
          "Laboratorio de redes 1",
          "Laboratorio de redes 2"
        ]);
      }

      if (building === "Edificio de innovación") {
        return [
          "Salón de Ingeniería de Software",
          "Ingeniería en Sistemas Computacionales",
          "Ingeniería en Telecomunicaciones y Redes",
          "Licenciatura en Administración de las Tecnologías de la Información"
        ];
      }

      if (building === "Biblioteca") {
        return ["B01", "B02", "B03"];
      }

      return [];
    }

    function populateRooms(building) {
      const rooms = getRoomsFor(building);
      roomSelect.innerHTML = '<option value="">Selecciona un salón</option>' + rooms.map(r => `<option value="${r}">${r}</option>`).join("");
    }

    function updateRoomVisibility() {
      if (locationTypeSelect.value === "Salón") {
        roomField.style.display = "block";
        populateRooms(buildingSelect.value);
      } else {
        roomField.style.display = "none";
      }
    }

    buildingSelect?.addEventListener("change", () => {
      if (locationTypeSelect.value === "Salón") {
        populateRooms(buildingSelect.value);
      }
    });

    locationTypeSelect?.addEventListener("change", updateRoomVisibility);

    // roomSelect cambia -> no copiamos a otro input (ya no existe)

    updateRoomVisibility();

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const feedback = document.getElementById("reportFeedback");
      const imageFile = document.getElementById("image").files[0];

      // Si el tipo de ubicación es Salón, exigir selección de salón
      if (locationTypeSelect.value === "Salón") {
        if (!roomSelect.value) {
          if (feedback) {
            feedback.classList.remove("hidden");
            feedback.textContent = "Por favor selecciona un salón.";
          }
          createToast("Selecciona un salón antes de enviar.", "error");
          return;
        }
      }

      try {
        if (feedback) {
          feedback.classList.remove("hidden");
          feedback.textContent = "Subiendo reporte...";
        }

        let imageUrl = "";
        if (imageFile) {
          imageUrl = await uploadReportImage(imageFile);
        }

        const locationNameValue = locationTypeSelect.value === "Salón" ? roomSelect.value : "";

        await createReport({
          title: document.getElementById("title").value.trim(),
          category: document.getElementById("category").value,
          building: document.getElementById("building").value,
          locationType: document.getElementById("locationType").value,
          locationName: locationNameValue,
          priority: document.getElementById("priority").value,
          description: document.getElementById("description").value.trim(),
          imageUrl,
          createdBy: user.uid,
          createdByEmail: user.email || profile?.email || ""
        });

        createToast("Reporte enviado correctamente", "success");
        form.reset();
        window.location.href = "./reports.html";
      } catch (error) {
        console.warn(error);
        if (feedback) {
          feedback.classList.remove("hidden");
          feedback.textContent = getFirestoreErrorMessage(error);
        }
        createToast(getFirestoreErrorMessage(error), "error");
      }
    });
  });
}

function bootstrapReports() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Lista de reportes"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  observeAuth(async (user, profile) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    syncRoleAndNav("reports", user, profile);

    let reports = [];
    let firestoreError = null;

    try {
      reports = await getReports();
    } catch (error) {
      firestoreError = error;
      console.warn("No se pudieron cargar los reportes:", error);
    }

    content.innerHTML = `
      <section class="list-section">
        <p class="eyebrow">Historial</p>
        <h2>Todos los reportes</h2>
        <p class="subtitle">Filtra, revisa y abre cada reporte para consultar su detalle completo.</p>
        <div class="toolbar">
          <input id="reportSearch" type="search" placeholder="Buscar por título o ubicación" />
          <select id="statusFilter">
            <option value="">Todos los estados</option>
            <option>Pendiente</option>
            <option>En revisión</option>
            <option>En proceso</option>
            <option>Resuelto</option>
            <option>Cancelado</option>
          </select>
        </div>
      </section>
      ${firestoreError ? `<section class="list-section"><div class="empty-state">${escapeHTML(getFirestoreErrorMessage(firestoreError))}</div></section>` : ""}
      <section id="reportsList" class="report-list"></section>
    `;

    const listNode = document.getElementById("reportsList");
    const searchInput = document.getElementById("reportSearch");
    const statusFilter = document.getElementById("statusFilter");

    function render(filteredReports) {
      if (!listNode) {
        return;
      }

      listNode.innerHTML = filteredReports.length
        ? filteredReports.map((report) => renderReportCard(report, { showActions: true })).join("")
        : '<div class="empty-state">No se encontraron reportes con esos filtros.</div>';
    }

    const applyFilters = () => {
      const term = (searchInput?.value || "").trim().toLowerCase();
      const selectedStatus = statusFilter?.value || "";

      const filtered = reports.filter((report) => {
        const matchesTerm = !term || [report.title, report.building, report.locationName, report.locationType, report.category]
          .join(" ")
          .toLowerCase()
          .includes(term);
        const matchesStatus = !selectedStatus || report.status === selectedStatus;
        return matchesTerm && matchesStatus;
      });

      render(filtered);
    };

    searchInput?.addEventListener("input", applyFilters);
    statusFilter?.addEventListener("change", applyFilters);
    render(reports);
  });
}

function bootstrapReportDetail() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Detalle del reporte"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  observeAuth(async (user, profile) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    syncRoleAndNav("report-detail", user, profile);

    const reportId = getQueryParam("id");
    if (!reportId) {
      content.innerHTML = '<div class="empty-state">No se indicó un identificador de reporte.</div>';
      return;
    }

    let report = null;
    try {
      report = await getReportById(reportId);
    } catch (error) {
      console.warn("No se pudo cargar el detalle del reporte:", error);
      content.innerHTML = `<div class="empty-state">${escapeHTML(getFirestoreErrorMessage(error))}</div>`;
      return;
    }
    if (!report) {
      content.innerHTML = '<div class="empty-state">No se encontró el reporte solicitado.</div>';
      return;
    }

    content.innerHTML = `
      <section class="detail-section">
        <p class="eyebrow">Detalle</p>
        <h2>${escapeHTML(report.title)}</h2>
        <div class="detail-meta">
          <span class="badge ${getStatusClass(report.status)}">${escapeHTML(getStatusLabel(report.status))}</span>
          <span class="badge">${escapeHTML(report.priority)}</span>
          <span class="badge">${escapeHTML(formatDate(report.createdAt))}</span>
        </div>
      </section>
      <section class="detail-grid">
        <article class="detail-card">
          ${report.imageUrl ? `<img src="${escapeHTML(report.imageUrl)}" alt="Foto del reporte">` : ""}
          <div class="detail-stack">
            <div>
              <p class="card-label">Descripción</p>
              <p class="detail-value">${escapeHTML(report.description)}</p>
            </div>
            <div>
              <p class="card-label">Ubicación</p>
              <p class="detail-value">${escapeHTML(report.building)} · ${escapeHTML(report.locationType)} ${escapeHTML(report.locationName)}</p>
            </div>
            <div>
              <p class="card-label">Datos de origen</p>
              <p class="detail-value">${escapeHTML(report.createdByEmail || "Sin correo")}</p>
            </div>
          </div>
        </article>
      </section>
    `;
  });
}

function bootstrapAdmin() {
  setShellMarkup({
    title: "CampusFix UAQ",
    subtitle: "Panel administrador"
  });

  const content = getContentNode();
  if (!content) {
    return;
  }

  observeAuth(async (user, profile) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    const admin = syncRoleAndNav("admin", user, profile);

    if (!admin) {
      content.innerHTML = '<div class="empty-state">No tienes permisos para acceder a esta sección.</div>';
      return;
    }

    let reports = [];
    try {
      reports = await getReports();
    } catch (error) {
      console.warn("No se pudieron cargar los reportes del admin:", error);
      content.innerHTML = `<div class="empty-state">${escapeHTML(getFirestoreErrorMessage(error))}</div>`;
      return;
    }
    content.innerHTML = `
      <section class="admin-section">
        <p class="eyebrow">Administración</p>
        <h2>Gestiona el estado de los reportes</h2>
        <p class="subtitle">Puedes marcar cada ticket como pendiente, en revisión, en proceso, resuelto o cancelado.</p>
      </section>
      <section id="adminList" class="admin-list"></section>
    `;

    const listNode = document.getElementById("adminList");
    if (!listNode) {
      return;
    }

    listNode.innerHTML = reports.length
      ? reports.map((report) => `
        <article class="report-card">
          <header>
            <div>
              <h3 class="report-title">${escapeHTML(report.title)}</h3>
              <p class="report-subtitle">${escapeHTML(report.building)} · ${escapeHTML(report.locationType)} ${escapeHTML(report.locationName)}</p>
            </div>
            <span class="badge ${getStatusClass(report.status)}">${escapeHTML(getStatusLabel(report.status))}</span>
          </header>
          <p class="report-text">${escapeHTML(report.description)}</p>
          <div class="admin-row">
            <select data-report-id="${escapeHTML(report.id)}" class="status-select">
              <option ${report.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
              <option ${report.status === "En revisión" ? "selected" : ""}>En revisión</option>
              <option ${report.status === "En proceso" ? "selected" : ""}>En proceso</option>
              <option ${report.status === "Resuelto" ? "selected" : ""}>Resuelto</option>
              <option ${report.status === "Cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
            <a class="button button-secondary" href="./report-detail.html?id=${encodeURIComponent(report.id)}">Ver detalle</a>
          </div>
        </article>
      `).join("")
      : '<div class="empty-state">No hay reportes para administrar.</div>';

    listNode.querySelectorAll(".status-select").forEach((select) => {
      select.addEventListener("change", async (event) => {
        const target = event.currentTarget;
        const reportId = target.dataset.reportId;

        try {
          await updateReportStatus(reportId, target.value);
          createToast("Estado actualizado", "success");
        } catch (error) {
          console.warn(error);
          createToast(getFirestoreErrorMessage(error), "error");
        }
      });
    });
  });
}

switch (page) {
  case "home":
    bootstrapHome();
    break;
  case "login":
    bootstrapLogin();
    break;
  case "register":
    bootstrapRegister();
    break;
  case "dashboard":
    bootstrapDashboard();
    break;
  case "new-report":
    bootstrapNewReport();
    break;
  case "reports":
    bootstrapReports();
    break;
  case "report-detail":
    bootstrapReportDetail();
    break;
  case "admin":
    bootstrapAdmin();
    break;
  default:
    bootstrapHome();
    break;
}

registerServiceWorker();