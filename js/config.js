// ============================================================
// CONFIGURAÇÕES DO PROJETO — Wonuskiz Calculadora de Cotação
// ============================================================
// Edite os valores abaixo conforme necessário.

const CONFIG = {
  // ID da planilha "Calculadora de cotação" (mesma da GOM).
  SPREADSHEET_ID: "1Kq-UuOS_FmSR4AM7QObPlWZlIkLaSNJ9DHpH68Zcm9o",

  // Nomes das abas de configuração (novas, não mexem nas abas originais da planilha).
  CONFIG_PROXY_SHEET: "Config_Proxy",
  CONFIG_GOM_SHEET: "Config_Gom",

  // Client ID do Google OAuth (mesmo usado no wonuskiz-mail).
  GOOGLE_CLIENT_ID: "342854763708-1ht7gkhjjm61s28uhba1cecub35qkak4.apps.googleusercontent.com",

  // E-mail(s) do Google autorizados a acessar o painel admin.
  ADMIN_EMAILS: [
    "lorranysousa7@gmail.com",
    "luudyta@gmail.com"
  ],

  // Links dos botões da calculadora.
  FORM_PEDIDOS_URL: "https://forms.gle/ZEbyAunroEZndCjH8",
  PLANILHA_ACOMPANHAMENTO_URL: "https://docs.google.com/spreadsheets/d/1o1IbiynuDy9vJlI3MifN0PkU0kcprM0jT-6VrGfeAsc/edit?gid=1768893326#gid=1768893326",

  // Tipos de item disponíveis (igual à planilha original).
  TIPOS_ITEM: ["Photocard", "Album", "Skzoo", "Chaveiro"],

  // Moedas disponíveis (igual à planilha original).
  MOEDAS: ["JPY", "KRW", "CNY", "USD"],

  // ------------------------------------------------------------
  // Valores padrão das taxas (usados até a GOM salvar algo diferente
  // pelo painel admin). Baseados na configuração original da GOM.
  // ------------------------------------------------------------

  // Taxa do Proxy: varia por moeda e pelo valor TOTAL do pedido
  // (valor do item × quantidade), na moeda original.
  // "limite": acima desse valor, usa a taxa "alta"; até ele, usa a "baixa".
  // Se "limite" for null, não há faixa — sempre usa a taxa "baixa".
  DEFAULT_PROXY: {
    JPY: { limite: 6000, baixoTipo: "fixo", baixoValor: 300, altoTipo: "percentual", altoValor: 5 },
    CNY: { limite: 125, baixoTipo: "fixo", baixoValor: 10, altoTipo: "percentual", altoValor: 8 },
    KRW: { limite: null, baixoTipo: "fixo", baixoValor: 3000, altoTipo: "fixo", altoValor: 3000 },
    USD: { limite: null, baixoTipo: "fixo", baixoValor: 1, altoTipo: "fixo", altoValor: 1 },
  },

  // Taxa da GOM: sempre em reais (R$), valor fixo por item.
  // Photocard varia pela quantidade (faixas); os demais tipos são fixos.
  DEFAULT_GOM: {
    Photocard: {
      faixas: [
        { min: 1, max: 5, valor: 5 },
        { min: 6, max: 20, valor: 4 },
        { min: 21, max: 99, valor: 2 },
        { min: 100, max: Infinity, valor: 1 },
      ],
    },
    Album: { valor: 10 },
    Skzoo: { valor: 10 },
    Chaveiro: { valor: 5 },
  },
};
