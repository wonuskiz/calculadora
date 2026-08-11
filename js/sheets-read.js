// ============================================================
// Leitura pública (sem login) das taxas configuradas pela GOM.
// Usa a exportação CSV da aba "Config" da planilha do Google Sheets.
// Isso só funciona se a planilha estiver com o acesso "Qualquer
// pessoa com o link pode ver" (mesmo nível que já é usado hoje).
//
// Estrutura da aba "Config" (uma linha por moeda):
// moeda | taxa_gom_tipo | taxa_gom_valor | taxa_proxy_tipo | taxa_proxy_valor
// JPY   | fixo          | 0              | fixo            | 0
// KRW   | fixo          | 0              | fixo            | 0
// ...
// ============================================================

/**
 * Faz o parse simples de uma linha CSV (sem vírgulas dentro de aspas complexas,
 * suficiente para o formato numérico/textual simples que usamos aqui).
 */
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

function defaultRateEntry() {
  return {
    taxa_gom: { tipo: "fixo", valor: 0 },
    taxa_proxy: { tipo: "fixo", valor: 0 },
  };
}

/**
 * Busca as taxas configuradas por moeda na aba "Config".
 * Retorna um objeto { JPY: {taxa_gom, taxa_proxy}, KRW: {...}, ... }
 * com valores padrão (0, fixo) para qualquer moeda ainda não configurada,
 * para a calculadora nunca quebrar por causa disso.
 */
async function fetchRatesConfig() {
  const defaults = {};
  CONFIG.MOEDAS.forEach((m) => { defaults[m] = defaultRateEntry(); });

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.CONFIG_SHEET_NAME)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao buscar configuração");
    const text = await res.text();

    // Se a aba não existir, o Google devolve uma página de erro (não CSV).
    if (text.trim().startsWith("<")) throw new Error("Aba Config não encontrada ainda");

    const lines = text.trim().split("\n").filter(Boolean);
    const rates = { ...defaults };

    for (const line of lines) {
      const [moeda, gomTipo, gomValor, proxyTipo, proxyValor] = parseCsvLine(line);
      const key = (moeda || "").trim().toUpperCase();
      if (!CONFIG.MOEDAS.includes(key)) continue; // pula o cabeçalho e linhas inválidas

      rates[key] = {
        taxa_gom: {
          tipo: (gomTipo || "fixo").trim().toLowerCase() === "percentual" ? "percentual" : "fixo",
          valor: parseFloat((gomValor || "0").replace(",", ".")) || 0,
        },
        taxa_proxy: {
          tipo: (proxyTipo || "fixo").trim().toLowerCase() === "percentual" ? "percentual" : "fixo",
          valor: parseFloat((proxyValor || "0").replace(",", ".")) || 0,
        },
      };
    }
    return rates;
  } catch (err) {
    console.warn("[calculadora] Usando taxas padrão (0) para todas as moedas:", err.message);
    return defaults;
  }
}
