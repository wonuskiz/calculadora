// ============================================================
// Leitura pública (sem login) das taxas configuradas pela GOM.
// Usa a exportação CSV de duas abas da planilha do Google Sheets.
// Isso só funciona se a planilha estiver com o acesso "Qualquer
// pessoa com o link pode ver" (mesmo nível que já é usado hoje).
//
// Aba "Config_Proxy" (uma linha por moeda):
// moeda | limite | baixo_tipo | baixo_valor | alto_tipo | alto_valor
//
// Aba "Config_Gom" (uma linha por faixa/tipo de item):
// tipo_item | qtd_min | qtd_max | valor
// ============================================================

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function csvUrlFor(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchCsvLines(sheetName) {
  const res = await fetch(csvUrlFor(sheetName));
  if (!res.ok) throw new Error(`Falha ao buscar ${sheetName}`);
  const text = await res.text();
  if (text.trim().startsWith("<")) throw new Error(`Aba ${sheetName} não encontrada ainda`);
  return text.trim().split("\n").filter(Boolean);
}

/** Busca a config de Proxy (por moeda). Cai nos padrões se a aba não existir. */
async function fetchProxyConfig() {
  const defaults = JSON.parse(JSON.stringify(CONFIG.DEFAULT_PROXY));
  try {
    const lines = await fetchCsvLines(CONFIG.CONFIG_PROXY_SHEET);
    const result = {};
    for (const line of lines) {
      const [moeda, limite, baixoTipo, baixoValor, altoTipo, altoValor] = parseCsvLine(line);
      const key = (moeda || "").trim().toUpperCase();
      if (!CONFIG.MOEDAS.includes(key)) continue;

      result[key] = {
        limite: limite && limite.trim() !== "" ? parseFloat(limite.replace(",", ".")) : null,
        baixoTipo: (baixoTipo || "fixo").trim().toLowerCase() === "percentual" ? "percentual" : "fixo",
        baixoValor: parseFloat((baixoValor || "0").replace(",", ".")) || 0,
        altoTipo: (altoTipo || "fixo").trim().toLowerCase() === "percentual" ? "percentual" : "fixo",
        altoValor: parseFloat((altoValor || "0").replace(",", ".")) || 0,
      };
    }
    // Preenche moedas que não vieram na planilha com os padrões.
    CONFIG.MOEDAS.forEach((m) => { if (!result[m]) result[m] = defaults[m]; });
    return result;
  } catch (err) {
    console.warn("[calculadora] Usando taxas de Proxy padrão:", err.message);
    return defaults;
  }
}

/** Busca a config da GOM (por tipo de item / faixa). Cai nos padrões se a aba não existir. */
async function fetchGomConfig() {
  const defaults = JSON.parse(JSON.stringify(CONFIG.DEFAULT_GOM));
  try {
    const lines = await fetchCsvLines(CONFIG.CONFIG_GOM_SHEET);
    const result = {};
    CONFIG.TIPOS_ITEM.forEach((t) => { result[t] = t === "Photocard" ? { faixas: [] } : { valor: 0 }; });

    for (const line of lines) {
      const [tipoItem, qtdMin, qtdMax, valor] = parseCsvLine(line);
      const tipo = (tipoItem || "").trim();
      if (!CONFIG.TIPOS_ITEM.includes(tipo)) continue;

      const valorNum = parseFloat((valor || "0").replace(",", ".")) || 0;

      if (tipo === "Photocard") {
        const min = parseFloat(qtdMin) || 1;
        const maxRaw = (qtdMax || "").trim();
        const max = maxRaw === "" || maxRaw.toLowerCase() === "infinity" ? Infinity : parseFloat(maxRaw);
        result.Photocard.faixas.push({ min, max, valor: valorNum });
      } else {
        result[tipo] = { valor: valorNum };
      }
    }

    // Se a aba não trouxe faixas de Photocard (linhas ausentes), usa os padrões.
    if (result.Photocard.faixas.length === 0) result.Photocard = defaults.Photocard;

    return result;
  } catch (err) {
    console.warn("[calculadora] Usando taxas de GOM padrão:", err.message);
    return defaults;
  }
}
