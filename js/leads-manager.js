/**
 * js/leads-manager.js
 * Lógica da seção "Meus Leads" (dashboard.html): listar, ver detalhes,
 * editar e excluir os leads salvos pelo usuário.
 *
 * Endpoints:
 * - GET    /api/leads
 * - GET    /api/leads/{id}
 * - PUT    /api/leads/{id}
 * - DELETE /api/leads/{id}
 *
 * Depende de: config.js, api.js, storage.js, ui-helpers.js, message-auto.js
 * (carregados antes deste arquivo em dashboard.html).
 */

document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("meus-leads");
    if (!section) return;

    const statusContainer = document.getElementById("myLeadsStatus");
    const listContainer = document.getElementById("myLeadsList");
    const alertBox = document.getElementById("myLeadsAlert");
    const refreshBtn = document.getElementById("myLeadsRefreshBtn");

    // Modal de detalhes
    const detailsOverlay = document.getElementById("myLeadDetailsOverlay");
    const detailsClose = document.getElementById("myLeadDetailsClose");
    const detailsTitle = document.getElementById("myLeadDetailsTitle");
    const detailsBody = document.getElementById("myLeadDetailsBody");
    const detailsEditBtn = document.getElementById("myLeadDetailsEditBtn");
    const detailsDeleteBtn = document.getElementById("myLeadDetailsDeleteBtn");
    const detailsAiBtn = document.getElementById("myLeadDetailsAiBtn");

    // Modal de edição
    const editOverlay = document.getElementById("leadEditOverlay");
    const editClose = document.getElementById("leadEditClose");
    const editForm = document.getElementById("leadEditForm");
    const editAlert = document.getElementById("leadEditAlert");
    const editSubmit = document.getElementById("leadEditSubmit");

    // ATENÇÃO: os campos abaixo (cidade/estado/pais/status/prioridade/
    // observacao/proximoContato) só terão efeito se esses elementos
    // existirem no HTML do modal de edição (dashboard.html). Se ainda não
    // existirem, os getElementById retornam null e o código simplesmente
    // ignora esses campos (não quebra nada) — mas o usuário não conseguirá
    // editá-los até que os inputs correspondentes sejam adicionados com
    // esses mesmos IDs.
    const editFields = {
        name: document.getElementById("editName"),
        category: document.getElementById("editCategory"),
        phone: document.getElementById("editPhone"),
        email: document.getElementById("editEmail"),
        address: document.getElementById("editAddress"), // legado: mapeado para "cidade" no envio
        cidade: document.getElementById("editCidade"),
        estado: document.getElementById("editEstado"),
        pais: document.getElementById("editPais"),
        website: document.getElementById("editWebsite"),
        instagram: document.getElementById("editInstagram"),
        status: document.getElementById("editStatus"),
        prioridade: document.getElementById("editPrioridade"),
        observacao: document.getElementById("editObservacao"),
        proximoContato: document.getElementById("editProximoContato")
    };

    let myLeads = [];
    let currentLeadId = null;
    let hasLoadedOnce = false;
    let isLoading = false;

    /* =========================================================
       AUTENTICAÇÃO
       ========================================================= */
    function getAuthToken() {
        if (typeof getToken === "function") {
            const token = getToken();
            if (token) return token;
        }
        return localStorage.getItem("token");
    }

    /* =========================================================
       CARREGAMENTO INICIAL
       ========================================================= */
    carregarMeusLeads();

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => carregarMeusLeads());
    }

    const navMeusLeads = document.getElementById("navMeusLeads");
    if (navMeusLeads) {
        navMeusLeads.addEventListener("click", () => {
            if (hasLoadedOnce && !isLoading) return;
        });
    }

    async function carregarMeusLeads() {
        const token = getAuthToken();

        if (!token) {
            showStatus("Sua sessão expirou. Faça login novamente para ver seus leads.");
            return;
        }

        isLoading = true;
        hideAlertBox();
        setListVisible(false);
        showStatus("Carregando seus leads...", "Aguarde um instante.", true);
        setRefreshLoading(true);

        try {
            const leads = await getMyLeadsRequest(token);
            myLeads = Array.isArray(leads) ? leads : [];
            hasLoadedOnce = true;

            if (myLeads.length === 0) {
                showStatus(
                    "Você ainda não possui leads salvos.",
                    'Use a busca em "Encontrar Leads" e clique em "Adicionar aos contatos" para começar.'
                );
                setListVisible(false);
                return;
            }

            hideStatus();
            setListVisible(true);
            renderMyLeadsList();

        } catch (error) {
            console.error("[LEADLY] Erro ao carregar Meus Leads:", error);
            setListVisible(false);

            if (error.status === 401 || error.status === 403) {
                showStatus("Sua sessão expirou. Faça login novamente para ver seus leads.");
                return;
            }

            const message = error.message || "Não foi possível carregar seus leads. Tente novamente.";
            showStatus("Não foi possível carregar seus leads.", message);
            showAlertBox(message);
        } finally {
            isLoading = false;
            setRefreshLoading(false);
        }
    }

    /* =========================================================
       NORMALIZAÇÃO DE CAMPOS
       ========================================================= */
    function getLeadId(lead) {
        return lead && (lead.id ?? lead.leadId ?? lead._id);
    }

    function getLeadField(lead, ...keys) {
        for (const key of keys) {
            if (lead && lead[key] !== undefined && lead[key] !== null && String(lead[key]).trim() !== "") {
                return lead[key];
            }
        }
        return null;
    }

    function formatField(val) {
        return val !== null && val !== undefined && String(val).trim() !== "" ? String(val).trim() : "Não informado";
    }

    /**
     * Monta "Cidade - Estado, País" a partir dos campos canônicos do
     * backend. Mantém fallback para o antigo campo único "address"/
     * "endereco" (contatos criados antes desta correção podem não ter
     * cidade/estado/pais preenchidos).
     */
    function formatLocation(lead) {
        const cidade = getLeadField(lead, "cidade");
        const estado = getLeadField(lead, "estado");
        const pais = getLeadField(lead, "pais");

        const partes = [];
        if (cidade && estado) partes.push(`${cidade} - ${estado}`);
        else if (cidade) partes.push(cidade);
        else if (estado) partes.push(estado);

        if (pais) partes.push(pais);

        if (partes.length > 0) return partes.join(", ");

        return formatField(getLeadField(lead, "address", "endereco"));
    }

    /* =========================================================
       RENDERIZAÇÃO DA LISTA
       ========================================================= */
    function renderMyLeadsList() {
        if (!listContainer) return;

        listContainer.innerHTML = myLeads.map((lead) => createMyLeadCardHTML(lead)).join("");
    }

    function createMyLeadCardHTML(lead) {
        const id = getLeadId(lead);
        const nome = formatField(getLeadField(lead, "nomeEmpresa", "name", "nome"));
        const categoria = getLeadField(lead, "categoria", "category", "tipo");
        const telefone = formatField(getLeadField(lead, "numeroTelefone", "phone", "telefone"));
        const email = formatField(getLeadField(lead, "email"));
        const localizacao = formatLocation(lead);
        const websiteRaw = getLeadField(lead, "website");
        const isWebsiteValid = !!websiteRaw;
        const leadScore = getLeadField(lead, "leadScore");
        const status = getLeadField(lead, "status");
        const prioridade = getLeadField(lead, "prioridade");

        return `
            <article class="lead-card" data-my-lead-id="${escapeAttribute(id)}">
                <div class="lead-card__header">
                    <h3 class="lead-card__name">${escapeHtml(nome)}</h3>
                    ${categoria ? `<span class="badge badge--neutral">${escapeHtml(categoria)}</span>` : ""}
                    ${status ? `<span class="badge badge--neutral">${escapeHtml(status)}</span>` : ""}
                </div>

                <div class="lead-card__info">
                    <p class="lead-card__line"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> <strong>Localização:</strong> ${escapeHtml(localizacao)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-phone" aria-hidden="true"></i> <strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-envelope" aria-hidden="true"></i> <strong>E-mail:</strong> ${escapeHtml(email)}</p>
                    <p class="lead-card__line"><i class="fa-solid fa-link" aria-hidden="true"></i> <strong>Website:</strong> ${
            isWebsiteValid
                ? `<a href="${escapeAttribute(websiteRaw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(websiteRaw)}</a>`
                : "Não informado"
        }</p>
                    ${leadScore !== null ? `<p class="lead-card__line"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> <strong>Lead Score:</strong> ${escapeHtml(String(leadScore))}/100</p>` : ""}
                    ${prioridade ? `<p class="lead-card__line"><i class="fa-solid fa-flag" aria-hidden="true"></i> <strong>Prioridade:</strong> ${escapeHtml(prioridade)}</p>` : ""}
                </div>

                <div class="lead-card__actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-my-lead-details="${escapeAttribute(id)}">
                        <i class="fa-solid fa-eye" aria-hidden="true"></i>
                        Ver detalhes
                    </button>
                    <button type="button" class="btn btn-ai btn-sm" data-my-lead-ai="${escapeAttribute(id)}">
                        ✨ LeadlyAI
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" data-my-lead-edit="${escapeAttribute(id)}">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                        Editar
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" data-my-lead-delete="${escapeAttribute(id)}">
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                        Excluir
                    </button>
                </div>
            </article>
        `;
    }

    if (listContainer) {
        listContainer.addEventListener("click", (event) => {
            const detailsBtn = event.target.closest("[data-my-lead-details]");
            if (detailsBtn) {
                abrirDetalhes(detailsBtn.getAttribute("data-my-lead-details"));
                return;
            }

            const aiBtn = event.target.closest("[data-my-lead-ai]");
            if (aiBtn) {
                const leadId = aiBtn.getAttribute("data-my-lead-ai");
                const lead = findLeadById(leadId);
                if (lead && typeof openLeadlyAIMessageModal === "function") {
                    openLeadlyAIMessageModal(lead);
                }
                return;
            }

            const editBtn = event.target.closest("[data-my-lead-edit]");
            if (editBtn) {
                abrirEdicao(editBtn.getAttribute("data-my-lead-edit"));
                return;
            }

            const deleteBtn = event.target.closest("[data-my-lead-delete]");
            if (deleteBtn) {
                excluirLead(deleteBtn.getAttribute("data-my-lead-delete"), deleteBtn);
            }
        });
    }

    function findLeadById(id) {
        return myLeads.find((lead) => String(getLeadId(lead)) === String(id));
    }

    /* =========================================================
       MODAL DE DETALHES
       ========================================================= */
    function abrirDetalhes(id) {
        const lead = findLeadById(id);
        if (!lead || !detailsOverlay) return;

        currentLeadId = id;

        if (detailsTitle) {
            detailsTitle.textContent = formatField(getLeadField(lead, "nomeEmpresa", "name", "nome"));
        }

        const website = getLeadField(lead, "website");
        const instagram = getLeadField(lead, "instagram");
        const leadScore = getLeadField(lead, "leadScore");
        const dataAdicionado = getLeadField(lead, "dataAdicionado");
        const proximoContato = getLeadField(lead, "proximoContato");

        const fields = [
            ["Nome", formatField(getLeadField(lead, "nomeEmpresa", "name", "nome"))],
            ["Categoria", formatField(getLeadField(lead, "categoria", "category", "tipo"))],
            ["Localização", formatLocation(lead)],
            ["Telefone", formatField(getLeadField(lead, "numeroTelefone", "phone", "telefone"))],
            ["E-mail", formatField(getLeadField(lead, "email"))],
            ["Website", website ? `<a href="${escapeAttribute(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : "Não informado", true],
            ["Instagram", instagram ? `<a href="${escapeAttribute(instagram)}" target="_blank" rel="noopener noreferrer">${escapeHtml(instagram)}</a>` : "Não informado", true],
            ["Lead Score", leadScore !== null ? `${leadScore}/100` : "Não informado"],
            ["Status", formatField(getLeadField(lead, "status"))],
            ["Prioridade", formatField(getLeadField(lead, "prioridade"))],
            ["Observação", formatField(getLeadField(lead, "observacao"))],
            ["Adicionado em", formatField(dataAdicionado)],
            ["Próximo contato", formatField(proximoContato)]
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

        detailsOverlay.hidden = false;
        detailsOverlay.style.display = "flex";
    }

    function fecharDetalhes() {
        if (detailsOverlay) {
            detailsOverlay.hidden = true;
            detailsOverlay.style.display = "none";
        }
    }

    if (detailsClose) detailsClose.addEventListener("click", fecharDetalhes);
    if (detailsOverlay) {
        detailsOverlay.addEventListener("click", (e) => {
            if (e.target === detailsOverlay) fecharDetalhes();
        });
    }
    if (detailsAiBtn) {
        detailsAiBtn.addEventListener("click", () => {
            if (currentLeadId !== null) {
                const lead = findLeadById(currentLeadId);
                fecharDetalhes();
                if (lead && typeof openLeadlyAIMessageModal === "function") {
                    openLeadlyAIMessageModal(lead);
                }
            }
        });
    }
    if (detailsEditBtn) {
        detailsEditBtn.addEventListener("click", () => {
            fecharDetalhes();
            if (currentLeadId !== null) abrirEdicao(currentLeadId);
        });
    }
    if (detailsDeleteBtn) {
        detailsDeleteBtn.addEventListener("click", () => {
            if (currentLeadId !== null) {
                excluirLead(currentLeadId, detailsDeleteBtn, fecharDetalhes);
            }
        });
    }

    /* =========================================================
       MODAL DE EDIÇÃO
       ========================================================= */
    function abrirEdicao(id) {
        const lead = findLeadById(id);
        if (!lead || !editOverlay) return;

        currentLeadId = id;
        hideEditAlert();

        if (editFields.name) editFields.name.value = getLeadField(lead, "nomeEmpresa", "name", "nome") || "";
        if (editFields.category) editFields.category.value = getLeadField(lead, "categoria", "category", "tipo") || "";
        if (editFields.phone) editFields.phone.value = getLeadField(lead, "numeroTelefone", "phone", "telefone") || "";
        if (editFields.email) editFields.email.value = getLeadField(lead, "email") || "";
        // Campo legado (endereço único) — só é usado se o HTML ainda não tiver
        // os campos separados de cidade/estado/pais.
        if (editFields.address) editFields.address.value = getLeadField(lead, "cidade", "address", "endereco") || "";
        if (editFields.cidade) editFields.cidade.value = getLeadField(lead, "cidade") || "";
        if (editFields.estado) editFields.estado.value = getLeadField(lead, "estado") || "";
        if (editFields.pais) editFields.pais.value = getLeadField(lead, "pais") || "";
        if (editFields.website) editFields.website.value = getLeadField(lead, "website") || "";
        if (editFields.instagram) editFields.instagram.value = getLeadField(lead, "instagram") || "";
        if (editFields.status) editFields.status.value = getLeadField(lead, "status") || "";
        if (editFields.prioridade) editFields.prioridade.value = getLeadField(lead, "prioridade") || "";
        if (editFields.observacao) editFields.observacao.value = getLeadField(lead, "observacao") || "";
        if (editFields.proximoContato) editFields.proximoContato.value = getLeadField(lead, "proximoContato") || "";

        editOverlay.hidden = false;
        editOverlay.style.display = "flex";
    }

    function fecharEdicao() {
        if (editOverlay) {
            editOverlay.hidden = true;
            editOverlay.style.display = "none";
        }
    }

    if (editClose) editClose.addEventListener("click", fecharEdicao);
    if (editOverlay) {
        editOverlay.addEventListener("click", (e) => {
            if (e.target === editOverlay) fecharEdicao();
        });
    }

    if (editForm) {
        editForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (currentLeadId === null) return;

            const token = getAuthToken();
            if (!token) {
                showEditAlert("Sua sessão expirou. Faça login novamente.");
                return;
            }

            const nome = editFields.name ? editFields.name.value.trim() : "";
            if (!nome) {
                showEditAlert("Informe o nome do lead.");
                return;
            }

            // Só inclui uma chave no payload se o campo correspondente EXISTE
            // no formulário. O backend faz merge parcial (só sobrescreve as
            // chaves recebidas), então um campo que não está no formulário
            // hoje (ex.: pais/estado, se o HTML ainda não tiver esses
            // inputs) simplesmente permanece intacto no banco — nunca é
            // apagado por "estar undefined" no frontend.
            const payload = { nomeEmpresa: nome };

            if (editFields.category) payload.categoria = editFields.category.value.trim();
            if (editFields.phone) payload.numeroTelefone = editFields.phone.value.trim();
            if (editFields.email) payload.email = editFields.email.value.trim();
            if (editFields.website) payload.website = editFields.website.value.trim();
            if (editFields.instagram) payload.instagram = editFields.instagram.value.trim();
            if (editFields.status) payload.status = editFields.status.value.trim();
            if (editFields.prioridade) payload.prioridade = editFields.prioridade.value.trim();
            if (editFields.observacao) payload.observacao = editFields.observacao.value.trim();
            if (editFields.proximoContato) payload.proximoContato = editFields.proximoContato.value.trim() || null;

            // Cidade/estado/pais: usa os campos novos se existirem; senão
            // cai para o campo único legado "address", mapeado para cidade.
            if (editFields.cidade) payload.cidade = editFields.cidade.value.trim();
            else if (editFields.address) payload.cidade = editFields.address.value.trim();
            if (editFields.estado) payload.estado = editFields.estado.value.trim();
            if (editFields.pais) payload.pais = editFields.pais.value.trim();

            hideEditAlert();
            if (editSubmit) {
                editSubmit.disabled = true;
                editSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Salvando...';
            }

            try {
                const atualizado = await updateLeadRequest(currentLeadId, payload, token);

                const index = myLeads.findIndex((lead) => String(getLeadId(lead)) === String(currentLeadId));
                if (index !== -1) {
                    myLeads[index] = Object.assign({}, myLeads[index], atualizado || payload);
                }

                renderMyLeadsList();
                fecharEdicao();

            } catch (error) {
                console.error("[LEADLY] Erro ao editar lead:", error);

                if (error.status === 401 || error.status === 403) {
                    showEditAlert("Sua sessão expirou. Faça login novamente.");
                    return;
                }

                showEditAlert(error.message || "Não foi possível salvar as alterações. Tente novamente.");
            } finally {
                if (editSubmit) {
                    editSubmit.disabled = false;
                    editSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar alterações';
                }
            }
        });
    }

    /* =========================================================
       EXCLUSÃO
       ========================================================= */
    async function excluirLead(id, triggerButton, onSuccess) {
        const lead = findLeadById(id);
        const nomeLead = lead ? formatField(getLeadField(lead, "nomeEmpresa", "name", "nome")) : "este lead";

        const confirmado = window.confirm(
            `Tem certeza que deseja excluir "${nomeLead}"? Esta ação não pode ser desfeita.`
        );
        if (!confirmado) return;

        const token = getAuthToken();
        if (!token) {
            showAlertBox("Sua sessão expirou. Faça login novamente.");
            return;
        }

        const cardEl = listContainer
            ? listContainer.querySelector(`[data-my-lead-id="${cssEscape(id)}"]`)
            : null;

        if (triggerButton) {
            triggerButton.disabled = true;
            triggerButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Excluindo...';
        }
        if (cardEl) cardEl.style.opacity = "0.5";

        try {
            await deleteLeadRequest(id, token);

            myLeads = myLeads.filter((l) => String(getLeadId(l)) !== String(id));

            if (cardEl) cardEl.remove();

            if (myLeads.length === 0) {
                setListVisible(false);
                showStatus(
                    "Você ainda não possui leads salvos.",
                    'Use a busca em "Encontrar Leads" e clique em "Adicionar aos contatos" para começar.'
                );
            }

            if (typeof onSuccess === "function") onSuccess();

        } catch (error) {
            console.error("[LEADLY] Erro ao excluir lead:", error);

            if (cardEl) cardEl.style.opacity = "1";
            if (triggerButton) {
                triggerButton.disabled = false;
                triggerButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Excluir';
            }

            if (error.status === 401 || error.status === 403) {
                showAlertBox("Sua sessão expirou. Faça login novamente.");
                return;
            }

            showAlertBox(error.message || "Não foi possível excluir este lead. Tente novamente.");
        }
    }

    /* =========================================================
       UTILITÁRIOS DE UI
       ========================================================= */
    function setListVisible(visible) {
        if (listContainer) listContainer.hidden = !visible;
    }

    function showStatus(title, subtitle = "", loading = false) {
        if (!statusContainer) return;
        statusContainer.hidden = false;
        statusContainer.innerHTML = `
            <div class="empty-state">
                ${loading ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> ' : ""}
                <strong>${escapeHtml(title)}</strong>
                ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
            </div>
        `;
    }

    function hideStatus() {
        if (statusContainer) statusContainer.hidden = true;
    }

    function setRefreshLoading(loading) {
        if (!refreshBtn) return;
        refreshBtn.disabled = loading;
        refreshBtn.innerHTML = loading
            ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Atualizando...'
            : '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> Atualizar';
    }

    function showAlertBox(message) {
        if (!alertBox) return;
        const span = alertBox.querySelector("span");
        if (span) span.textContent = message;
        alertBox.hidden = false;
    }

    function hideAlertBox() {
        if (alertBox) alertBox.hidden = true;
    }

    function showEditAlert(message) {
        if (!editAlert) return;
        const span = editAlert.querySelector("span");
        if (span) span.textContent = message;
        editAlert.hidden = false;
    }

    function hideEditAlert() {
        if (editAlert) editAlert.hidden = true;
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
        return String(str === null || str === undefined ? "" : str).replace(/"/g, "&quot;");
    }

    function cssEscape(str) {
        if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(String(str));
        }
        return String(str).replace(/["\\]/g, "\\$&");
    }
});