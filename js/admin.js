// ============================================================
// Painel Admin — Wonuskiz Cegs
// Login Google (OAuth 2.0) + leitura/gravação das taxas de
// Proxy (por moeda) e GOM (por tipo de item), via Sheets API.
// ============================================================

const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";

const FLAGS = { JPY: "🇯🇵", KRW: "🇰🇷", CNY: "🇨🇳", USD: "🇺🇸" };
const GOM_ICONS = { Photocard: "🃏", Album: "💿", Skzoo: "🦝", Chaveiro: "🔑" };

const adminEls = {
  loginState: document.getElementById("loginState"),
  deniedState: document.getElementById("deniedState"),
  adminState: document.getElementById("adminState"),
  btnLogin: document.getElementById("btnLogin"),
  btnLogout: document.getElementById("btnLogout"),
  btnLogoutDenied: document.getElementById("btnLogoutDenied"),
  btnSave: document.getElementById("btnSave"),
  welcomeMsg: document.getElementById("welcomeMsg"),
  saveMsg: document.getElementById("saveMsg"),
  accordionProxy: document.getElementById("accordionProxy"),
  accordionGom: document.getElementById("accordionGom"),
};

let accessToken = null;
let tokenClient = null;
let openProxyCurrency = CONFIG.MOEDAS[0];
let openGomTipo = CONFIG.TIPOS_ITEM[0];
let proxyState = {}; // { JPY: {limite, baixoTipo, baixoValor, altoTipo, altoValor}, ... }
let gomState = {}; // { Photocard: {faixas: [...]}, Album: {valor}, ... }

function showState(state) {
  adminEls.loginState.style.display = state === "login" ? "block" : "none";
  adminEls.deniedState.style.display = state === "denied" ? "block" : "none";
  adminEls.adminState.style.display = state === "admin" ? "block" : "none";
}

async function getUserEmail(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Não foi possível confirmar o e-mail.");
  const data = await res.json();
  return data.email;
}

// ------------------------------------------------------------
// PROXY (por moeda)
// ------------------------------------------------------------

function renderProxyItem(moeda) {
  const isOpen = moeda === openProxyCurrency;
  const cfg = proxyState[moeda];

  const item = document.createElement("div");
  item.className = "accordion-item" + (isOpen ? " open" : "");

  const header = document.createElement("button");
  header.type = "button";
  header.className = "accordion-header";
  header.innerHTML = `
    <span class="flag">${FLAGS[moeda] || ""}</span>
    <span class="code">${moeda}</span>
    <i class="ti ti-chevron-down chevron" aria-hidden="true"></i>
  `;
  header.addEventListener("click", () => {
    openProxyCurrency = isOpen ? null : moeda;
    renderProxyAccordion();
  });
  item.appendChild(header);

  if (isOpen) {
    const body = document.createElement("div");
    body.className = "accordion-body";
    body.innerHTML = `
      <div class="mini-label">limite (${moeda}) — deixe vazio se não houver faixa</div>
      <div class="rate-row" style="margin-bottom:12px;">
        <input type="number" inputmode="decimal" step="0.01" placeholder="ex: 6000" data-moeda="${moeda}" data-campo="limite" value="${cfg.limite ?? ""}" style="grid-column: span 2;" />
      </div>

      <div class="mini-label">taxa até o limite</div>
      <div class="rate-row">
        <select data-moeda="${moeda}" data-campo="baixoTipo">
          <option value="fixo" ${cfg.baixoTipo === "fixo" ? "selected" : ""}>fixo (${moeda})</option>
          <option value="percentual" ${cfg.baixoTipo === "percentual" ? "selected" : ""}>percentual (%)</option>
        </select>
        <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-moeda="${moeda}" data-campo="baixoValor" value="${cfg.baixoValor ?? ""}" />
      </div>

      <div class="mini-label">taxa acima do limite</div>
      <div class="rate-row">
        <select data-moeda="${moeda}" data-campo="altoTipo">
          <option value="fixo" ${cfg.altoTipo === "fixo" ? "selected" : ""}>fixo (${moeda})</option>
          <option value="percentual" ${cfg.altoTipo === "percentual" ? "selected" : ""}>percentual (%)</option>
        </select>
        <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-moeda="${moeda}" data-campo="altoValor" value="${cfg.altoValor ?? ""}" />
      </div>
    `;
    item.appendChild(body);

    body.querySelectorAll("select, input").forEach((el) => {
      el.addEventListener("input", syncProxyFieldToState);
      el.addEventListener("change", syncProxyFieldToState);
    });
  }

  return item;
}

function syncProxyFieldToState(e) {
  const el = e.target;
  const moeda = el.dataset.moeda;
  const campo = el.dataset.campo;
  if (!moeda || !campo) return;

  if (campo === "limite") {
    proxyState[moeda].limite = el.value === "" ? null : parseFloat(el.value);
  } else if (campo.endsWith("Tipo")) {
    proxyState[moeda][campo] = el.value;
  } else {
    proxyState[moeda][campo] = parseFloat(el.value) || 0;
  }
}

function renderProxyAccordion() {
  adminEls.accordionProxy.innerHTML = "";
  CONFIG.MOEDAS.forEach((moeda) => {
    adminEls.accordionProxy.appendChild(renderProxyItem(moeda));
  });
}

// ------------------------------------------------------------
// GOM (por tipo de item)
// ------------------------------------------------------------

function renderGomItem(tipo) {
  const isOpen = tipo === openGomTipo;
  const cfg = gomState[tipo];

  const item = document.createElement("div");
  item.className = "accordion-item" + (isOpen ? " open" : "");

  const header = document.createElement("button");
  header.type = "button";
  header.className = "accordion-header";
  header.innerHTML = `
    <span class="flag">${GOM_ICONS[tipo] || ""}</span>
    <span class="code">${tipo}</span>
    <i class="ti ti-chevron-down chevron" aria-hidden="true"></i>
  `;
  header.addEventListener("click", () => {
    openGomTipo = isOpen ? null : tipo;
    renderGomAccordion();
  });
  item.appendChild(header);

  if (isOpen) {
    const body = document.createElement("div");
    body.className = "accordion-body";

    if (tipo === "Photocard") {
      body.innerHTML = `<div class="mini-label">valor por item (r$), conforme a quantidade</div>`;
      cfg.faixas.forEach((faixa, idx) => {
        const label = faixa.max === Infinity ? `${faixa.min}+ un` : `${faixa.min} a ${faixa.max} un`;
        const row = document.createElement("div");
        row.className = "rate-row";
        row.style.marginBottom = "8px";
        row.style.gridTemplateColumns = "1fr 1fr";
        row.innerHTML = `
          <span style="font-size:12px; display:flex; align-items:center; color:var(--lbl);">${label}</span>
          <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-tipo="${tipo}" data-faixa="${idx}" value="${faixa.valor ?? ""}" />
        `;
        body.appendChild(row);
      });
    } else {
      body.innerHTML = `
        <div class="mini-label">valor por item (r$)</div>
        <div class="rate-row" style="grid-template-columns: 1fr;">
          <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-tipo="${tipo}" value="${cfg.valor ?? ""}" />
        </div>
      `;
    }

    item.appendChild(body);

    body.querySelectorAll("input").forEach((el) => {
      el.addEventListener("input", syncGomFieldToState);
      el.addEventListener("change", syncGomFieldToState);
    });
  }

  return item;
}

function syncGomFieldToState(e) {
  const el = e.target;
  const tipo = el.dataset.tipo;
  if (!tipo) return;

  if (tipo === "Photocard" && el.dataset.faixa !== undefined) {
    const idx = parseInt(el.dataset.faixa, 10);
    gomState.Photocard.faixas[idx].valor = parseFloat(el.value) || 0;
  } else {
    gomState[tipo].valor = parseFloat(el.value) || 0;
  }
}

function renderGomAccordion() {
  adminEls.accordionGom.innerHTML = "";
  CONFIG.TIPOS_ITEM.forEach((tipo) => {
    adminEls.accordionGom.appendChild(renderGomItem(tipo));
  });
}

// ------------------------------------------------------------
// Carregamento inicial
// ------------------------------------------------------------

async function loadCurrentConfig() {
  const [proxy, gom] = await Promise.all([fetchProxyConfig(), fetchGomConfig()]);
  proxyState = proxy;
  gomState = gom;
  renderProxyAccordion();
  renderGomAccordion();
}

// ------------------------------------------------------------
// Login / Auth
// ------------------------------------------------------------

async function handleTokenResponse(tokenResponse) {
  if (tokenResponse.error) {
    console.error(tokenResponse);
    return;
  }
  accessToken = tokenResponse.access_token;

  try {
    const email = await getUserEmail(accessToken);
    const authorized = CONFIG.ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());

    if (!authorized) {
      showState("denied");
      return;
    }

    adminEls.welcomeMsg.textContent = `conectada como ${email}`;
    showState("admin");
    await loadCurrentConfig();
  } catch (err) {
    alert("Erro ao entrar: " + err.message);
    showState("login");
  }
}

function initGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
  });
}

function login() {
  tokenClient.requestAccessToken({ prompt: "select_account" });
}

function logout() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  showState("login");
}

// ------------------------------------------------------------
// Gravação
// ------------------------------------------------------------

async function ensureSheetExists(sheetName) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some((s) => s.properties.title === sheetName);
  if (exists) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    }),
  });
}

async function writeValues(sheetName, range, values) {
  await ensureSheetExists(sheetName);
  const fullRange = `${sheetName}!${range}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(fullRange)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ range: fullRange, majorDimension: "ROWS", values }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Falha ao salvar em ${sheetName}.`);
  }
}

async function saveAll() {
  adminEls.btnSave.disabled = true;
  adminEls.saveMsg.textContent = "salvando...";
  adminEls.saveMsg.className = "save-msg";

  try {
    // --- Proxy ---
    const proxyValues = [["moeda", "limite", "baixo_tipo", "baixo_valor", "alto_tipo", "alto_valor"]];
    CONFIG.MOEDAS.forEach((moeda) => {
      const c = proxyState[moeda];
      proxyValues.push([moeda, c.limite ?? "", c.baixoTipo, c.baixoValor || 0, c.altoTipo, c.altoValor || 0]);
    });
    await writeValues(CONFIG.CONFIG_PROXY_SHEET, `A1:F${proxyValues.length}`, proxyValues);

    // --- Gom ---
    const gomValues = [["tipo_item", "qtd_min", "qtd_max", "valor"]];
    CONFIG.TIPOS_ITEM.forEach((tipo) => {
      const c = gomState[tipo];
      if (tipo === "Photocard") {
        c.faixas.forEach((f) => {
          gomValues.push([tipo, f.min, f.max === Infinity ? "" : f.max, f.valor || 0]);
        });
      } else {
        gomValues.push([tipo, 1, "", c.valor || 0]);
      }
    });
    await writeValues(CONFIG.CONFIG_GOM_SHEET, `A1:D${gomValues.length}`, gomValues);

    adminEls.saveMsg.textContent = "✅ taxas salvas com sucesso!";
    adminEls.saveMsg.className = "save-msg ok";
  } catch (err) {
    adminEls.saveMsg.textContent = "❌ " + err.message;
    adminEls.saveMsg.className = "save-msg err";
  } finally {
    adminEls.btnSave.disabled = false;
  }
}

window.addEventListener("load", () => {
  initGoogle();
  showState("login");
});

adminEls.btnLogin.addEventListener("click", login);
adminEls.btnLogout.addEventListener("click", logout);
adminEls.btnLogoutDenied.addEventListener("click", logout);
adminEls.btnSave.addEventListener("click", saveAll);
