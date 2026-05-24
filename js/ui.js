export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(timestamp) {
  if (!timestamp) {
    return "Sin fecha";
  }

  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function getStatusLabel(status = "Pendiente") {
  return String(status).trim() || "Pendiente";
}

export function getStatusClass(status = "Pendiente") {
  return `status-${String(status).trim().toLowerCase().replaceAll(" ", "-")}`;
}

export function createToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

export function setPageTitle(title, subtitle = "") {
  const titleNode = document.querySelector("[data-page-title]");
  const subtitleNode = document.querySelector("[data-page-subtitle]");

  if (titleNode) {
    titleNode.textContent = title;
  }

  if (subtitleNode) {
    subtitleNode.textContent = subtitle;
  }
}

export function createAppHeader({ title, subtitle, links = [], userLabel = "" }) {
  const navLinks = links
    .map((link) => {
      const active = link.active ? "is-active" : "";
      return `<a class="${active}" href="${link.href}">${escapeHTML(link.label)}</a>`;
    })
    .join("");

  return `
    <header class="app-header">
      <div class="brand">
        <strong>${escapeHTML(title)}</strong>
        <span>${escapeHTML(subtitle)}</span>
      </div>
      <div class="nav-links">
        ${navLinks}
        ${userLabel ? `<span class="badge">${escapeHTML(userLabel)}</span>` : ""}
      </div>
    </header>
  `;
}

export function updateNavLinks(links = [], userLabel = "") {
  const container = document.querySelector(".nav-links");
  if (!container) return;

  const navLinks = links
    .map((link) => {
      const active = link.active ? "is-active" : "";
      return `<a class="${active}" href="${link.href}">${escapeHTML(link.label)}</a>`;
    })
    .join("");

  container.innerHTML = `${navLinks}${userLabel ? `<span class="badge">${escapeHTML(userLabel)}</span>` : ""}`;
}

export function renderReportCard(report, { showActions = false } = {}) {
  const imageMarkup = report.imageUrl
    ? `<img src="${escapeHTML(report.imageUrl)}" alt="Foto del reporte ${escapeHTML(report.title)}">`
    : "";

  const actions = showActions
    ? `<footer><a class="button button-secondary" href="./report-detail.html?id=${encodeURIComponent(report.id)}">Ver detalle</a></footer>`
    : `<footer><a class="button button-secondary" href="./report-detail.html?id=${encodeURIComponent(report.id)}">Abrir</a></footer>`;

  return `
    <article class="report-card">
      <header>
        <div>
          <p class="card-label">Reporte</p>
          <h3 class="report-title">${escapeHTML(report.title)}</h3>
        </div>
        <span class="badge ${getStatusClass(report.status)}">${escapeHTML(getStatusLabel(report.status))}</span>
      </header>
      ${imageMarkup}
      <p class="report-text">${escapeHTML(report.description)}</p>
      <p class="report-subtitle"><strong>Ubicación:</strong> ${escapeHTML(report.building)} · ${escapeHTML(report.locationType)} ${escapeHTML(report.locationName)}</p>
      <p class="report-subtitle"><strong>Prioridad:</strong> ${escapeHTML(report.priority)}</p>
      <p class="report-subtitle"><strong>Fecha:</strong> ${escapeHTML(formatDate(report.createdAt))}</p>
      ${actions}
    </article>
  `;
}

// Custom select replacement: finds native selects (unless data-no-custom) and replaces with styled widget
export function createCustomSelects(root = document) {
  const selects = Array.from((root || document).querySelectorAll("select:not([data-no-custom])"));

  selects.forEach((select) => {
    // skip if already transformed
    if (select.dataset.custom === "true") return;

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "trigger";
    const labelSpan = document.createElement("span");
    labelSpan.className = "label";
    labelSpan.textContent = select.options[select.selectedIndex]?.text || "Selecciona una opción";
    const caret = document.createElement("span");
    caret.className = "caret";
    trigger.appendChild(labelSpan);
    trigger.appendChild(caret);

    const optionsNode = document.createElement("div");
    optionsNode.className = "options";

    Array.from(select.options).forEach((opt, idx) => {
      const o = document.createElement("div");
      o.className = "option";
      o.setAttribute("role", "option");
      if (opt.disabled) o.setAttribute("aria-disabled", "true");
      o.dataset.value = opt.value;
      o.textContent = opt.text;
      if (idx === select.selectedIndex) o.classList.add("active");
      optionsNode.appendChild(o);

      o.addEventListener("click", (e) => {
        if (opt.disabled) return;
        select.value = opt.value;
        // update label
        labelSpan.textContent = opt.text;
        // mark active
        optionsNode.querySelectorAll(".option").forEach(x => x.classList.remove("active"));
        o.classList.add("active");
        // close
        wrapper.classList.remove("open");
        // dispatch change event on original select
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // hide original select but keep in DOM for forms
    select.style.display = "none";
    select.dataset.custom = "true";

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      // toggle
      const open = wrapper.classList.toggle("open");
      if (open) {
        // focus first
        const active = optionsNode.querySelector('.option.active');
        if (active) active.scrollIntoView({ block: 'nearest' });
      }
    });

    // close on outside click
    document.addEventListener('click', (ev) => {
      if (!wrapper.contains(ev.target)) wrapper.classList.remove('open');
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsNode);
    select.parentNode.insertBefore(wrapper, select.nextSibling);
  });
}