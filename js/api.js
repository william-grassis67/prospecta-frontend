/**
 * js/api.js
 *
 * Centraliza toda a comunicação entre o frontend e o backend.
 *
 * Depende de:
 * - config.js
 *
 * API:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 * - GET  /api/user/me
 * - GET  /api/leads/search
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


    const text =
        await response.text();


    if (!response.ok) {

        let message = null;


        /*
         * Tentamos interpretar como JSON
         * caso o Spring retorne um objeto de erro.
         */
        try {

            const data =
                JSON.parse(text);

            message =
                getMessageFromData(data);

        } catch (_) {

            /*
             * Se não for JSON,
             * utilizamos o próprio texto.
             */
            message =
                text;
        }


        throw new Error(
            message ||
            "Não foi possível enviar o e-mail de recuperação."
        );
    }


    return text;
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


    const text =
        await response.text();


    if (!response.ok) {

        let message = null;


        try {

            const data =
                JSON.parse(text);

            message =
                getMessageFromData(data);

        } catch (_) {

            message =
                text;
        }


        throw new Error(
            message ||
            "Não foi possível alterar a senha."
        );
    }


    return text;
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
   CONTATOS (Adicionar lead aos contatos)
   ========================================================= */

/**
 * Adiciona um lead à lista de contatos do usuário.
 *
 * Endpoint:
 * POST /api/contacts
 *
 * @param {Object} lead - { name, address, phone, website, instagram, latitude, longitude, category }
 * @param {string} token
 * @returns {Promise<Object>} contato criado, conforme resposta do backend
 */
async function addContactRequest(lead, token) {

    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }

    const response = await apiFetch(
        `${API_BASE}/api/contacts`,
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
        throw new Error(
            getMessageFromData(data) || "Não foi possível adicionar aos contatos."
        );
    }

    return data;
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