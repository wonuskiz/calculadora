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

let proxyConfig = null; // { JPY: {limite, baixoTipo, baixoValor, altoTipo, altoValor}, ... }
let gomConfig = null; // { Photocard: {faixas: [...]}, Album: {valor}, ... }
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

/** Calcula a taxa de proxy (na moeda original) com base no valor total do pedido. */
function calcTaxaProxyOriginal(totalOriginal, moeda) {
  const cfg = proxyConfig?.[moeda];
  if (!cfg) return 0;

  const usaFaixaAlta = cfg.limite !== null && cfg.limite !== undefined && totalOriginal > cfg.limite;
  const tipo = usaFaixaAlta ? cfg.altoTipo : cfg.baixoTipo;
  const valor = usaFaixaAlta ? cfg.altoValor : cfg.baixoValor;

  if (tipo === "percentual") return totalOriginal * (valor / 100);
  return valor;
}

/** Calcula a taxa da GOM (em reais), por item, multiplicada pela quantidade. */
function calcTaxaGomBRL(tipoItem, quantidade) {
  const cfg = gomConfig?.[tipoItem];
  if (!cfg) return 0;

  let valorPorItem = 0;
  if (tipoItem === "Photocard" && cfg.faixas) {
    const faixa = cfg.faixas.find((f) => quantidade >= f.min && quantidade <= f.max);
    valorPorItem = faixa ? faixa.valor : 0;
  } else {
    valorPorItem = cfg.valor || 0;
  }

  return valorPorItem * quantidade;
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
  const tipoItem = els.tipo.value;

  if (!valor || valor <= 0 || !moeda || !tipoItem) {
    setEmptyState();
    return;
  }

  setLoadingState();

  try {
    const rate = await getExchangeRate(moeda);

    // "valor" já é o VALOR TOTAL do pedido (não por item) — não multiplica pela quantidade aqui.
    const totalOriginal = valor;
    const taxaProxyOriginal = calcTaxaProxyOriginal(totalOriginal, moeda);
    const valorConvertidoBRL = (totalOriginal + taxaProxyOriginal) * rate;

    // A taxa da GOM é por item (e pode variar pela faixa de quantidade no Photocard),
    // então aqui sim a quantidade multiplica.
    const taxaGomBRL = calcTaxaGomBRL(tipoItem, quantidade);

    const total = valorConvertidoBRL + taxaGomBRL;

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

  [proxyConfig, gomConfig] = await Promise.all([fetchProxyConfig(), fetchGomConfig()]);
  recalculate();
}

init();
