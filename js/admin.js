// ============================================================
// Painel Admin — Wonuskiz Cegs
// Login Google (OAuth 2.0) + leitura/gravação das taxas
// POR MOEDA na aba "Config" da planilha, via Google Sheets API.
// ============================================================

const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";

const FLAGS = { JPY: "🇯🇵", KRW: "🇰🇷", CNY: "🇨🇳", USD: "🇺🇸" };

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
  accordionList: document.getElementById("accordionList"),
};

let accessToken = null;
let tokenClient = null;
let openCurrency = CONFIG.MOEDAS[0]; // primeira moeda começa aberta
let currentRates = {}; // estado local editável { JPY: {taxa_gom, taxa_proxy}, ... }

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

/** Constrói o HTML de um item do accordion para uma moeda. */
function renderAccordionItem(moeda) {
  const isOpen = moeda === openCurrency;
  const rates = currentRates[moeda];

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
    openCurrency = isOpen ? null : moeda;
    renderAccordion();
  });
  item.appendChild(header);

  if (isOpen) {
    const body = document.createElement("div");
    body.className = "accordion-body";
    body.innerHTML = `
      <div class="mini-label">taxa da gom</div>
      <div class="rate-row">
        <select data-moeda="${moeda}" data-campo="gom-tipo">
          <option value="fixo" ${rates.taxa_gom.tipo === "fixo" ? "selected" : ""}>fixo (r$)</option>
          <option value="percentual" ${rates.taxa_gom.tipo === "percentual" ? "selected" : ""}>percentual (%)</option>
        </select>
        <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-moeda="${moeda}" data-campo="gom-valor" value="${rates.taxa_gom.valor || ""}" />
      </div>
      <div class="mini-label">taxa do proxy</div>
      <div class="rate-row">
        <select data-moeda="${moeda}" data-campo="proxy-tipo">
          <option value="fixo" ${rates.taxa_proxy.tipo === "fixo" ? "selected" : ""}>fixo (r$)</option>
          <option value="percentual" ${rates.taxa_proxy.tipo === "percentual" ? "selected" : ""}>percentual (%)</option>
        </select>
        <input type="number" inputmode="decimal" step="0.01" placeholder="0,00" data-moeda="${moeda}" data-campo="proxy-valor" value="${rates.taxa_proxy.valor || ""}" />
      </div>
    `;
    item.appendChild(body);

    // Salva no estado local a cada alteração (sem persistir ainda — só ao clicar em "salvar").
    body.querySelectorAll("select, input").forEach((el) => {
      el.addEventListener("input", syncFieldToState);
      el.addEventListener("change", syncFieldToState);
    });
  }

  return item;
}

function syncFieldToState(e) {
  const el = e.target;
  const moeda = el.dataset.moeda;
  const campo = el.dataset.campo;
  if (!moeda || !campo) return;

  if (campo === "gom-tipo") currentRates[moeda].taxa_gom.tipo = el.value;
  if (campo === "gom-valor") currentRates[moeda].taxa_gom.valor = parseFloat(el.value) || 0;
  if (campo === "proxy-tipo") currentRates[moeda].taxa_proxy.tipo = el.value;
  if (campo === "proxy-valor") currentRates[moeda].taxa_proxy.valor = parseFloat(el.value) || 0;
}

function renderAccordion() {
  adminEls.accordionList.innerHTML = "";
  CONFIG.MOEDAS.forEach((moeda) => {
    adminEls.accordionList.appendChild(renderAccordionItem(moeda));
  });
}

async function loadCurrentRates() {
  currentRates = await fetchRatesConfig();
  renderAccordion();
}

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
    await loadCurrentRates();
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

/** Garante que a aba "Config" exista na planilha; cria se necessário. */
async function ensureConfigSheetExists() {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const exists = (meta.sheets || []).some((s) => s.properties.title === CONFIG.CONFIG_SHEET_NAME);
  if (exists) return;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: CONFIG.CONFIG_SHEET_NAME } } }],
    }),
  });
}

async function saveRates() {
  adminEls.btnSave.disabled = true;
  adminEls.saveMsg.textContent = "salvando...";
  adminEls.saveMsg.className = "save-msg";

  const values = [["moeda", "taxa_gom_tipo", "taxa_gom_valor", "taxa_proxy_tipo", "taxa_proxy_valor"]];
  CONFIG.MOEDAS.forEach((moeda) => {
    const r = currentRates[moeda];
    values.push([moeda, r.taxa_gom.tipo, r.taxa_gom.valor || 0, r.taxa_proxy.tipo, r.taxa_proxy.valor || 0]);
  });

  try {
    await ensureConfigSheetExists();

    const lastRow = values.length; // header + 1 linha por moeda
    const range = `${CONFIG.CONFIG_SHEET_NAME}!A1:E${lastRow}`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ range, majorDimension: "ROWS", values }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "Falha ao salvar.");
    }

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
adminEls.btnSave.addEventListener("click", saveRates);
