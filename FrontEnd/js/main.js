/* ======================================================
   Guia Saúde - main.js (vanilla JS)
   - Conteúdo dinâmico via fetch GET (API própria)
   - Triagem mostra orientação + unidades sugeridas (Prefeitura como referência)
   - Página Unidades: lista + filtro + mapa + fonte
   ====================================================== */

(function () {
  "use strict";

  // Ajuste a porta aqui se seu backend estiver em outra:
  // FastAPI recomendado: uvicorn ... --port 3333
  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3333"
      : "";

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

  async function fetchJSON(path, fallback) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return fallback;
    }
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

  /* -------------------- Fallback (mock) -------------------- */
  // Sintomas / orientações (fallback caso API não esteja rodando ainda)
  const FALLBACK_SINTOMAS = [
    { id: "febre", nome: "Febre", peso: 2, categoria: "Geral" },
    { id: "tosse", nome: "Tosse", peso: 1, categoria: "Respiratório" },
    { id: "dor_garganta", nome: "Dor de garganta", peso: 1, categoria: "Respiratório" },
    { id: "dor_cabeca", nome: "Dor de cabeça", peso: 1, categoria: "Geral" },
    { id: "vomitos", nome: "Vômitos persistentes", peso: 2, categoria: "Gastro" },
    { id: "diarreia", nome: "Diarreia", peso: 1, categoria: "Gastro" },
    { id: "dor_abdominal_intensa", nome: "Dor abdominal intensa", peso: 3, categoria: "Gastro" },
    { id: "falta_ar", nome: "Falta de ar", peso: 5, categoria: "Alerta" },
    { id: "dor_peito", nome: "Dor forte no peito", peso: 6, categoria: "Alerta" },
    { id: "desmaio_confusao", nome: "Desmaio/confusão", peso: 6, categoria: "Alerta" },
  ];

  const FALLBACK_ORIENTACOES = {
    sinaisAlerta: ["falta_ar", "dor_peito", "desmaio_confusao"],
    mensagens: {
      emergencia:
        "Procure atendimento imediato (UPA/Hospital). Se possível, peça ajuda e não dirija se estiver mal.",
      upa: "Procure uma UPA/atendimento de urgência para avaliação em tempo curto.",
      ubs: "Procure uma UBS/atenção primária para avaliação e orientações.",
    },
    dicasGerais: [
      "Mantenha hidratação (se tolerado).",
      "Descanse e observe evolução dos sintomas.",
      "Se piorar, procure atendimento.",
    ],
  };

  // Unidades (referência Prefeitura) — fallback
  const FALLBACK_UNIDADES = [
    {
      id: 13,
      nome: "Hospital Municipal Dr. Eudásio Barroso",
      tipo: "hospital",
      endereco: "RUA DOUTOR EUDASIO BARROSO, 2324 - CENTRO - EM FRENTE A PRAÇA - QUIXADÁ",
      bairro: "Centro",
      horario: "24 H",
      telefone: null,
      email: null,
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=13",
    },
    {
      id: 97,
      nome: "UPA 24H de Quixadá",
      tipo: "upa",
      endereco: "RUA DOS VOLUNTARIOS, SN - PLANALTO RENASCER - QUIXADÁ",
      bairro: "Planalto Renascer",
      horario: "SEMPRE ABERTO",
      telefone: null,
      email: null,
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=97",
    },
    {
      id: 17,
      nome: "Posto de Saúde do Centro",
      tipo: "ubs",
      endereco: "RUA EPITACIO PESSOA, S/N - CENTRO - ZONA URBANA - QUIXADÁ",
      bairro: "Centro",
      horario: "SEGUNDA À QUINTA: 7:30–11:30 / 13:30–17:30; SEXTA: 7:30–13:30",
      telefone: null,
      email: null,
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=17",
    },
    {
      id: 18,
      nome: "Posto de Saúde do Combate",
      tipo: "ubs",
      endereco: "RUA JOSÉ ENEAS MONTEIRO LESSA, S/N - COMBATE - ZONA URBANA - QUIXADÁ",
      bairro: "Combate",
      horario: "SEGUNDA À QUINTA: 7:30–11:30 / 13:30–17:30; SEXTA: 7:30–13:30",
      telefone: null,
      email: null,
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=18",
    },
    {
      id: 92,
      nome: "UBS de Carrascal",
      tipo: "ubs",
      endereco: "RUA JOSE DE QUEIROZ PESSOA, 3641 - CARRASCAL - QUIXADÁ",
      bairro: "Carrascal",
      horario: "SEGUNDA À QUINTA: 7:30–11:30 / 13:30–17:30; SEXTA: 7:30–13:30",
      telefone: null,
      email: null,
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=92",
    },
    {
      id: 1,
      nome: "UBS Eliezer Fortes Magalhães (Cipó dos Anjos)",
      tipo: "ubs",
      endereco: "DISTRITO CIPÓ DOS ANJOS, SN - CIPÓ DOS ANJOS - QUIXADÁ",
      bairro: "Cipó dos Anjos",
      horario: "07:30 AS 17:00",
      telefone: null,
      email: "cipodosanjosubs@gmail.com",
      fonteUrl: "https://quixada.ce.gov.br/unidadesaude.php?id=1",
    },
  ];

  /* ======================================================
     TRIAGEM (triagem.html)
     - carrega sintomas + orientações
     - gera resultado
     - lista unidades sugeridas conforme direcionamento
     ====================================================== */
  async function initTriagem() {
    const listEl = qs("#lista-sintomas");
    const searchEl = qs("#busca-sintoma");
    const btnGerar = qs("#btn-gerar-orientacao");
    const btnLimpar = qs("#btn-limpar-sintomas");
    const resultEl = qs("#resultado-triagem");

    if (!listEl || !btnGerar || !resultEl) return;

    const sintomas = await fetchJSON("/api/sintomas", FALLBACK_SINTOMAS);
    const orientacoes = await fetchJSON("/api/orientacoes", FALLBACK_ORIENTACOES);

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
        (orientacoes.sinaisAlerta || []).includes(String(id))
      );

      return { score, hasAlerta };
    }

    function getRecommendation({ score, hasAlerta }) {
      // Informativo (não diagnóstico)
      if (hasAlerta) return { nivel: "Alta urgência", destino: "hospital", key: "emergencia" };
      if (score >= 6) return { nivel: "Urgência moderada", destino: "upa", key: "upa" };
      return { nivel: "Baixa urgência", destino: "ubs", key: "ubs" };
    }

    async function carregarUnidadesParaRecomendacao(rec) {
      // Se for "hospital", faz sentido mostrar também UPA (direcionamento: UPA/Hospital)
      const tipos = rec.destino === "hospital" ? ["hospital", "upa"] : [rec.destino];

      const results = await Promise.all(
        tipos.map(async (t) => {
          const fallback = FALLBACK_UNIDADES.filter((u) => String(u.tipo).toLowerCase() === t);
          const data = await fetchJSON(`/api/unidades?tipo=${encodeURIComponent(t)}`, fallback);
          return Array.isArray(data) ? data : [];
        })
      );

      // Achata
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

      // Mostra no máximo 3 para ficar limpo (mude para 5 se quiser)
      const top = unidades.slice(0, 3);

      containerEl.innerHTML = `
        <div class="card" style="background:#f8fafc;">
          <h3 style="margin-top:0;">Unidades sugeridas</h3>
          <p class="muted" style="margin:.25rem 0 .75rem;">
            Baseado no direcionamento acima, aqui estão algumas opções:
          </p>

          <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            ${top
              .map((u) => {
                const nome = escapeHTML(u.nome || "Unidade");
                const tipo = escapeHTML(String(u.tipo || "").toUpperCase());
                const bairro = escapeHTML(u.bairro || "-");
                const end = escapeHTML(u.endereco || "-");
                const hor = escapeHTML(u.horario || "-");
                const tel = escapeHTML(u.telefone || "-");
                const email = escapeHTML(u.email || "-");
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
                    <p class="muted" style="margin:.15rem 0;"><strong>Telefone:</strong> ${tel}</p>
                    <p class="muted" style="margin:.15rem 0;"><strong>E-mail:</strong> ${email}</p>

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

          <p class="muted" style="margin:.75rem 0 0;">
            Observação: esta lista é informativa e pode não refletir lotação/atendimento no momento.
          </p>
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

      const msg = orientacoes.mensagens?.[rec.key] || "Procure atendimento se necessário.";
      const dicas = Array.isArray(orientacoes.dicasGerais) ? orientacoes.dicasGerais : [];

      // Render inicial (com placeholder das unidades)
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

      // Carregar e renderizar unidades sugeridas
      const containerUnidades = qs("#resultado-unidades", resultEl);
      const unidades = await carregarUnidadesParaRecomendacao(rec);
      renderUnidadesNoResultado(containerUnidades, unidades);
    }

    // Inicial
    renderSintomas("");

    // Busca
    searchEl?.addEventListener("input", (e) => renderSintomas(e.target.value));

    // Botões
    btnGerar.addEventListener("click", async () => {
      await renderResult(getSelectedIds());
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
     - lista unidades via API (ou fallback)
     - filtro e busca
     - geolocalização: sem lat/lng não calcula distância, mas mantém o recurso
     ====================================================== */
  async function initUnidades() {
    const listEl = qs("#lista-unidades");
    const filtroTipo = qs("#filtro-tipo");
    const buscaEl = qs("#busca-unidade");
    const btnGeo = qs("#btn-usar-localizacao");

    if (!listEl) return;

    const unidades = await fetchJSON("/api/unidades", FALLBACK_UNIDADES);
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

      // Aviso se localização foi ativada mas não temos lat/lng
      const hasCoords = filtered.some((u) => u.lat != null && u.lng != null);
      const topoAviso =
        userPos && !hasCoords
          ? `
            <article class="card" style="background:#eff6ff; border-color:#bfdbfe;">
              <h3 style="margin-top:0;">Localização ativada</h3>
              <p class="muted" style="margin:0;">
                As unidades não possuem coordenadas (lat/lng), então não dá para calcular “mais próxima”.
                Use <strong>Abrir no mapa</strong> para ver a unidade no Google Maps pelo endereço.
              </p>
            </article>
          `
          : "";

      const cards = filtered
        .map((u) => {
          const nome = escapeHTML(u.nome || "Unidade");
          const tipo = escapeHTML(String(u.tipo || "").toUpperCase());
          const bairro = escapeHTML(u.bairro || "-");
          const end = escapeHTML(u.endereco || "-");
          const hor = escapeHTML(u.horario || "-");
          const tel = escapeHTML(u.telefone || "-");
          const email = escapeHTML(u.email || "-");
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
              <p class="muted" style="margin:.25rem 0;"><strong>Telefone:</strong> ${tel}</p>
              <p class="muted" style="margin:.25rem 0;"><strong>E-mail:</strong> ${email}</p>

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

      listEl.innerHTML = topoAviso + cards;
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
    initTriagem();
    initUnidades();
    initContato();
  });
})();
