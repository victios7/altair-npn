const REPO = "victios7/altair-npn";
const REG = "./registry";

const app = document.getElementById("app");
const qInput = document.getElementById("q");

let indexCache = null;

async function getIndex() {
  if (indexCache) return indexCache;
  const res = await fetch(`${REG}/index.json`);
  if (!res.ok) throw new Error("registry offline");
  indexCache = await res.json();
  return indexCache;
}

async function getPkg(name) {
  const res = await fetch(`${REG}/packages/${encodeURIComponent(name)}.json`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

async function getVersion(name, ver) {
  const res = await fetch(
    `${REG}/packages/${encodeURIComponent(name)}/${encodeURIComponent(ver)}.json`
  );
  if (!res.ok) throw new Error("version not found");
  return res.json();
}

function route() {
  const hash = location.hash.slice(1) || "/";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "search") return renderSearch(params.get("q") || qInput.value || "");
  if (parts[0] === "package" && parts[1]) return renderPackage(parts[1], parts[2]);
  if (parts[0] === "publish") return renderPublish();
  return renderHome();
}

function setQ(v) {
  if (qInput.value !== v) qInput.value = v;
}

async function renderHome() {
  setQ("");
  app.innerHTML = `<div class="empty">Cargando…</div>`;
  try {
    const idx = await getIndex();
    const pkgs = idx.packages || {};
    const names = Object.keys(pkgs).sort();
    app.innerHTML = `
      <div class="hero">
        <h1>Paquetes Altair</h1>
        <p>Registro público · ${names.length} paquete${names.length === 1 ? "" : "s"}</p>
      </div>
      <div class="stats">
        <div class="stat"><b>${names.length}</b><span>paquetes</span></div>
      </div>
      <div class="pkg-list">
        ${names.map((n) => pkgRow(n, pkgs[n])).join("") || empty("No hay paquetes")}
      </div>`;
  } catch {
    app.innerHTML = empty("No se pudo cargar el registro");
  }
}

async function renderSearch(q) {
  setQ(q);
  app.innerHTML = `<div class="empty">Cargando…</div>`;
  try {
    const idx = await getIndex();
    const pkgs = idx.packages || {};
    const qq = q.trim().toLowerCase();
    const names = Object.keys(pkgs)
      .filter((n) => {
        if (!qq) return true;
        const blob = `${n} ${pkgs[n].description || ""}`.toLowerCase();
        return blob.includes(qq);
      })
      .sort();
    app.innerHTML = `
      <div class="hero">
        <h1>Resultados</h1>
        <p>${qq ? `“${escapeHtml(q)}”` : "Todos"} · ${names.length}</p>
      </div>
      <div class="pkg-list">
        ${names.map((n) => pkgRow(n, pkgs[n])).join("") || empty("Sin resultados")}
      </div>`;
  } catch {
    app.innerHTML = empty("Error de búsqueda");
  }
}

async function renderPackage(name, ver) {
  app.innerHTML = `<div class="empty">Cargando…</div>`;
  try {
    const meta = await getPkg(name);
    const version = ver || meta.latest || (meta.versions || []).slice(-1)[0];
    const vmeta = await getVersion(name, version);
    const tarball = vmeta.dist?.tarball || "";
    const integrity = vmeta.dist?.integrity || "";
    const versions = (meta.versions || []).slice().reverse();

    app.innerHTML = `
      <div class="pkg-header">
        <div>
          <h1>${escapeHtml(name)} <span class="ver">${escapeHtml(version)}</span></h1>
          <p style="color:var(--muted);margin:0.35rem 0 0">${escapeHtml(meta.description || vmeta.description || "")}</p>
          <div style="margin-top:0.65rem">
            <span class="tag">altair ${escapeHtml(vmeta.altair || "—")}</span>
            <span class="tag">${escapeHtml(vmeta.main || "main.at")}</span>
          </div>
        </div>
        <a class="btn btn-primary" href="${escapeAttr(tarball)}" download>Descargar</a>
      </div>
      <div class="install-box">
        <code>apm add ${escapeHtml(name)}@${escapeHtml(version)}</code>
        <button type="button" class="btn btn-ghost" id="copy-cmd">Copiar</button>
      </div>
      <div class="panel">
        <h2>Detalles</h2>
        <dl class="dl">
          <dt>Tarball</dt><dd><a href="${escapeAttr(tarball)}">${escapeHtml(tarball)}</a></dd>
          <dt>Integridad</dt><dd>${escapeHtml(integrity)}</dd>
          <dt>Versiones</dt>
          <dd>${versions
            .map(
              (v) =>
                `<a href="#/package/${encodeURIComponent(name)}/${encodeURIComponent(v)}">${escapeHtml(v)}</a>`
            )
            .join(" · ")}</dd>
        </dl>
      </div>`;

    document.getElementById("copy-cmd")?.addEventListener("click", () => {
      const t = `apm add ${name}@${version}`;
      navigator.clipboard?.writeText(t);
    });
  } catch {
    app.innerHTML = empty("Paquete no encontrado");
  }
}

function renderPublish() {
  setQ("");
  app.innerHTML = `
    <div class="hero">
      <h1>Publicar</h1>
      <p>Envía un paquete al registro</p>
    </div>
    <div class="panel">
      <form class="pub" id="pub-form">
        <div class="row">
          <div>
            <label>Nombre</label>
            <input name="name" required pattern="[a-z0-9][a-z0-9_-]*" placeholder="mi-paquete" />
          </div>
          <div>
            <label>Versión</label>
            <input name="version" required pattern="\\d+\\.\\d+\\.\\d+" placeholder="1.0.0" value="1.0.0" />
          </div>
        </div>
        <label>Descripción</label>
        <input name="description" required maxlength="160" placeholder="Qué hace el paquete" />
        <div class="row">
          <div>
            <label>Entrada (.at)</label>
            <input name="main" value="src/main.at" />
          </div>
          <div>
            <label>Altair</label>
            <input name="altair" value=">=1.8.5" />
          </div>
        </div>
        <label>URL del tarball (.tar.gz)</label>
        <input name="tarball" type="url" required placeholder="https://…" />
        <label>SHA-256 (hex, sin prefijo)</label>
        <input name="sha256" required pattern="[a-fA-F0-9]{64}" placeholder="64 caracteres hex" />
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Publicar</button>
        </div>
        <p class="error" id="pub-err" hidden></p>
      </form>
    </div>`;

  document.getElementById("pub-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("name")).trim();
    const version = String(fd.get("version")).trim();
    const description = String(fd.get("description")).trim();
    const main = String(fd.get("main")).trim() || "src/main.at";
    const altair = String(fd.get("altair")).trim() || ">=1.8.5";
    const tarball = String(fd.get("tarball")).trim();
    const sha256 = String(fd.get("sha256")).trim().toLowerCase();

    const err = document.getElementById("pub-err");
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
      err.hidden = false;
      err.textContent = "Nombre inválido";
      return;
    }

    const body = [
      "### apm-publish",
      "",
      "```json",
      JSON.stringify(
        {
          name,
          version,
          description,
          main,
          altair,
          dist: {
            tarball,
            integrity: `sha256-${sha256}`,
          },
        },
        null,
        2
      ),
      "```",
    ].join("\n");

    const title = `publish:${name}@${version}`;
    const url =
      `https://github.com/${REPO}/issues/new?` +
      new URLSearchParams({
        title,
        body,
        labels: "package",
      }).toString();

    location.href = url;
  });
}

function pkgRow(name, meta) {
  const ver = meta.latest || (meta.versions || []).slice(-1)[0] || "";
  return `<a class="pkg-row" href="#/package/${encodeURIComponent(name)}">
    <div class="name">${escapeHtml(name)}</div>
    <div class="meta">${escapeHtml(ver)}</div>
    <div class="desc">${escapeHtml(meta.description || "")}</div>
  </a>`;
}

function empty(msg) {
  return `<div class="empty">${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = qInput.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : "#/";
});

window.addEventListener("hashchange", route);
route();
