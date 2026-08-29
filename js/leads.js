/**
 * js/leads.js
 * Lógica da funcionalidade "Encontrar Leads", Filtros e Mapa no Frontend.
 *
 * Integra com api.js e storage.js da aplicação.
 */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("leadsSearchForm");
    if (!form) return;

    // --- Referências de Elementos do Formulário ---
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

    // --- Modal de Detalhes ---
    const detailsOverlay = document.getElementById("leadDetailsOverlay");
    const detailsClose = document.getElementById("leadDetailsClose");
    const detailsTitle = document.getElementById("leadDetailsTitle");
    const detailsBody = document.getElementById("leadDetailsBody");
    const detailsAddButton = document.getElementById("leadDetailsAddContact");

    // --- Estado Global do Módulo ---
    let allLeads = [];
    let filteredLeads = [];
    let addedIndexes = new Set();
    let currentDetailIndex = null;

    let map = null;
    let markers = [];
    let isSearching = false;

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
            // Utiliza o sistema de API centralizado do api.js
            const leads = await searchLeadsRequest(
                params.tipo,
                params.pais,
                params.estado,
                params.localizacao,
                token
            );

            allLeads = Array.isArray(leads) ? leads : [];
            addedIndexes = new Set();

            if (allLeads.length === 0) {
                showStatusMessage("Nenhum lead encontrado para essa pesquisa.");
                setResultsVisible(false);
                return;
            }

            hideStatusMessage();
            setResultsVisible(true);

            // Reseta controles de filtro
            resetFilterControls();
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
                showStatusMessage("Você não tem permissão para realizar esta busca.");
                if (typeof showAlert === "function") {
                    showAlert(searchAlert, "Você não tem permissão para realizar esta busca.");
                }
                return;
            }

            if (status === 400 || status === 404) {
                showStatusMessage("Não foi possível encontrar essa localização. Verifique país, estado e cidade.");
                if (typeof showAlert === "function") {
                    showAlert(searchAlert, "Não foi possível encontrar essa localização. Verifique país, estado e cidade.");
                }
                return;
            }

            if (status === 500) {
                showStatusMessage("Não foi possível realizar a busca. Tente novamente.");
                if (typeof showAlert === "function") {
                    showAlert(searchAlert, "Não foi possível realizar a busca. Tente novamente.");
                }
                return;
            }

            // Tratamento de Erro de Conexão / Rede ou Mensagem Genérica
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

    // --- Filtros Client-Side (Tempo Real) ---
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

            // Filtro Select
            if (mostrarVal === "telefone" && !hasPhone) return false;
            if (mostrarVal === "email" && !hasEmail) return false;
            if (mostrarVal === "website" && !hasWeb) return false;
            if (mostrarVal === "qualquer" && !hasAny) return false;

            // Checkboxes de contatos individuais
            if (needPhone && !hasPhone) return false;
            if (needEmail && !hasEmail) return false;
            if (needWebsite && !hasWeb) return false;

            // Checkboxes de combinações
            if (needAnyContact && !hasAny) return false;
            if (needPhoneAndEmail && (!hasPhone || !hasEmail)) return false;
            if (needPhoneAndWebsite && (!hasPhone || !hasWeb)) return false;

            return true;
        });

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
    }

    // --- Atualização da UI (Cards, Contador, Mapa) ---
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

        return `
            <article class="lead-card" data-lead-index="${originalIndex}">
                <div class="lead-card__header">
                    <h3 class="lead-card__name">${escapeHtml(nome)}</h3>
                    <span class="badge badge--neutral">${escapeHtml(tipo)}</span>
                </div>

                <div class="lead-card__info">
                    <p class="lead-card__line">📍 <strong>Endereço:</strong> ${escapeHtml(endereco)}</p>
                    <p class="lead-card__line">📞 <strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
                    <p class="lead-card__line">✉ <strong>E-mail:</strong> ${escapeHtml(email)}</p>
                    <p class="lead-card__line">🔗 <strong>Website:</strong> ${
            isWebsiteValid
                ? `<a href="${escapeAttribute(websiteRaw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(websiteFormatted)}</a>`
                : escapeHtml(websiteFormatted)
        }</p>
                </div>

                <div class="lead-card__actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-details-index="${originalIndex}">
                        Ver detalhes
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-add-index="${originalIndex}"
                        ${alreadyAdded ? "disabled" : ""}
                    >
                        ${alreadyAdded ? "✓ Adicionado" : "Adicionar aos contatos"}
                    </button>
                </div>
            </article>
        `;
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

        // Remove marcadores antigos
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

        return `
            <div class="lead-popup">
                <strong>${escapeHtml(nome)}</strong>
                <div>📍 ${escapeHtml(endereco)}</div>
                <div>📞 ${escapeHtml(telefone)}</div>
                <button type="button" class="btn btn-secondary btn-sm lead-popup__btn" data-popup-details-index="${originalIndex}">
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

    function atualizarBotaoAdicionarModal() {
        if (!detailsAddButton) return;
        const alreadyAdded = currentDetailIndex !== null && addedIndexes.has(currentDetailIndex);
        detailsAddButton.disabled = alreadyAdded;
        detailsAddButton.textContent = alreadyAdded ? "✓ Adicionado" : "Adicionar aos contatos";
    }

    // --- Adicionar aos Contatos (Frontend Local) ---
    async function adicionarAosContatosLocal(lead, index, buttonEl) {
        if (!lead || addedIndexes.has(index)) return;

        addedIndexes.add(index);

        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.textContent = "✓ Adicionado";
        }

        const cardBtn = document.querySelector(`[data-add-index="${index}"]`);
        if (cardBtn) {
            cardBtn.disabled = true;
            cardBtn.textContent = "✓ Adicionado";
        }

        atualizarBotaoAdicionarModal();

        // Tenta enviar para o backend caso exista /api/contacts no futuro
        const token = getAuthToken();
        if (token && typeof addContactRequest === "function") {
            try {
                await addContactRequest({
                    name: lead.nome,
                    address: lead.endereco,
                    phone: lead.telefone,
                    website: lead.website,
                    latitude: lead.latitude,
                    longitude: lead.longitude,
                    category: lead.tipo
                }, token);
            } catch (err) {
                console.info("[LEADLY] Backend ainda sem suporte a salvar contatos ou rota indisponível:", err.message);
            }
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