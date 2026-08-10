// ============================================================
// Toggle de tema (claro/escuro) — claro é o padrão.
// A preferência fica salva no localStorage do navegador.
// ============================================================

(function () {
  const STORAGE_KEY = "wonuskiz-calc-theme";

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* ignora se o navegador bloquear localStorage */
    }
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // Aplica o tema salvo assim que possível (evita "flash" do tema errado).
  const saved = getSavedTheme();
  if (saved === "dark") applyTheme("dark");

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const next = isDark ? "light" : "dark";
      applyTheme(next);
      saveTheme(next);
    });
  });
})();
