// ============================================================
// Leitura pública (sem login) das taxas configuradas pela GOM.
// Usa a exportação CSV da aba "Config" da planilha do Google Sheets.
// Isso só funciona se a planilha estiver com o acesso "Qualquer
// pessoa com o link pode ver" (mesmo nível que já é usado hoje).
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

/**
 * Busca as taxas configuradas (taxa_gom, taxa_proxy) na aba "Config".
 * Retorna valores padrão (0, fixo) caso a aba ainda não exista ou
 * a leitura falhe, para a calculadora nunca quebrar por causa disso.
 */
async function fetchRatesConfig() {
  const defaults = {
    taxa_gom: { tipo: "fixo", valor: 0 },
    taxa_proxy: { tipo: "fixo", valor: 0 },
  };

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
      const [chave, tipo, valor] = parseCsvLine(line);
      const key = (chave || "").trim().toLowerCase();
      if (key === "taxa_gom" || key === "taxa_proxy") {
        rates[key] = {
          tipo: (tipo || "fixo").trim().toLowerCase() === "percentual" ? "percentual" : "fixo",
          valor: parseFloat((valor || "0").replace(",", ".")) || 0,
        };
      }
    }
    return rates;
  } catch (err) {
    console.warn("[calculadora] Usando taxas padrão (0):", err.message);
    return defaults;
  }
}
