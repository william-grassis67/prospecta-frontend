/**
 * js/message-auto.js
 * Gerenciador da funcionalidade LeadlyAI (Modal, Geração, Edição e Copiar).
 */

document.addEventListener("DOMContentLoaded", () => {
    initLeadlyAIModal();
});

let currentLeadContext = null;

function initLeadlyAIModal() {
    const overlay = document.getElementById("leadlyAiOverlay");
    const closeBtn = document.getElementById("leadlyAiClose");
    const regenBtn = document.getElementById("leadlyAiRegenBtn");
    const copyBtn = document.getElementById("leadlyAiCopyBtn");
    const sendBtn = document.getElementById("leadlyAiSendBtn");

    if (closeBtn) {
        closeBtn.addEventListener("click", closeLeadlyAIModal);
    }

    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeLeadlyAIModal();
        });
    }

    if (regenBtn) {
        regenBtn.addEventListener("click", () => {
            fetchAndRenderLeadlyAIMessage();
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener("click", handleCopyMessage);
    }

    if (sendBtn) {
        sendBtn.addEventListener("click", handleSendMessageClick);
    }
}

/**
 * Abre o modal do LeadlyAI e dispara a geração da mensagem.
 * @param {Object} leadData - Objeto contendo dados do lead para contexto local se necessário
 */
function openLeadlyAIMessageModal(leadData = null) {
    currentLeadContext = leadData;

    const overlay = document.getElementById("leadlyAiOverlay");
    if (!overlay) return;

    overlay.hidden = false;
    overlay.style.display = "flex";

    updateSendButtonAvailability();
    fetchAndRenderLeadlyAIMessage();
}

/**
 * Executa a chamada à API do LeadlyAI com gerenciamento do estado de carregamento.
 */
async function fetchAndRenderLeadlyAIMessage() {
    const loadingState = document.getElementById("leadlyAiLoading");
    const bodyState = document.getElementById("leadlyAiBody");
    const alertBox = document.getElementById("leadlyAiAlert");
    const regenBtn = document.getElementById("leadlyAiRegenBtn");
    const sendBtn = document.getElementById("leadlyAiSendBtn");
    const copyBtn = document.getElementById("leadlyAiCopyBtn");
    const textarea = document.getElementById("leadlyAiTextarea");

    // Limpeza visual
    if (alertBox) {
        alertBox.hidden = true;
        alertBox.querySelector("span").textContent = "";
    }

    // Estado Carregando
    if (loadingState) loadingState.hidden = false;
    if (bodyState) bodyState.hidden = true;
    if (regenBtn) regenBtn.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;

    const token = getToken();

    try {
        const result = await generateMessageRequest(token);

        if (textarea) {
            // Uso seguro de value/textContent para evitar XSS
            textarea.value = result.message || result.texto || "";
        }

        if (loadingState) loadingState.hidden = true;
        if (bodyState) bodyState.hidden = false;
    } catch (error) {
        console.error("[LeadlyAI] Erro ao gerar mensagem:", error);

        if (loadingState) loadingState.hidden = true;

        if (alertBox) {
            alertBox.hidden = false;
            const msgSpan = alertBox.querySelector("span");
            if (msgSpan) {
                if (error.status === 401 || error.status === 403) {
                    msgSpan.textContent = "Sessão expirada. Faça login novamente.";
                } else {
                    msgSpan.textContent = "Não foi possível gerar a mensagem. Tente novamente.";
                }
            }
        }
    } finally {
        if (regenBtn) regenBtn.disabled = false;
        if (copyBtn) copyBtn.disabled = false;
        // O botão de WhatsApp só volta a ficar habilitado se o lead
        // realmente tiver telefone (ver updateSendButtonAvailability).
        updateSendButtonAvailability();
    }
}

function closeLeadlyAIModal() {
    const overlay = document.getElementById("leadlyAiOverlay");
    if (overlay) {
        overlay.hidden = true;
        overlay.style.display = "none";
    }
    currentLeadContext = null;
}

/**
 * Função para copiar o texto do textarea para a área de transferência.
 */
async function handleCopyMessage() {
    const textarea = document.getElementById("leadlyAiTextarea");
    const copyBtn = document.getElementById("leadlyAiCopyBtn");
    if (!textarea) return;

    try {
        await navigator.clipboard.writeText(textarea.value);
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
        }, 2000);
    } catch (err) {
        textarea.select();
        document.execCommand("copy");
    }
}

function handleSendMessageClick() {
    const textarea = document.getElementById("leadlyAiTextarea");
    const message = textarea ? textarea.value : "";

    sendLeadMessageViaWhatsApp(currentLeadContext, message);
}

/**
 * =========================================================
 * ENVIO VIA WHATSAPP (wa.me)
 * =========================================================
 *
 * Sem backend e sem WhatsApp Business API por enquanto: apenas abre o
 * WhatsApp Web/App com o número do lead e a mensagem do LeadlyAI já
 * preenchida, via https://wa.me/NUMERO?text=MENSAGEM.
 *
 * Isolada em uma função própria para que, no futuro, possamos trocar essa
 * implementação por uma integração oficial (WhatsApp Business API) sem
 * precisar alterar o restante da interface — apenas o corpo desta função.
 *
 * @param {Object} lead - lead atualmente no contexto do modal LeadlyAI
 * @param {string} message - texto do textarea (já editado pelo usuário, se for o caso)
 * @returns {boolean} true se o WhatsApp foi aberto, false caso contrário
 */
function sendLeadMessageViaWhatsApp(lead, message) {
    const rawPhone = getLeadPhoneRaw(lead);

    if (!rawPhone) {
        showLeadlyAIWhatsAppNotice(
            "Este lead não possui um número de telefone cadastrado.",
            "error"
        );
        return false;
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);

    if (!normalizedPhone || !isValidBrazilianPhone(normalizedPhone)) {
        showLeadlyAIWhatsAppNotice(
            "Não foi possível reconhecer este número de telefone.",
            "error"
        );
        return false;
    }

    // A mensagem só é usada para montar a URL do wa.me — nunca é inserida
    // como HTML em lugar nenhum (ver leadlyAiTextarea.value na função de
    // geração), então não há risco de a mensagem ser interpretada como
    // HTML aqui.
    const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message || "")}`;

    window.open(url, "_blank", "noopener,noreferrer");

    // Importante: abrir o wa.me não significa que a mensagem foi enviada
    // — o usuário ainda precisa clicar em enviar dentro do WhatsApp. Por
    // isso não marcamos o lead como "Contatado" nem dizemos que a
    // mensagem "foi enviada com sucesso".
    showLeadlyAIWhatsAppNotice("WhatsApp aberto com a mensagem preparada.", "success");
    return true;
}

/**
 * Obtém o telefone "bruto" (como veio do backend) de um lead, sem assumir
 * um único nome de propriedade: os leads encontrados na busca usam
 * `telefone`, mas os leads já salvos nos contatos (leads-manager.js) podem
 * expor `phone`. Retorna null quando não há valor utilizável.
 */
function getLeadPhoneRaw(lead) {
    if (!lead) return null;

    const candidates = [lead.telefone, lead.phone];

    for (const value of candidates) {
        if (value !== null && value !== undefined) {
            const trimmed = String(value).trim();
            if (trimmed !== "" && trimmed.toLowerCase() !== "null" && trimmed.toLowerCase() !== "undefined") {
                return trimmed;
            }
        }
    }

    return null;
}

/**
 * Normaliza um telefone brasileiro para o formato exigido pelo wa.me:
 * apenas dígitos, com o código do país (55) na frente, sem duplicá-lo.
 *
 * Exemplos:
 *   "(27) 99999-9999"        -> "5527999999999"
 *   "+55 (27) 99999-9999"    -> "5527999999999"
 *   "5527999999999"          -> "5527999999999"
 *
 * @param {string} phone
 * @returns {string|null} dígitos normalizados, ou null se não foi possível
 * reconhecer o formato com confiança.
 */
function normalizePhoneNumber(phone) {
    if (phone === null || phone === undefined) return null;

    // Remove espaços, parênteses, hífens, "+" e qualquer outro caractere
    // que não seja dígito.
    const digits = String(phone).replace(/\D/g, "");

    if (!digits) return null;

    // Já vem com código do país (55) + DDD + número (10 ou 11 dígitos) =
    // 12 ou 13 dígitos no total. Mantém como está, sem duplicar o "55".
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
        return digits;
    }

    // Número nacional (DDD + número), sem código do país: adiciona o 55.
    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    // Formato não reconhecido com confiança suficiente (ex.: número
    // incompleto, ou com DDI de outro país) — quem chamar deve tratar
    // como "não foi possível normalizar" em vez de arriscar um wa.me errado.
    return null;
}

/**
 * Validação simples de "parece um telefone brasileiro válido para o
 * wa.me": código do país 55 + 10 ou 11 dígitos (DDD + número).
 */
function isValidBrazilianPhone(normalizedDigits) {
    return /^55\d{10,11}$/.test(normalizedDigits || "");
}

/**
 * Habilita/desabilita o botão "Enviar pelo WhatsApp" de acordo com a
 * disponibilidade de telefone no lead atualmente em contexto no modal.
 */
function updateSendButtonAvailability() {
    const sendBtn = document.getElementById("leadlyAiSendBtn");
    if (!sendBtn) return;

    const hasPhone = !!getLeadPhoneRaw(currentLeadContext);

    sendBtn.disabled = !hasPhone;

    if (hasPhone) {
        sendBtn.removeAttribute("title");
    } else {
        sendBtn.title = "Telefone não disponível";
    }
}

/**
 * Reaproveita o alerta já existente do modal LeadlyAI (#leadlyAiAlert)
 * para mostrar avisos ligados ao envio pelo WhatsApp — sem criar um novo
 * sistema de notificações nem usar alert().
 */
function showLeadlyAIWhatsAppNotice(message, type) {
    const alertBox = document.getElementById("leadlyAiAlert");
    if (!alertBox) return;

    const icon = alertBox.querySelector("i");
    const span = alertBox.querySelector("span");

    alertBox.classList.remove("notice--error", "notice--success");
    alertBox.classList.add(type === "success" ? "notice--success" : "notice--error");

    if (icon) {
        icon.className = type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation";
    }

    if (span) {
        // textContent — nunca innerHTML — para não interpretar a mensagem
        // (ou o texto do lead) como HTML.
        span.textContent = message;
    }

    alertBox.hidden = false;
}