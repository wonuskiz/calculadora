// ============================================================
// CONFIGURAÇÕES DO PROJETO — Wonuskiz Calculadora de Cotação
// ============================================================
// Edite os valores abaixo conforme necessário.

const CONFIG = {
  // ID da planilha "Calculadora de cotação" (mesma da GOM).
  // Uma aba nova chamada "Config" é usada para guardar as taxas,
  // sem mexer nas abas já existentes da planilha original.
  SPREADSHEET_ID: "1Kq-UuOS_FmSR4AM7QObPlWZlIkLaSNJ9DHpH68Zcm9o",
  CONFIG_SHEET_NAME: "Config",

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
};
