/* ======================================================
   Guia Saúde - main.js (vanilla JS)
   
  
   ====================================================== */

(function () {
  "use strict";

 
  const API_BASE = "https://guia-sa-de-backend.onrender.com";

  /* -------------------- Utilidades -------------------- */
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }
  function escapeHTML(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  async function fetchJSON(path) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {}
      throw new Error(`Falha na API (${res.status}) em ${path}. ${detail}`);
    }
    return await res.json();
  }

  function showInlineMessage(container, type, title, message) {
    const colors = {
      success: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
      error: { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239" },
      info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    };
    const c = colors[type] || colors.info;

    container.innerHTML = `
      <div class="card" style="background:${c.bg}; border:1px solid ${c.border}; color:${c.text};">
        <h3 style="margin-top:0;">${escapeHTML(title)}</h3>
        <p style="margin:0;">${escapeHTML(message)}</p>
      </div>
    `;
  }

  /* ======================================================
     MENU MOBILE (hambúrguer)
     ====================================================== */
  function initMenuMobile() {
    const btn = document.querySelector(".menu-toggle");
    const nav = document.querySelector(".site-nav");

    if (!btn || !nav) return;

    function openMenu() {
      nav.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Fechar menu");
    }

    function closeMenu() {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Abrir menu");
    }

    btn.addEventListener("click", () => {
      nav.classList.contains("is-open") ? closeMenu() : openMenu();
    });

    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    document.addEventListener("click", (e) => {
      const clickedInside = nav.contains(e.target) || btn.contains(e.target);
      if (!clickedInside) closeMenu();
    });
  }

  /* ======================================================
     TRIAGEM (triagem.html)
     ====================================================== */
  async function initTriagem() {
    const listEl = qs("#lista-sintomas");
    const searchEl = qs("#busca-sintoma");
    const btnGerar = qs("#btn-gerar-orientacao");
    const btnLimpar = qs("#btn-limpar-sintomas");
    const resultEl = qs("#resultado-triagem");

    if (!listEl || !btnGerar || !resultEl) return;

    let sintomas = [];
    let orientacoes = null;

    try {
      sintomas = await fetchJSON("/api/sintomas");
      orientacoes = await fetchJSON("/api/orientacoes");
    } catch (err) {
      console.error(err);
      showInlineMessage(
        resultEl,
        "error",
        "Servidor indisponível",
        "Não foi possível conectar ao backend. Verifique se o Render está online e se o CORS está liberado para a Vercel."
      );
      listEl.innerHTML = `
        <article class="card">
          <h3>Não foi possível carregar os sintomas</h3>
          <p class="muted">A API está inacessível no momento.</p>
        </article>
      `;
      btnGerar.disabled = true;
      return;
    }

    function renderSintomas(filterText = "") {
      const f = normalize(filterText);
      const filtrados = sintomas.filter((s) => normalize(s.nome).includes(f));

      if (filtrados.length === 0) {
        listEl.innerHTML = `
          <article class="card" style="flex:1 1 240px;">
            <h3>Nenhum sintoma encontrado</h3>
            <p class="muted">Tente buscar por outro termo.</p>
          </article>
        `;
        return;
      }

      listEl.innerHTML = filtrados
        .map((s) => {
          const id = escapeHTML(String(s.id));
          const nome = escapeHTML(String(s.nome));
          const cat = escapeHTML(String(s.categoria || "Geral"));

          return `
            <article class="card" style="flex:1 1 240px;">
              <div style="display:flex; align-items:flex-start; gap:.6rem;">
                <input id="s-${id}" type="checkbox" name="sintoma" value="${id}" />
                <div>
                  <label for="s-${id}" style="display:block; margin:0; font-weight:800;">${nome}</label>
                  <p class="muted" style="margin:.2rem 0 0;">Categoria: ${cat}</p>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    }

    function getSelectedIds() {
      return qsa('input[name="sintoma"]:checked', listEl).map((i) => i.value);
    }

    function scoreFromSelection(selectedIds) {
      const byId = new Map(sintomas.map((s) => [String(s.id), s]));
      let score = 0;

      for (const id of selectedIds) {
        const item = byId.get(String(id));
        score += Number(item?.peso || 1);
      }

      const hasAlerta = selectedIds.some((id) =>
        (orientacoes?.sinaisAlerta || []).includes(String(id))
      );

      return { score, hasAlerta };
    }

    function getRecommendation({ score, hasAlerta }) {
      if (hasAlerta) return { nivel: "Alta urgência", destino: "hospital", key: "emergencia" };
      if (score >= 6) return { nivel: "Urgência moderada", destino: "upa", key: "upa" };
      return { nivel: "Baixa urgência", destino: "ubs", key: "ubs" };
    }

    async function carregarUnidadesParaRecomendacao(rec) {
      const tipos = rec.destino === "hospital" ? ["hospital", "upa"] : [rec.destino];

      const results = await Promise.all(
        tipos.map(async (t) => {
          const data = await fetchJSON(`/api/unidades?tipo=${encodeURIComponent(t)}`);
          return Array.isArray(data) ? data : [];
        })
      );

      return results.flat();
    }

    function renderUnidadesNoResultado(containerEl, unidades) {
      if (!containerEl) return;

      if (!unidades || unidades.length === 0) {
        containerEl.innerHTML = `
          <div class="card" style="background:#eff6ff; border-color:#bfdbfe;">
            <h3 style="margin-top:0;">Unidades sugeridas</h3>
            <p class="muted" style="margin:0;">Nenhuma unidade encontrada para este tipo no momento.</p>
          </div>
        `;
        return;
      }

      const top = unidades.slice(0, 3);

      containerEl.innerHTML = `
        <div class="card" style="background:#f8fafc;">
          <h3 style="margin-top:0;">Unidades sugeridas</h3>

          <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            ${top
              .map((u) => {
                const nome = escapeHTML(u.nome || "Unidade");
                const tipo = escapeHTML(String(u.tipo || "").toUpperCase());
                const bairro = escapeHTML(u.bairro || "-");
                const end = escapeHTML(u.endereco || "-");
                const hor = escapeHTML(u.horario || "-");
                const fonteUrl = u.fonteUrl ? String(u.fonteUrl) : null;

                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  u.endereco || u.nome || ""
                )}`;

                const fonteBtn = fonteUrl
                  ? `<a class="btn btn-outline" href="${escapeHTML(
                      fonteUrl
                    )}" target="_blank" rel="noopener noreferrer">Fonte (Prefeitura)</a>`
                  : "";

                return `
                  <article class="card" style="flex:1 1 260px;">
                    <h4 style="margin:0 0 .35rem;">${nome}</h4>
                    <p class="muted" style="margin:.15rem 0;"><strong>Tipo:</strong> ${tipo} • <strong>Bairro:</strong> ${bairro}</p>
                    <p class="muted" style="margin:.15rem 0;"><strong>Endereço:</strong> ${end}</p>
                    <p class="muted" style="margin:.15rem 0;"><strong>Horário:</strong> ${hor}</p>

                    <div style="margin-top:.65rem; display:flex; gap:.6rem; flex-wrap:wrap;">
                      <a class="btn btn-primary" href="${escapeHTML(
                        mapsUrl
                      )}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>
                      ${fonteBtn}
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    async function renderResult(selectedIds) {
      if (selectedIds.length === 0) {
        showInlineMessage(
          resultEl,
          "info",
          "Selecione ao menos 1 sintoma",
          "Marque alguns sintomas acima e clique em “Ver orientação”."
        );
        return;
      }

      const { score, hasAlerta } = scoreFromSelection(selectedIds);
      const rec = getRecommendation({ score, hasAlerta });

      const destinoLabel =
        rec.destino === "hospital" ? "UPA/Hospital" : rec.destino.toUpperCase();

      const msg = orientacoes?.mensagens?.[rec.key] || "Procure atendimento se necessário.";
      const dicas = Array.isArray(orientacoes?.dicasGerais) ? orientacoes.dicasGerais : [];

      resultEl.innerHTML = `
        <div class="card">
          <h3 style="margin-top:0;">Resultado (orientação informativa)</h3>
          <p class="muted" style="margin:.25rem 0 .75rem;">
            Nível sugerido: <strong>${escapeHTML(rec.nivel)}</strong> — Direcionamento: <strong>${escapeHTML(destinoLabel)}</strong>
          </p>

          <div class="alert-box" style="background:#eff6ff; border-color:#bfdbfe;">
            <p style="color:#1d4ed8;">Orientação</p>
            <ul style="margin:0;">
              <li>${escapeHTML(msg)}</li>
            </ul>
          </div>

          <p class="muted" style="margin: .9rem 0 .4rem;"><strong>Dicas gerais</strong></p>
          <ul>
            ${dicas.map((d) => `<li>${escapeHTML(d)}</li>`).join("")}
          </ul>

          <p class="muted" style="margin-top:.75rem;">
            Aviso: isto não é diagnóstico. Se houver piora, procure atendimento.
          </p>
        </div>

        <section id="resultado-unidades" aria-label="Unidades sugeridas" style="margin-top: 1rem;">
          <div class="card" style="background:#f8fafc;">
            <h3 style="margin-top:0;">Unidades sugeridas</h3>
            <p class="muted" style="margin:0;">Carregando unidades...</p>
          </div>
        </section>
      `;

      const containerUnidades = qs("#resultado-unidades", resultEl);

      try {
        const unidades = await carregarUnidadesParaRecomendacao(rec);
        renderUnidadesNoResultado(containerUnidades, unidades);
      } catch (err) {
        console.error(err);
        containerUnidades.innerHTML = `
          <div class="card" style="background:#fff1f2; border-color:#fecdd3;">
            <h3 style="margin-top:0;">Falha ao buscar unidades</h3>
            <p class="muted" style="margin:0;">A API não respondeu. Verifique CORS e se o Render está online.</p>
          </div>
        `;
      }
    }

    renderSintomas("");
    searchEl?.addEventListener("input", (e) => renderSintomas(e.target.value));

    btnGerar.addEventListener("click", async () => {
      btnGerar.disabled = true;
      const old = btnGerar.textContent;
      btnGerar.textContent = "Gerando...";

      try {
        await renderResult(getSelectedIds());
        resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
      } finally {
        btnGerar.disabled = false;
        btnGerar.textContent = old;
      }
    });

    btnLimpar?.addEventListener("click", () => {
      qsa('input[name="sintoma"]', listEl).forEach((i) => (i.checked = false));
      showInlineMessage(
        resultEl,
        "info",
        "Seleção limpa",
        "Selecione novos sintomas para gerar outra orientação."
      );
    });
  }

  /* ======================================================
     UNIDADES (unidades.html)
     ====================================================== */
  async function initUnidades() {
    const listEl = qs("#lista-unidades");
    const filtroTipo = qs("#filtro-tipo");
    const buscaEl = qs("#busca-unidade");
    const btnGeo = qs("#btn-usar-localizacao");

    if (!listEl) return;

    let unidades = [];

    try {
      unidades = await fetchJSON("/api/unidades");
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `
        <article class="card" style="background:#fff1f2; border-color:#fecdd3;">
          <h3>Servidor indisponível</h3>
          <p class="muted">Não foi possível carregar as unidades a partir da API.</p>
        </article>
      `;
      return;
    }

    let userPos = null;

    function matchesFilters(u) {
      const tipo = (filtroTipo?.value || "todas").toLowerCase();
      if (tipo !== "todas" && String(u.tipo).toLowerCase() !== tipo) return false;

      const query = normalize(buscaEl?.value || "");
      if (query) {
        const hay = normalize(`${u.nome} ${u.bairro} ${u.endereco}`);
        if (!hay.includes(query)) return false;
      }
      return true;
    }

    function render() {
      const filtered = unidades.filter(matchesFilters);

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <article class="card">
            <h3>Nenhuma unidade encontrada</h3>
            <p class="muted">Tente mudar o tipo ou buscar por outro termo.</p>
          </article>
        `;
        return;
      }

      const cards = filtered
        .map((u) => {
          const nome = escapeHTML(u.nome || "Unidade");
          const tipo = escapeHTML(String(u.tipo || "").toUpperCase());
          const bairro = escapeHTML(u.bairro || "-");
          const end = escapeHTML(u.endereco || "-");
          const hor = escapeHTML(u.horario || "-");
          const fonteUrl = u.fonteUrl ? String(u.fonteUrl) : null;

          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            u.endereco || u.nome || ""
          )}`;

          const fonteBtn = fonteUrl
            ? `<a class="btn btn-outline" href="${escapeHTML(
                fonteUrl
              )}" target="_blank" rel="noopener noreferrer">Fonte (Prefeitura)</a>`
            : "";

          return `
            <article class="card">
              <h3 style="margin-top:0;">${nome}</h3>
              <p class="muted" style="margin:.25rem 0;">
                <strong>Tipo:</strong> ${tipo} • <strong>Bairro:</strong> ${bairro}
              </p>
              <p class="muted" style="margin:.25rem 0;"><strong>Endereço:</strong> ${end}</p>
              <p class="muted" style="margin:.25rem 0;"><strong>Horário:</strong> ${hor}</p>

              <div style="margin-top:.8rem; display:flex; gap:.6rem; flex-wrap:wrap;">
                <a class="btn btn-primary" href="${escapeHTML(
                  mapsUrl
                )}" target="_blank" rel="noopener noreferrer">Abrir no mapa</a>
                ${fonteBtn}
              </div>
            </article>
          `;
        })
        .join("");

      listEl.innerHTML = cards;
    }

    render();

    filtroTipo?.addEventListener("change", render);
    buscaEl?.addEventListener("input", render);

    btnGeo?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Seu navegador não suporta geolocalização.");
        return;
      }

      btnGeo.disabled = true;
      btnGeo.textContent = "Obtendo localização...";

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          btnGeo.textContent = "Localização ativada";
          btnGeo.disabled = false;
          render();
        },
        () => {
          btnGeo.textContent = "Usar minha localização";
          btnGeo.disabled = false;
          alert("Não foi possível obter sua localização. Verifique as permissões do navegador.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  /* ======================================================
     CONTATO (contato.html) - validação simples
     ====================================================== */
  function initContato() {
    const form = qs("#form-contato");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const nome = qs("#nome")?.value.trim();
      const email = qs("#email")?.value.trim();
      const msg = qs("#mensagem")?.value.trim();

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email || "");

      if (!nome || !email || !msg) {
        alert("Por favor, preencha todos os campos.");
        return;
      }
      if (!emailOk) {
        alert("Digite um e-mail válido.");
        return;
      }

      alert("Mensagem registrada (demonstração). Obrigado!");
      form.reset();
    });
  }

  /* -------------------- Inicialização -------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initMenuMobile();
    initTriagem();
    initUnidades();
    initContato();
  });
})();
