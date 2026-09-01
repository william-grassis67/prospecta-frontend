/**
 * js/leads.js
 * Lógica da funcionalidade "Encontrar Leads", Filtros e Mapa no Frontend.
 *
 * Integra com api.js, storage.js e message-auto.js da aplicação.
 */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("leadsSearchForm");
    if (!form) return;

    // --- Referências de Elementos do Formulário ---
    const smartSearchField = document.getElementById("leadsSmartSearch");
    const tipoField = document.getElementById("leadsTipo");
    const paisField = document.getElementById("leadsPais");
    const estadoField = document.getElementById("leadsEstado");
    const localizacaoField = document.getElementById("leadsLocalizacao");

    const submitButton = document.getElementById("leadsSearchSubmit");
    const searchAlert = document.getElementById("leadsSearchAlert");

    // --- Containers de Estado e Resultados ---
    const statusContainer = document.getElementById("leadsSearchStatus");
    const resultsContainer = document.getElementById("leadsResults");
    const resultsCount = document.getElementById("leadsResultsCount");
    const leadsListEl = document.getElementById("leadsList");

    // --- Elementos de Filtro ---
    const filterMostrarSelect = document.getElementById("filterMostrarSelect");
    const filterHasPhone = document.getElementById("filterHasPhone");
    const filterHasEmail = document.getElementById("filterHasEmail");
    const filterHasWebsite = document.getElementById("filterHasWebsite");
    const filterAnyContact = document.getElementById("filterAnyContact");
    const filterPhoneAndEmail = document.getElementById("filterPhoneAndEmail");
    const filterPhoneAndWebsite = document.getElementById("filterPhoneAndWebsite");
    const clearFiltersBtn = document.getElementById("clearLeadsFilters");

    // --- Elementos de Ordenação e Nível de Oportunidade (Lead Score) ---
    const filterOrdenarSelect = document.getElementById("filterOrdenarSelect");
    const filterScoreAlta = document.getElementById("filterScoreAlta");
    const filterScoreMedia = document.getElementById("filterScoreMedia");
    const filterScoreBaixa = document.getElementById("filterScoreBaixa");
    const filterScoreNaoQualificado = document.getElementById("filterScoreNaoQualificado");

    // --- Modal de Detalhes ---
    const detailsOverlay = document.getElementById("leadDetailsOverlay");
    const detailsClose = document.getElementById("leadDetailsClose");
    const detailsTitle = document.getElementById("leadDetailsTitle");
    const detailsBody = document.getElementById("leadDetailsBody");
    const detailsAddButton = document.getElementById("leadDetailsAddContact");
    const detailsAiButton = document.getElementById("leadDetailsAiBtn");

    // --- Estado Global do Módulo ---
    let allLeads = [];
    let filteredLeads = [];
    let addedIndexes = new Set();
    let currentDetailIndex = null;

    let map = null;
    let markers = [];
    let isSearching = false;
    // Guarda TODOS os parâmetros usados na última busca (antes só tipo/localizacao
    // eram guardados; pais e estado eram descartados e nunca chegavam ao payload
    // de "Adicionar aos contatos", mesmo tendo sido informados pelo usuário).
    let ultimaBuscaParams = { tipo: "", pais: "", estado: "", localizacao: "" };

    // --- Helper de Validação de Conteúdo ---
    function hasValue(val) {
        if (val === null || val === undefined) return false;
        const str = String(val).trim();
        return str !== "" && str.toLowerCase() !== "null" && str.toLowerCase() !== "undefined";
    }

    function formatField(val) {
        return hasValue(val) ? String(val).trim() : "Não informado";
    }

    // --- Reutilização de Autenticação Atual ---
    function getAuthToken() {
        if (typeof getToken === "function") {
            const token = getToken();
            if (token) return token;
        }
        return localStorage.getItem("token");
    }

    function handleUnauthorized() {
        showStatusMessage("Sua sessão expirou. Faça login novamente.");
        if (typeof showAlert === "function") {
            showAlert(searchAlert, "Sua sessão expirou. Faça login novamente.");
        }
    }

    // --- Busca Inteligente (nicho + localização em texto livre) ---
    if (smartSearchField) {
        smartSearchField.addEventListener("input", () => {
            const valor = smartSearchField.value.trim();
            if (!valor) return;

            const match = valor.match(/^(.+?)\s+em\s+(.+)$/i);

            if (match) {
                const nicho = match[1].trim();
                const local = match[2].trim();

                if (tipoField) tipoField.value = nicho;
                if (localizacaoField) localizacaoField.value = local;
            } else {
                if (tipoField) tipoField.value = valor;
            }
        });
    }

    const CATEGORIAS_CONHECIDAS = [
        "Dentista",
        "Restaurante",
        "Farmácia",
        "Clínica",
        "Academia",
        "Hotel",
        "Barbearia"
    ];

    function levenshteinDistance(a, b) {
        const s1 = a.toLowerCase();
        const s2 = b.toLowerCase();
        const dp = Array.from({ length: s1.length + 1 }, (_, i) => [i, ...Array(s2.length).fill(0)]);
        for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

        for (let i = 1; i <= s1.length; i++) {
            for (let j = 1; j <= s2.length; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[s1.length][s2.length];
    }

    function sugerirCorrecaoCategoria() {
        if (!tipoField) return;

        const valor = tipoField.value.trim();
        if (!valor) {
            removerSugestaoCategoria();
            return;
        }

        const correspondeExatamente = CATEGORIAS_CONHECIDAS.some(
            (cat) => cat.toLowerCase() === valor.toLowerCase()
        );
        if (correspondeExatamente) {
            removerSugestaoCategoria();
            return;
        }

        let melhorCategoria = null;
        let melhorDistancia = Infinity;

        CATEGORIAS_CONHECIDAS.forEach((cat) => {
            const distancia = levenshteinDistance(valor, cat);
            if (distancia < melhorDistancia) {
                melhorDistancia = distancia;
                melhorCategoria = cat;
            }
        });

        const limiteAceitavel = valor.length <= 4 ? 1 : 2;

        if (melhorCategoria && melhorDistancia > 0 && melhorDistancia <= limiteAceitavel) {
            mostrarSugestaoCategoria(melhorCategoria);
        } else {
            removerSugestaoCategoria();
        }
    }

    function mostrarSugestaoCategoria(categoriaSugerida) {
        if (!tipoField) return;

        const field = tipoField.closest(".field");
        if (!field) return;

        let hintEl = field.querySelector(".field__category-hint");
        if (!hintEl) {
            hintEl = document.createElement("p");
            hintEl.className = "field__category-hint";
            field.appendChild(hintEl);
        }

        hintEl.innerHTML = `Você quis dizer <button type="button" class="link-button" data-suggest-category="${escapeAttribute(categoriaSugerida)}">${escapeHtml(categoriaSugerida)}</button>?`;
    }

    function removerSugestaoCategoria() {
        if (!tipoField) return;
        const field = tipoField.closest(".field");
        if (!field) return;
        const hintEl = field.querySelector(".field__category-hint");
        if (hintEl) hintEl.remove();
    }

    if (tipoField) {
        tipoField.addEventListener("blur", sugerirCorrecaoCategoria);
        tipoField.addEventListener("input", () => {
            removerSugestaoCategoria();
        });
        tipoField.closest(".field")?.addEventListener("click", (event) => {
            const btn = event.target.closest("[data-suggest-category]");
            if (!btn) return;
            tipoField.value = btn.getAttribute("data-suggest-category");
            removerSugestaoCategoria();
            if (typeof clearFieldError === "function") clearFieldError(tipoField);
        });
    }

    // --- Submissão do Formulário de Busca ---
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isSearching) return;

        if (typeof hideAlert === "function") hideAlert(searchAlert);
        if (typeof clearFieldError === "function") {
            clearFieldError(tipoField);
            clearFieldError(paisField);
            clearFieldError(estadoField);
            clearFieldError(localizacaoField);
        }

        const tipo = tipoField ? tipoField.value.trim() : "";
        const pais = paisField ? paisField.value.trim() : "";
        const estado = estadoField ? estadoField.value.trim() : "";
        const localizacao = localizacaoField ? localizacaoField.value.trim() : "";

        let hasError = false;

        if (!tipo) {
            if (typeof showFieldError === "function") showFieldError(tipoField, "Informe o tipo de negócio.");
            hasError = true;
        }

        if (!pais) {
            if (typeof showFieldError === "function") showFieldError(paisField, "Informe o país.");
            hasError = true;
        }

        if (!localizacao) {
            if (typeof showFieldError === "function") showFieldError(localizacaoField, "Informe a cidade ou localização.");
            hasError = true;
        }

        if (hasError) return;

        await executarBuscaLeads({ tipo, pais, estado, localizacao });
    });

    // --- Execução da Requisição e Gestão de Estados ---
    async function executarBuscaLeads(params) {
        const token = getAuthToken();

        if (!token) {
            handleUnauthorized();
            return;
        }

        isSearching = true;
        setButtonLoading(submitButton, true, "Buscando leads...");
        showStatusMessage("Buscando leads...", "Aguarde enquanto consultamos os dados.");
        setResultsVisible(false);

        try {
            const leads = await searchLeadsRequest(
                params.tipo,
                params.pais,
                params.estado,
                params.localizacao,
                token
            );

            allLeads = Array.isArray(leads) ? leads : [];
            addedIndexes = new Set();
            ultimaBuscaParams = {
                tipo: params.tipo,
                pais: params.pais,
                estado: params.estado,
                localizacao: params.localizacao
            };

            if (allLeads.length === 0) {
                showStatusMessage("Nenhum lead encontrado para essa pesquisa.");
                setResultsVisible(false);
                return;
            }

            calcularScoresDosLeads(allLeads, ultimaBuscaParams);

            hideStatusMessage();
            setResultsVisible(true);

            resetFilterControls();

            ordenarLeadsPorScore(allLeads, "maior-score");
            filteredLeads = [...allLeads];

            updateUI();
            inicializarOuAtualizarMapa();

        } catch (error) {
            console.error("Erro na busca de leads:", error);
            setResultsVisible(false);

            const status = error.status;

            if (status === 401) {
                handleUnauthorized();
                return;
            }

            if (status === 403) {
                const msg = "Você não tem permissão para realizar esta busca.";
                showStatusMessage(msg);
                if (typeof showAlert === "function") showAlert(searchAlert, msg);
                return;
            }

            if (status === 400 || status === 404 || status === 500) {
                const backendMsg = isFriendlyBackendMessage(error.message) ? error.message : null;

                const fallback =
                    status === 500
                        ? "Não foi possível realizar a busca. Tente novamente."
                        : "Não foi possível encontrar essa localização. Verifique país, estado e cidade.";

                const finalMsg = backendMsg || fallback;

                showStatusMessage(finalMsg);
                if (typeof showAlert === "function") {
                    showAlert(searchAlert, finalMsg);
                }

                if (backendMsg && /categoria/i.test(backendMsg) && typeof showFieldError === "function" && tipoField) {
                    showFieldError(tipoField, backendMsg);
                }

                return;
            }

            const msg = error.message && error.message.includes("conectar")
                ? "Não foi possível conectar ao servidor."
                : (error.message || "Não foi possível conectar ao servidor.");

            showStatusMessage(msg);
            if (typeof showAlert === "function") {
                showAlert(searchAlert, msg);
            }
        } finally {
            isSearching = false;
            setButtonLoading(submitButton, false, "Buscar Leads");
        }
    }

    function isFriendlyBackendMessage(message) {
        if (!message || typeof message !== "string") return false;

        const trimmed = message.trim();
        if (!trimmed) return false;

        const technicalPatterns = [
            /exception/i,
            /\bat\s+[\w.$]+\(/,
            /java\.[a-z]+\./i,
            /caused by/i,
            /whitelabel/i,
            /stacktrace/i,
            /nullpointer/i,
            /internal server error/i
        ];

        if (technicalPatterns.some((pattern) => pattern.test(trimmed))) {
            return false;
        }

        if (trimmed.length > 300) return false;

        return true;
    }

    // --- Filtros Client-Side ---
    const filterInputs = [
        filterMostrarSelect,
        filterHasPhone,
        filterHasEmail,
        filterHasWebsite,
        filterAnyContact,
        filterPhoneAndEmail,
        filterPhoneAndWebsite
    ];

    filterInputs.forEach((input) => {
        if (input) {
            input.addEventListener("change", applyLeadFilters);
        }
    });

    const scoreFilterInputs = [
        filterOrdenarSelect,
        filterScoreAlta,
        filterScoreMedia,
        filterScoreBaixa,
        filterScoreNaoQualificado
    ];

    scoreFilterInputs.forEach((input) => {
        if (input) {
            input.addEventListener("change", applyLeadFilters);
        }
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", () => {
            resetFilterControls();
            filteredLeads = [...allLeads];
            updateUI();
        });
    }

    function applyLeadFilters() {
        if (allLeads.length === 0) return;

        const mostrarVal = filterMostrarSelect ? filterMostrarSelect.value : "todos";
        const needPhone = filterHasPhone ? filterHasPhone.checked : false;
        const needEmail = filterHasEmail ? filterHasEmail.checked : false;
        const needWebsite = filterHasWebsite ? filterHasWebsite.checked : false;
        const needAnyContact = filterAnyContact ? filterAnyContact.checked : false;
        const needPhoneAndEmail = filterPhoneAndEmail ? filterPhoneAndEmail.checked : false;
        const needPhoneAndWebsite = filterPhoneAndWebsite ? filterPhoneAndWebsite.checked : false;

        filteredLeads = allLeads.filter((lead) => {
            const hasPhone = hasValue(lead.telefone);
            const hasEmail = hasValue(lead.email);
            const hasWeb = hasValue(lead.website);
            const hasAny = hasPhone || hasEmail || hasWeb;

            if (mostrarVal === "telefone" && !hasPhone) return false;
            if (mostrarVal === "email" && !hasEmail) return false;
            if (mostrarVal === "website" && !hasWeb) return false;
            if (mostrarVal === "qualquer" && !hasAny) return false;

            if (needPhone && !hasPhone) return false;
            if (needEmail && !hasEmail) return false;
            if (needWebsite && !hasWeb) return false;

            if (needAnyContact && !hasAny) return false;
            if (needPhoneAndEmail && (!hasPhone || !hasEmail)) return false;
            if (needPhoneAndWebsite && (!hasPhone || !hasWeb)) return false;

            const niveisSelecionados = [];
            if (filterScoreAlta && filterScoreAlta.checked) niveisSelecionados.push("alta");
            if (filterScoreMedia && filterScoreMedia.checked) niveisSelecionados.push("media");
            if (filterScoreBaixa && filterScoreBaixa.checked) niveisSelecionados.push("baixa");
            if (filterScoreNaoQualificado && filterScoreNaoQualificado.checked) niveisSelecionados.push("nao-qualificado");

            if (niveisSelecionados.length > 0) {
                const nivelDoLead = lead.__scoreData ? lead.__scoreData.nivel : null;
                if (!niveisSelecionados.includes(nivelDoLead)) return false;
            }

            return true;
        });

        const ordem = filterOrdenarSelect ? filterOrdenarSelect.value : "maior-score";
        ordenarLeadsPorScore(filteredLeads, ordem);

        updateUI();
    }

    function resetFilterControls() {
        if (filterMostrarSelect) filterMostrarSelect.value = "todos";
        if (filterHasPhone) filterHasPhone.checked = false;
        if (filterHasEmail) filterHasEmail.checked = false;
        if (filterHasWebsite) filterHasWebsite.checked = false;
        if (filterAnyContact) filterAnyContact.checked = false;
        if (filterPhoneAndEmail) filterPhoneAndEmail.checked = false;
        if (filterPhoneAndWebsite) filterPhoneAndWebsite.checked = false;
        if (filterOrdenarSelect) filterOrdenarSelect.value = "maior-score";
        if (filterScoreAlta) filterScoreAlta.checked = false;
        if (filterScoreMedia) filterScoreMedia.checked = false;
        if (filterScoreBaixa) filterScoreBaixa.checked = false;
        if (filterScoreNaoQualificado) filterScoreNaoQualificado.checked = false;
    }

    // --- Lead Score ---
    function calcularScoresDosLeads(leads, searchParams) {
        if (typeof calculateLeadScore !== "function") {
            console.warn("[LEADLY] lead-scoring.js não carregado; Lead Score indisponível.");
            return;
        }

        leads.forEach((lead) => {
            lead.__scoreData = calculateLeadScore(lead, searchParams);
        });
    }

    function ordenarLeadsPorScore(leads, ordem) {
        leads.sort((a, b) => {
            const scoreA = a.__scoreData ? a.__scoreData.score : 0;
            const scoreB = b.__scoreData ? b.__scoreData.score : 0;
            return ordem === "menor-score" ? scoreA - scoreB : scoreB - scoreA;
        });
    }

    // --- Atualização da UI ---
    function updateUI() {
        updateResultsCount();
        renderizarCards(filteredLeads);
        atualizarMarcadoresMapa(filteredLeads);
    }

    function updateResultsCount() {
        if (!resultsCount) return;

        const total = allLeads.length;
        const count = filteredLeads.length;

        const isFiltered = total !== count;

        if (count === 0) {
            resultsCount.textContent = "Nenhum lead corresponde aos filtros selecionados.";
        } else if (isFiltered) {
            resultsCount.textContent = `${count} de ${total} lead${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;
        } else {
            resultsCount.textContent = `${total} lead${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`;
        }
    }

    function renderizarCards(leads) {
        if (!leadsListEl) return;

        if (leads.length === 0) {
            leadsListEl.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 2rem 1rem;">
                    <strong>Nenhum lead corresponde aos filtros selecionados.</strong>
                    <span>Tente desmarcar alguns filtros para voltar a visualizar os resultados.</span>
                </div>
            `;
            return;
        }

        leadsListEl.innerHTML = leads
            .map((lead) => {
                const indexOriginal = allLeads.indexOf(lead);
                return createCardHTML(lead, indexOriginal);
            })
            .join("");
    }

    function createCardHTML(lead, originalIndex) {
        const nome = formatField(lead.nome);
        const tipo = formatField(lead.tipo);
        const endereco = formatField(lead.endereco);
        const telefone = formatField(lead.telefone);
        const email = formatField(lead.email);
        const websiteRaw = lead.website;
        const websiteFormatted = formatField(websiteRaw);

        const isWebsiteValid = hasValue(websiteRaw);
        const alreadyAdded = addedIndexes.has(originalIndex);

        const scoreData = lead.__scoreData;

        return `
            <article class="lead-card" data-lead-index="${originalIndex}">
                <div class="lead-card__header">
                    <h3 class="lead-card__name">${escapeHtml(nome)}</h3>
                    <span class="badge badge--neutral">${escapeHtml(tipo)}</span>
                </div>

                ${scoreData ? renderScoreRowHTML(scoreData) : ""}

                <div class="lead-card__info">
                    <p class="lead-card__line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> <strong>Endereço:</strong> ${escapeHtml(endereco)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-phone" aria-hidden="true"></i> <strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-envelope" aria-hidden="true"></i> <strong>E-mail:</strong> ${escapeHtml(email)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-link" aria-hidden="true"></i> <strong>Website:</strong> ${
            isWebsiteValid
                ? `<a href="${escapeAttribute(websiteRaw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(websiteFormatted)}</a>`
                : escapeHtml(websiteFormatted)
        }</p>
                </div>

                ${scoreData ? renderScoreReasonsHTML(scoreData) : ""}

                <div class="lead-card__actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-details-index="${originalIndex}">
                        <i class="fa-solid fa-eye" aria-hidden="true"></i>
                        Ver detalhes
                    </button>
                    <button type="button" class="btn btn-ai btn-sm" data-ai-index="${originalIndex}">
                        ✨ LeadlyAI
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-add-index="${originalIndex}"
                        ${alreadyAdded ? "disabled" : ""}
                    >
                        <i class="fa-solid ${alreadyAdded ? "fa-check" : "fa-plus"}" aria-hidden="true"></i>
                        ${alreadyAdded ? "Adicionado" : "Adicionar aos contatos"}
                    </button>
                </div>
            </article>
        `;
    }

    function renderScoreRowHTML(scoreData) {
        const badgeClass =
            typeof getLeadScoreBadgeClass === "function"
                ? getLeadScoreBadgeClass(scoreData.nivel)
                : "";

        return `
            <div class="lead-card__score-row">
                <span class="lead-score-badge ${badgeClass}">
                    <i class="${escapeAttribute(scoreData.emoji)}" aria-hidden="true"></i>
                    ${escapeHtml(scoreData.label)} — ${scoreData.score}/100
                </span>
            </div>
        `;
    }

    function renderScoreReasonsHTML(scoreData) {
        if (!scoreData.motivos || scoreData.motivos.length === 0) return "";

        const itens = scoreData.motivos
            .map(
                (motivo) => `
                    <li class="${motivo.positivo ? "" : "is-negative"}">
                        <i class="${escapeAttribute(motivo.emoji)}" aria-hidden="true"></i>
                        ${escapeHtml(motivo.texto)}
                    </li>
                `
            )
            .join("");

        return `<ul class="lead-score-reasons">${itens}</ul>`;
    }

    // --- Integração e Atualização do Mapa ---
    function inicializarOuAtualizarMapa() {
        const mapEl = document.getElementById("leadsMap");
        if (!mapEl || typeof L === "undefined") return;

        if (!map) {
            map = L.map(mapEl);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap"
            }).addTo(map);
        }

        setTimeout(() => { map.invalidateSize(); }, 200);
    }

    function atualizarMarcadoresMapa(leads) {
        if (!map || typeof L === "undefined") return;

        markers.forEach((m) => map.removeLayer(m));
        markers = [];

        const bounds = [];

        leads.forEach((lead) => {
            const indexOriginal = allLeads.indexOf(lead);
            const lat = toValidNumber(lead.latitude);
            const lng = toValidNumber(lead.longitude);

            if (lat === null || lng === null) return;

            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup(createPopupHTML(lead, indexOriginal));

            marker.on("popupopen", (e) => {
                const popupNode = e.popup.getElement();
                if (!popupNode) return;
                const btn = popupNode.querySelector(`[data-popup-details-index="${indexOriginal}"]`);
                if (btn && !btn.dataset.hasListener) {
                    btn.dataset.hasListener = "true";
                    btn.addEventListener("click", () => {
                        abrirModalDetalhes(allLeads[indexOriginal], indexOriginal);
                    });
                }
            });

            markers.push(marker);
            bounds.push([lat, lng]);
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
    }

    function createPopupHTML(lead, originalIndex) {
        const nome = formatField(lead.nome);
        const endereco = formatField(lead.endereco);
        const telefone = formatField(lead.telefone);
        const scoreData = lead.__scoreData;

        return `
            <div class="lead-popup">
                <strong>${escapeHtml(nome)}</strong>
                ${scoreData ? `<div><i class="${escapeAttribute(scoreData.emoji)}" aria-hidden="true"></i> ${escapeHtml(scoreData.label)} — ${scoreData.score}/100</div>` : ""}
                <div><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(endereco)}</div>
                <div><i class="fa-solid fa-phone" aria-hidden="true"></i> ${escapeHtml(telefone)}</div>
                <button type="button" class="btn btn-secondary btn-sm lead-popup__btn" data-popup-details-index="${originalIndex}">
                    <i class="fa-solid fa-eye" aria-hidden="true"></i>
                    Ver detalhes
                </button>
            </div>
        `;
    }

    // --- Delegação de Eventos dos Botões nos Cards ---
    if (leadsListEl) {
        leadsListEl.addEventListener("click", (event) => {
            const detailsBtn = event.target.closest("[data-details-index]");
            if (detailsBtn) {
                const index = Number(detailsBtn.getAttribute("data-details-index"));
                if (!isNaN(index) && allLeads[index]) {
                    abrirModalDetalhes(allLeads[index], index);
                }
                return;
            }

            const aiBtn = event.target.closest("[data-ai-index]");
            if (aiBtn) {
                const index = Number(aiBtn.getAttribute("data-ai-index"));
                if (!isNaN(index) && allLeads[index]) {
                    if (typeof openLeadlyAIMessageModal === "function") {
                        openLeadlyAIMessageModal(allLeads[index]);
                    }
                }
                return;
            }

            const addBtn = event.target.closest("[data-add-index]");
            if (addBtn) {
                const index = Number(addBtn.getAttribute("data-add-index"));
                if (!isNaN(index) && allLeads[index]) {
                    adicionarAosContatosLocal(allLeads[index], index, addBtn);
                }
            }
        });
    }

    // --- Modal de Detalhes ---
    function abrirModalDetalhes(lead, index) {
        if (!lead || !detailsOverlay) return;

        currentDetailIndex = index;

        if (detailsTitle) {
            detailsTitle.textContent = formatField(lead.nome);
        }

        const scoreData = lead.__scoreData;

        const fields = [
            ["Nome", formatField(lead.nome)],
            ["Tipo de Negócio", formatField(lead.tipo)],
            ["Endereço", formatField(lead.endereco)],
            ["Telefone", formatField(lead.telefone)],
            ["E-mail", formatField(lead.email)],
            ["Website", hasValue(lead.website) ? `<a href="${escapeAttribute(lead.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(lead.website)}</a>` : "Não informado", true],
            ["Latitude", toValidNumber(lead.latitude) !== null ? lead.latitude : "Não informado"],
            ["Longitude", toValidNumber(lead.longitude) !== null ? lead.longitude : "Não informado"]
        ];

        if (scoreData) {
            fields.push([
                "Lead Score",
                `${renderScoreRowHTML(scoreData)}${renderScoreReasonsHTML(scoreData)}`,
                true
            ]);
        }

        if (detailsBody) {
            detailsBody.innerHTML = fields
                .map(([label, val, isHTML]) => `
                    <div class="lead-details-row">
                        <span class="lead-details-label">${escapeHtml(label)}:</span>
                        <span class="lead-details-value">${isHTML ? val : escapeHtml(String(val))}</span>
                    </div>
                `)
                .join("");
        }

        atualizarBotaoAdicionarModal();
        detailsOverlay.hidden = false;
        detailsOverlay.style.display = "flex";
    }

    function fecharModalDetalhes() {
        if (detailsOverlay) {
            detailsOverlay.hidden = true;
            detailsOverlay.style.display = "none";
        }
        currentDetailIndex = null;
    }

    if (detailsClose) detailsClose.addEventListener("click", fecharModalDetalhes);
    if (detailsOverlay) {
        detailsOverlay.addEventListener("click", (e) => {
            if (e.target === detailsOverlay) fecharModalDetalhes();
        });
    }

    if (detailsAddButton) {
        detailsAddButton.addEventListener("click", () => {
            if (currentDetailIndex === null) return;
            adicionarAosContatosLocal(allLeads[currentDetailIndex], currentDetailIndex, detailsAddButton);
        });
    }

    if (detailsAiButton) {
        detailsAiButton.addEventListener("click", () => {
            if (currentDetailIndex === null) return;
            const lead = allLeads[currentDetailIndex];
            fecharModalDetalhes();
            if (typeof openLeadlyAIMessageModal === "function") {
                openLeadlyAIMessageModal(lead);
            }
        });
    }

    function atualizarBotaoAdicionarModal() {
        if (!detailsAddButton) return;
        const alreadyAdded = currentDetailIndex !== null && addedIndexes.has(currentDetailIndex);
        detailsAddButton.disabled = alreadyAdded;
        detailsAddButton.innerHTML = alreadyAdded
            ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Adicionado'
            : '<i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar aos contatos';
    }

    /**
     * Converte um lead do RESULTADO DE BUSCA (formato transitório vindo de
     * /api/leads/search: nome, tipo, endereco, telefone, email, website,
     * latitude, longitude, __scoreData) no contrato canônico usado para
     * PERSISTIR o contato em /api/leads (LeadRequestDTO no backend):
     *
     *   id, nomeEmpresa, numeroTelefone, categoria, email, instagram,
     *   pais, cidade, estado, website, leadScore, status, prioridade,
     *   observacao, dataAdicionado, proximoContato
     *
     * Regras importantes:
     * - Nenhum campo é descartado por estar undefined: cada campo ausente
     *   vira `null` explicitamente (nunca uma chave que simplesmente some
     *   do objeto), então o backend sempre recebe o contrato completo.
     * - `pais`/`estado`/`cidade` não vêm no objeto de busca (o backend de
     *   busca não devolve isso por lead) — usamos os parâmetros da última
     *   busca (ultimaBuscaParams) como melhor aproximação disponível. Se no
     *   futuro /api/leads/search passar a devolver esses campos por lead,
     *   troque a fonte aqui para lead.pais / lead.cidade / lead.estado.
     * - `leadScore` já está calculado no frontend (lead-scoring.js) e
     *   simplesmente não estava sendo enviado — agora é incluído.
     * - `status`/`prioridade` recebem um valor inicial sensato no momento
     *   da criação; o backend também aplica esse default (dupla proteção),
     *   então mesmo que o frontend mude no futuro isso não quebra.
     */
    function montarPayloadCriacaoLead(lead) {
        const scoreData = lead.__scoreData;

        return {
            nomeEmpresa: hasValue(lead.nome) ? lead.nome.trim() : null,
            numeroTelefone: hasValue(lead.telefone) ? lead.telefone.trim() : null,
            categoria: hasValue(lead.tipo) ? lead.tipo.trim() : null,
            email: hasValue(lead.email) ? lead.email.trim() : null,
            instagram: hasValue(lead.instagram) ? lead.instagram.trim() : null,
            website: hasValue(lead.website) ? lead.website.trim() : null,
            pais: hasValue(ultimaBuscaParams.pais) ? ultimaBuscaParams.pais.trim() : null,
            cidade: hasValue(ultimaBuscaParams.localizacao) ? ultimaBuscaParams.localizacao.trim() : null,
            estado: hasValue(ultimaBuscaParams.estado) ? ultimaBuscaParams.estado.trim() : null,
            leadScore: scoreData && Number.isFinite(scoreData.score) ? scoreData.score : null,
            status: "NOVO",
            prioridade: "MEDIA",
            observacao: null,
            proximoContato: null
        };
    }

    // --- Adicionar aos Contatos (POST /api/leads) ---
    async function adicionarAosContatosLocal(lead, index, buttonEl) {
        if (!lead || addedIndexes.has(index)) return;

        const token = getAuthToken();
        if (!token) {
            handleUnauthorized();
            return;
        }

        const cardBtn = document.querySelector(`[data-add-index="${index}"]`);
        setAddButtonState(buttonEl, "loading");
        setAddButtonState(cardBtn, "loading");
        if (detailsAddButton && currentDetailIndex === index) {
            detailsAddButton.disabled = true;
            detailsAddButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Adicionando...';
        }

        const payload = montarPayloadCriacaoLead(lead);

        try {
            await createLeadRequest(payload, token);

            addedIndexes.add(index);
            setAddButtonState(buttonEl, "added");
            setAddButtonState(cardBtn, "added");
            atualizarBotaoAdicionarModal();

            if (typeof showAlert === "function") {
                showAlert(searchAlert, "Lead adicionado aos seus contatos com sucesso.");
                searchAlert.classList.remove("notice--error");
                searchAlert.classList.add("notice--success");
            }
        } catch (error) {
            console.error("[LEADLY] Erro ao adicionar lead aos contatos:", error);

            setAddButtonState(buttonEl, "idle");
            setAddButtonState(cardBtn, "idle");
            if (detailsAddButton && currentDetailIndex === index) {
                atualizarBotaoAdicionarModal();
            }

            if (error.status === 401) {
                handleUnauthorized();
                return;
            }

            let message = error.message || "Não foi possível adicionar este lead aos contatos.";
            if (error.status === 409) {
                addedIndexes.add(index);
                setAddButtonState(buttonEl, "added");
                setAddButtonState(cardBtn, "added");
                atualizarBotaoAdicionarModal();
                message = "Este lead já estava nos seus contatos.";
            }

            if (typeof showAlert === "function") {
                showAlert(searchAlert, message);
                searchAlert.classList.remove("notice--success");
                searchAlert.classList.add("notice--error");
            }
        }
    }

    function setAddButtonState(buttonEl, state) {
        if (!buttonEl) return;

        if (state === "loading") {
            buttonEl.disabled = true;
            buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Adicionando...';
        } else if (state === "added") {
            buttonEl.disabled = true;
            buttonEl.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Adicionado';
        } else {
            buttonEl.disabled = false;
            buttonEl.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar aos contatos';
        }
    }

    // --- Utilitários Visuais e Sanitização ---
    function setResultsVisible(visible) {
        if (resultsContainer) resultsContainer.hidden = !visible;
    }

    function showStatusMessage(title, subtitle = "") {
        if (!statusContainer) return;
        statusContainer.hidden = false;
        statusContainer.innerHTML = `
            <div class="empty-state">
                <strong>${escapeHtml(title)}</strong>
                ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
            </div>
        `;
    }

    function hideStatusMessage() {
        if (statusContainer) statusContainer.hidden = true;
    }

    function setButtonLoading(button, isLoading, text) {
        if (!button) return;
        button.disabled = isLoading;
        button.textContent = text;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttribute(str) {
        return String(str).replace(/"/g, "&quot;");
    }

    function toValidNumber(val) {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
    }
});