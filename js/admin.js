// ============================================================
// Painel Admin — Wonuskiz Cegs
// Login Google (OAuth 2.0) + leitura/gravação das taxas na
// aba "Config" da planilha, via Google Sheets API.
// ============================================================

const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";

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
  taxaGomTipo: document.getElementById("taxaGomTipo"),
  taxaGomValor: document.getElementById("taxaGomValor"),
  taxaProxyTipo: document.getElementById("taxaProxyTipo"),
  taxaProxyValor: document.getElementById("taxaProxyValor"),
};

let accessToken = null;
let tokenClient = null;

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

async function loadCurrentRates() {
  const rates = await fetchRatesConfig();
  adminEls.taxaGomTipo.value = rates.taxa_gom.tipo;
  adminEls.taxaGomValor.value = rates.taxa_gom.valor;
  adminEls.taxaProxyTipo.value = rates.taxa_proxy.tipo;
  adminEls.taxaProxyValor.value = rates.taxa_proxy.valor;
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

    adminEls.welcomeMsg.textContent = `Conectada como ${email}`;
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
  adminEls.saveMsg.textContent = "Salvando...";
  adminEls.saveMsg.className = "save-msg";

  const values = [
    ["chave", "tipo", "valor"],
    ["taxa_gom", adminEls.taxaGomTipo.value, adminEls.taxaGomValor.value || "0"],
    ["taxa_proxy", adminEls.taxaProxyTipo.value, adminEls.taxaProxyValor.value || "0"],
  ];

  try {
    await ensureConfigSheetExists();

    const range = `${CONFIG.CONFIG_SHEET_NAME}!A1:C3`;
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

    adminEls.saveMsg.textContent = "✅ Taxas salvas com sucesso!";
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
