/**
 * js/api.js
 *
 * Centraliza toda a comunicação entre o frontend e o backend.
 *
 * Depende de:
 * - config.js
 *
 * API:
 * - POST   /api/auth/login
 * - POST   /api/auth/register
 * - POST   /api/auth/forgot-password
 * - POST   /api/auth/reset-password
 * - GET    /api/user/me
 * - GET    /api/leads/search
 * - POST   /api/leads
 * - GET    /api/leads
 * - GET    /api/leads/{id}
 * - PUT    /api/leads/{id}
 * - DELETE /api/leads/{id}
 */


/* =========================================================
   CONFIGURAÇÃO
   ========================================================= */

const API_BASE = API_BASE_URL;


/* =========================================================
   LOGIN
   ========================================================= */

/**
 * Realiza login.
 *
 * O backend retorna o JWT diretamente como String.
 *
 * Exemplo de resposta:
 *
 * eyJhbGciOiJIUzI1NiJ9...
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} JWT
 */
async function loginRequest(email, password) {

    const response = await apiFetch(
        `${API_BASE}/api/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        }
    );


    if (!response.ok) {

        const message =
            await getErrorMessage(response);

        throw new Error(
            message || "E-mail ou senha inválidos."
        );
    }


    /*
     * IMPORTANTE:
     *
     * O backend retorna String.
     * Portanto usamos text() e não json().
     */
    const token =
        (await response.text()).trim();


    if (!token) {

        throw new Error(
            "O servidor não retornou o token de autenticação."
        );
    }


    return token;
}


/* =========================================================
   CADASTRO
   ========================================================= */

/**
 * Cria uma nova conta.
 *
 * Atualmente o backend retorna o User salvo
 * em JSON e NÃO retorna JWT.
 *
 * @param {Object} userData
 * @returns {Promise<Object>} usuário criado
 */
async function registerRequest(userData) {

    const response = await apiFetch(
        `${API_BASE}/api/auth/register`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        }
    );


    const data =
        await parseJson(response);


    if (!response.ok) {

        throw new Error(
            getMessageFromData(data) ||
            "Não foi possível criar a conta."
        );
    }


    return data;
}


/* =========================================================
   USUÁRIO AUTENTICADO
   ========================================================= */

/**
 * Busca o usuário atualmente autenticado.
 *
 * Endpoint:
 *
 * GET /api/user/me
 *
 * O JWT é enviado no header:
 *
 * Authorization: Bearer TOKEN
 *
 * @param {string} token
 * @returns {Promise<Object>} usuário autenticado
 */
async function getMeRequest(token) {

    if (!token) {

        throw new Error(
            "Token de autenticação não encontrado."
        );
    }


    const response =
        await apiFetch(
            `${API_BASE}/api/user/me`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );


    if (response.status === 401 ||
        response.status === 403) {

        const error =
            new Error(
                "Sessão expirada. Faça login novamente."
            );

        error.status =
            response.status;

        throw error;
    }


    if (!response.ok) {

        throw new Error(
            "Não foi possível carregar os dados do usuário."
        );
    }


    return await parseJson(response);
}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

/**
 * Solicita recuperação de senha.
 *
 * Backend:
 *
 * POST /api/auth/forgot-password
 *
 * O backend retorna texto simples.
 */
/**
 * Solicita recuperação de senha (envia o código de 6 dígitos por e-mail).
 *
 * Backend:
 *
 * POST /api/auth/forgot-password
 *
 * Resposta (JSON): { message: "..." }
 * Sempre retorna 200 — o backend nunca revela se o e-mail existe ou não.
 */
async function forgotPasswordRequest(email) {

    const response =
        await apiFetch(
            `${API_BASE}/api/auth/forgot-password`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email
                })
            }
        );

    const data =
        await parseJson(response);

    if (!response.ok) {

        throw new Error(
            getMessageFromData(data) ||
            "Não foi possível enviar o código de recuperação."
        );
    }

    return data;
}

/* =========================================================
   RESET PASSWORD
   ========================================================= */

/**
 * Altera a senha utilizando o token de recuperação.
 *
 * Backend:
 *
 * POST /api/auth/reset-password
 */
/**
 * Altera a senha utilizando o token temporário de reset (emitido por
 * verifyResetCodeRequest, não é mais um UUID de link por e-mail).
 *
 * Backend:
 *
 * POST /api/auth/reset-password
 *
 * Resposta (JSON): { message: "..." }
 */
async function resetPasswordRequest(token, password) {

    const response =
        await apiFetch(
            `${API_BASE}/api/auth/reset-password`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token: token,
                    password: password
                })
            }
        );

    const data =
        await parseJson(response);

    if (!response.ok) {

        throw new Error(
            getMessageFromData(data) ||
            "Não foi possível alterar a senha."
        );
    }

    return data;
}

/* =========================================================
   VERIFY RESET CODE
   ========================================================= */

/**
 * Verifica o código de 6 dígitos enviado por e-mail e, se válido, retorna
 * um token temporário que autoriza a chamada seguinte a resetPasswordRequest().
 *
 * Backend:
 *
 * POST /api/auth/verify-reset-code
 *
 * Resposta (JSON): { resetToken: "..." }
 *
 * @param {string} email
 * @param {string} code - 6 dígitos
 * @returns {Promise<Object>} { resetToken }
 */
async function verifyResetCodeRequest(email, code) {

    const response =
        await apiFetch(
            `${API_BASE}/api/auth/verify-reset-code`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    code: code
                })
            }
        );

    const data =
        await parseJson(response);

    if (!response.ok) {

        throw new Error(
            getMessageFromData(data) ||
            "O código informado está incorreto."
        );
    }

    return data;
}
/* =========================================================
   ENCONTRAR LEADS
   ========================================================= */

/**
 * Busca leads por tipo de negócio e localização.
 *
 * Endpoint:
 * GET /api/leads/search?tipo=...&pais=...&estado=...&localizacao=...
 *
 * O JWT é enviado no header:
 * Authorization: Bearer TOKEN
 *
 * @param {string} tipo - ex: "dentista"
 * @param {string} pais - ex: "Brasil"
 * @param {string} estado - ex: "Espírito Santo" (opcional)
 * @param {string} localizacao - ex: "Conceição da Barra"
 * @param {string} token
 * @returns {Promise<Array>} lista de leads retornada pelo backend
 */
async function searchLeadsRequest(tipo, pais, estado, localizacao, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const params = new URLSearchParams({
        tipo: tipo || "",
        pais: pais || "",
        estado: estado || "",
        localizacao: localizacao || ""
    });

    const url = `${API_BASE}/api/leads/search?${params.toString()}`;

    console.log("[LEADLY] Iniciando busca:", { tipo, pais, estado, localizacao });
    console.log("[LEADLY] URL:", url);

    const response = await apiFetch(
        url,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    console.log("[LEADLY] Response Status:", response.status);

    if (response.status === 401 || response.status === 403) {
        console.warn(
            "[LEADLY] Backend recusou /api/leads/search com",
            response.status
        );
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    if (!response.ok) {
        const message = await getErrorMessage(response);
        const error = new Error(
            message || "Não foi possível buscar os leads."
        );
        error.status = response.status;
        throw error;
    }

    const data = await parseJson(response);
    console.log("[LEADLY] Leads recebidos:", data);

    return Array.isArray(data) ? data : [];
}


/* =========================================================
   CONTATOS (Adicionar lead aos contatos) — LEGADO
   ========================================================= */

/**
 * @deprecated Mantida apenas por compatibilidade. O backend atual não
 * expõe mais POST /api/contacts — use createLeadRequest() (POST /api/leads).
 *
 * @param {Object} lead - { name, address, phone, website, instagram, latitude, longitude, category }
 * @param {string} token
 * @returns {Promise<Object>}
 */
async function addContactRequest(lead, token) {
    return createLeadRequest(lead, token);
}


/* =========================================================
   LEADS (CRUD — Meus Leads / Contatos salvos)
   ========================================================= */

/**
 * Salva um lead na conta do usuário (adiciona aos contatos).
 *
 * Endpoint:
 * POST /api/leads
 *
 * IMPORTANTE — CreateLeadRequest:
 * Não temos acesso ao arquivo-fonte do DTO `CreateLeadRequest`. Os nomes de
 * campo abaixo (name, address, phone, email, website, instagram, latitude,
 * longitude, category) foram inferidos a partir do único ponto do próprio
 * frontend que já documentava esse contrato (comentário JSDoc da antiga
 * addContactRequest, que apontava para POST /api/contacts com esse mesmo
 * formato de objeto). Caso o `CreateLeadRequest` real do backend use outros
 * nomes, ajuste apenas o objeto `lead` monta do em leads.js.
 *
 * @param {Object} lead - { name, address, phone, email, website, instagram, latitude, longitude, category }
 * @param {string} token
 * @returns {Promise<Object>} LeadResponseDTO do lead criado (201 Created)
 */
async function createLeadRequest(lead, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/leads`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(lead)
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    const data = await parseJson(response);

    if (!response.ok) {
        const error = new Error(
            getMessageFromData(data) || friendlyMessageForStatus(response.status, "adicionar aos contatos")
        );
        error.status = response.status;
        throw error;
    }

    return data;
}

/**
 * Lista os leads salvos (contatos) do usuário autenticado.
 *
 * Endpoint:
 * GET /api/leads
 *
 * @param {string} token
 * @returns {Promise<Array>} lista de LeadResponseDTO
 */
async function getMyLeadsRequest(token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/leads`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    if (!response.ok) {
        const error = new Error(friendlyMessageForStatus(response.status, "carregar seus leads"));
        error.status = response.status;
        throw error;
    }

    const data = await parseJson(response);
    return Array.isArray(data) ? data : [];
}

/**
 * Busca um lead salvo pelo ID.
 *
 * Endpoint:
 * GET /api/leads/{id}
 *
 * @param {string|number} id
 * @param {string} token
 * @returns {Promise<Object>} LeadResponseDTO
 */
async function getLeadByIdRequest(id, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/leads/${id}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    if (response.status === 404) {
        const error = new Error("Lead não encontrado.");
        error.status = 404;
        throw error;
    }

    if (!response.ok) {
        const error = new Error(friendlyMessageForStatus(response.status, "carregar os detalhes do lead"));
        error.status = response.status;
        throw error;
    }

    return await parseJson(response);
}

/**
 * Atualiza um lead salvo.
 *
 * Endpoint:
 * PUT /api/leads/{id}
 *
 * IMPORTANTE — UpdateLeadRequest: pelo mesmo motivo explicado em
 * createLeadRequest, não temos o DTO real. Assumimos o mesmo formato de
 * campos usado em CreateLeadRequest. Ajuste em leads-manager.js se o
 * backend usar um contrato diferente.
 *
 * @param {string|number} id
 * @param {Object} lead - mesmo formato de CreateLeadRequest
 * @param {string} token
 * @returns {Promise<Object>} LeadResponseDTO atualizado
 */
async function updateLeadRequest(id, lead, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/leads/${id}`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(lead)
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    if (response.status === 404) {
        const error = new Error("Lead não encontrado.");
        error.status = 404;
        throw error;
    }

    const data = await parseJson(response);

    if (!response.ok) {
        const error = new Error(
            getMessageFromData(data) || friendlyMessageForStatus(response.status, "salvar as alterações")
        );
        error.status = response.status;
        throw error;
    }

    return data;
}

/**
 * Exclui um lead salvo.
 *
 * Endpoint:
 * DELETE /api/leads/{id}
 *
 * @param {string|number} id
 * @param {string} token
 * @returns {Promise<void>}
 */
async function deleteLeadRequest(id, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/leads/${id}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    if (response.status === 404) {
        const error = new Error("Lead não encontrado (talvez já tenha sido excluído).");
        error.status = 404;
        throw error;
    }

    // 204 No Content é o retorno esperado em caso de sucesso.
    if (!response.ok && response.status !== 204) {
        const error = new Error(friendlyMessageForStatus(response.status, "excluir o lead"));
        error.status = response.status;
        throw error;
    }
}


/* =========================================================
   MENSAGENS AMIGÁVEIS POR STATUS HTTP
   ========================================================= */

/**
 * Converte um status HTTP em uma mensagem amigável e genérica,
 * evitando expor stack traces ou mensagens técnicas do backend.
 */
function friendlyMessageForStatus(status, acao) {

    switch (status) {
        case 400:
        case 422:
            return `Não foi possível ${acao}. Verifique os dados informados.`;
        case 401:
            return "Sessão expirada. Faça login novamente.";
        case 403:
            return "Você não tem permissão para realizar esta ação.";
        case 404:
            return "Não encontrado.";
        case 409:
            return "Este lead já está nos seus contatos.";
        case 500:
        default:
            return `Não foi possível ${acao}. Tente novamente em instantes.`;
    }
}


/* =========================================================
   FETCH
   ========================================================= */

/**
 * Wrapper centralizado do fetch.
 * Responsável por tratar problemas de conexão.
 */
async function apiFetch(url, options = {}) {

    try {
        return await fetch(url, options);
    } catch (error) {
        console.error("Erro de conexão com a API:", error);
        throw new Error(
            `Não foi possível conectar ao servidor em ${API_BASE}. ` +
            "Verifique se o backend está rodando."
        );
    }
}


/* =========================================================
   JSON
   ========================================================= */

/**
 * Tenta converter uma resposta para JSON.
 * Retorna null caso a resposta não seja JSON.
 */
async function parseJson(response) {

    try {
        return await response.json();
    } catch (_) {
        return null;
    }
}


/* =========================================================
   ERROS
   ========================================================= */

/**
 * Obtém uma mensagem de erro da resposta HTTP.
 */
async function getErrorMessage(response) {

    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        const data = JSON.parse(text);
        return (
            data.message ||
            data.error ||
            data.detail ||
            null
        );
    } catch (_) {
        return text;
    }
}


/**
 * Obtém uma mensagem de um objeto.
 */
function getMessageFromData(data) {

    if (!data) {
        return null;
    }

    if (typeof data === "string") {
        return data;
    }

    return (
        data.message ||
        data.error ||
        data.detail ||
        null
    );
}
/* =========================================================
   LEADLY AI (Geração de Mensagens)
   ========================================================= */

/**
 * Solicita a geração automática de mensagem ao LeadlyAI.
 *
 * Endpoint:
 * POST /api/messages/generate
 *
 * O backend lê automaticamente o usuário logado via JWT no Header.
 * NÃO envia body ou dados pessoais do usuário no envio.
 *
 * @param {string} token - JWT do usuário autenticado
 * @returns {Promise<Object>} Resposta { message: string, success: boolean }
 */
async function generateMessageRequest(token) {
    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/messages/generate`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        }
    );

    if (response.status === 401 || response.status === 403) {
        const error = new Error("Sessão expirada. Faça login novamente.");
        error.status = response.status;
        throw error;
    }

    const data = await parseJson(response);

    if (!response.ok) {
        const error = new Error(
            getMessageFromData(data) || "Não foi possível gerar a mensagem. Tente novamente."
        );
        error.status = response.status;
        throw error;
    }

    return data;
}