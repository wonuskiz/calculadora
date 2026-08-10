// ============================================================
// Calculadora pública — Wonuskiz Cegs
// ============================================================

const els = {
  valor: document.getElementById("valorItem"),
  tipo: document.getElementById("tipoItem"),
  quantidade: document.getElementById("quantidade"),
  moeda: document.getElementById("moeda"),
  totalBox: document.getElementById("totalBox"),
  totalValue: document.getElementById("totalValue"),
  errorBanner: document.getElementById("errorBanner"),
  formPedidos: document.getElementById("formPedidos"),
  planilhaAcompanhamento: document.getElementById("planilhaAcompanhamento"),
};

let ratesConfig = null; // { taxa_gom: {tipo, valor}, taxa_proxy: {tipo, valor} }
let exchangeCache = {}; // { JPY: rateToBRL, ... }
let debounceTimer = null;

function populateSelects() {
  const moedaOptions = CONFIG.MOEDAS.map((m) => `<option value="${m}">${m}</option>`).join("");
  els.moeda.innerHTML = `<option value="" disabled selected>selecione a moeda</option>${moedaOptions}`;

  const tipoOptions = CONFIG.TIPOS_ITEM.map((t) => `<option value="${t}">${t}</option>`).join("");
  els.tipo.innerHTML = `<option value="" disabled selected>selecione o tipo de item</option>${tipoOptions}`;
}

function setupLinks() {
  els.formPedidos.href = CONFIG.FORM_PEDIDOS_URL;
  els.planilhaAcompanhamento.href = CONFIG.PLANILHA_ACOMPANHAMENTO_URL;
}

function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function showError(msg) {
  els.errorBanner.textContent = msg;
  els.errorBanner.classList.add("show");
}
function hideError() {
  els.errorBanner.classList.remove("show");
}

async function getExchangeRate(moeda) {
  if (exchangeCache[moeda] !== undefined) return exchangeCache[moeda];
  const url = `https://api.frankfurter.dev/v1/latest?base=${moeda}&symbols=BRL`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não conseguimos buscar a cotação agora. Tente novamente em instantes.");
  const data = await res.json();
  const rate = data?.rates?.BRL;
  if (!rate) throw new Error("Cotação indisponível para essa moeda no momento.");
  exchangeCache[moeda] = rate;
  return rate;
}

function applyTaxa(baseValue, taxa) {
  if (!taxa) return 0;
  if (taxa.tipo === "percentual") return baseValue * (taxa.valor / 100);
  return taxa.valor;
}

function setEmptyState() {
  els.totalBox.classList.remove("filled");
  els.totalValue.textContent = "preencha os campos acima";
}

function setLoadingState() {
  els.totalBox.classList.remove("filled");
  els.totalValue.textContent = "calculando...";
}

function setFilledState(total) {
  els.totalBox.classList.add("filled");
  els.totalValue.textContent = formatBRL(total);
}

async function recalculate() {
  hideError();

  const valor = parseFloat((els.valor.value || "").replace(",", "."));
  const quantidade = parseFloat(els.quantidade.value || "1") || 1;
  const moeda = els.moeda.value;

  if (!valor || valor <= 0 || !moeda) {
    setEmptyState();
    return;
  }

  setLoadingState();

  try {
    const rate = await getExchangeRate(moeda);
    const valorConvertido = valor * quantidade * rate;

    const taxaGom = applyTaxa(valorConvertido, ratesConfig?.taxa_gom);
    const taxaProxy = applyTaxa(valorConvertido, ratesConfig?.taxa_proxy);

    const total = valorConvertido + taxaGom + taxaProxy;

    setFilledState(total);
  } catch (err) {
    showError(err.message || "Não foi possível calcular agora. Tente novamente.");
    setEmptyState();
  }
}

function debouncedRecalculate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(recalculate, 300);
}

async function init() {
  populateSelects();
  setupLinks();

  [els.valor, els.quantidade].forEach((el) => el.addEventListener("input", debouncedRecalculate));
  [els.tipo, els.moeda].forEach((el) => el.addEventListener("change", debouncedRecalculate));

  ratesConfig = await fetchRatesConfig();
  recalculate();
}

init();
