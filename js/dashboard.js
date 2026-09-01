/**
 * js/dashboard.js
 * Dashboard do Leadly.
 *
 * Responsabilidades:
 * - Verificar o JWT
 * - Buscar o usuário autenticado através do /api/user/me
 * - Exibir os dados reais do usuário
 * - Controlar logout
 * - Controlar menu mobile
 * - Renderizar dados temporários do dashboard
 */

/*
 * Usa a mesma constante de config.js (API_BASE_URL) em vez de manter
 * uma URL duplicada aqui. Assim, mudar o backend só exige editar
 * config.js — antes, dashboard.js podia ficar apontando para um
 * endereço diferente do resto do app.
 */
const API_URL = API_BASE_URL;

document.addEventListener("DOMContentLoaded", async () => {

    /*
     * =========================================================
     * 1. AUTENTICAÇÃO
     * =========================================================
     */

    const token = localStorage.getItem("token");

    if (!token) {
        redirectToLogin();
        return;
    }

    /*
     * =========================================================
     * 2. BUSCAR USUÁRIO AUTENTICADO
     * =========================================================
     */

    const user = await getAuthenticatedUser(token);

    if (!user) {
        return;
    }

    /*
     * =========================================================
     * 3. INICIALIZAR DASHBOARD
     * =========================================================
     */

    renderUserProfile(user);
    renderActivities();
    renderLeadsTable();
    setupMobileMenu();
    setupLogout();
});


/**
 * Busca o usuário autenticado através do JWT.
 */
async function getAuthenticatedUser(token) {

    try {

        const response = await fetch(`${API_URL}/api/user/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        /*
         * Token inválido ou expirado.
         *
         * IMPORTANTE (temporário para depuração):
         * Antes isso chamava redirectToLogin() imediatamente, o que
         * fazia a tela "voltar pro login" sem dar tempo de ver o que
         * aconteceu. Agora mostramos o erro na própria dashboard e
         * ficamos na página — o usuário decide se quer sair.
         */
        if (response.status === 401 || response.status === 403) {

            console.warn(
                "[LEADLY] /api/user/me recusou o token com status",
                response.status
            );

            showDashboardError(
                `Não foi possível validar sua sessão (status ${response.status}). ` +
                "O token não foi removido — confira o console e a configuração do backend."
            );

            return null;
        }

        /*
         * Outro erro do servidor.
         */
        if (!response.ok) {

            console.error(
                "Erro ao buscar usuário:",
                response.status,
                response.statusText
            );

            showDashboardError(
                "Não foi possível carregar seus dados. Tente novamente."
            );

            return null;
        }

        /*
         * Usuário retornado pelo /me.
         */
        const user = await response.json();

        console.log("Usuário autenticado:", user);

        return user;

    } catch (error) {

        console.error(
            "Não foi possível conectar ao backend:",
            error
        );

        showDashboardError(
            "Não foi possível conectar ao servidor."
        );

        return null;
    }
}


/**
 * Redireciona o usuário para a página de login.
 *
 * O login do projeto fica no login.html.
 */
function redirectToLogin() {

    localStorage.removeItem("token");

    window.location.href = "login.html";
}


/**
 * =========================================================
 * PERFIL DO USUÁRIO
 * =========================================================
 */

function renderUserProfile(user) {

    if (!user) return;

    const nameElement =
        document.getElementById("mockNameSidebar");

    const emailElement =
        document.getElementById("mockEmailSidebar");

    const avatarSidebar =
        document.getElementById("mockAvatarSidebar");

    const avatarHeader =
        document.getElementById("mockAvatarHeader");


    /*
     * Seu User Java possui getName(),
     * então normalmente o JSON terá "name".
     *
     * Mantemos "nome" como fallback caso o backend
     * esteja configurado dessa maneira.
     */
    const name =
        user.name ||
        user.nome ||
        "Usuário";

    const email =
        user.email ||
        "";


    const initials = getInitials(name);


    if (nameElement) {
        nameElement.textContent = name;
    }

    if (emailElement) {
        emailElement.textContent = email;
    }

    if (avatarSidebar) {
        avatarSidebar.textContent = initials;
    }

    if (avatarHeader) {
        avatarHeader.textContent = initials;
    }
}


/**
 * Gera as iniciais do nome.
 *
 * Exemplo:
 *
 * João Silva
 * JS
 *
 * William
 * WI
 */
function getInitials(name) {

    if (!name) {
        return "U";
    }

    const parts =
        name
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


/**
 * =========================================================
 * ATIVIDADES
 * =========================================================
 */

function renderActivities() {

    const container =
        document.getElementById("activityList");

    if (!container) {
        return;
    }


    /*
     * Dados temporários.
     *
     * Futuramente serão substituídos por dados
     * vindos da API.
     */
    const activities = [

        {
            id: 1,
            descricao:
                "<strong>João Silva</strong> foi cadastrado como novo prospect.",
            tempo:
                "Há 15 minutos"
        },

        {
            id: 2,
            descricao:
                "<strong>Carlos Oliveira</strong> aceitou a proposta comercial.",
            tempo:
                "Há 2 horas"
        },

        {
            id: 3,
            descricao:
                "<strong>Tech Solutions LTDA</strong> foi adicionada à base.",
            tempo:
                "Há 4 horas"
        }

    ];


    container.innerHTML =
        activities
            .map(activity => `

<div class="activity-item">

    <div class="activity-icon">

    <svg
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
stroke-width="2"
stroke-linecap="round"
stroke-linejoin="round"
    >

    <circle
cx="12"
cy="12"
r="10"
    ></circle>

<polyline
    points="12 6 12 12 16 14"
></polyline>

</svg>

</div>


<div class="activity-details">

    <p class="activity-text">
        ${activity.descricao}
    </p>

    <span class="activity-time">
                            ${activity.tempo}
                        </span>

</div>

</div>

`)
            .join("");
}


/**
 * =========================================================
 * LEADS
 * =========================================================
 */

function renderLeadsTable() {

    const tbody =
        document.getElementById("leadsTableBody");

    if (!tbody) {
        return;
    }


    /*
     * Dados temporários.
     *
     * Futuramente virão da API de leads.
     */
    const leads = [

        {
            nome: "João Silva",
            empresa: "Empresa Alpha",
            status: "Novo",
            data: "Hoje, 10:42"
        },

        {
            nome: "Mariana Santos",
            empresa: "Tech Solutions",
            status: "Contatado",
            data: "Hoje, 09:15"
        },

        {
            nome: "Carlos Oliveira",
            empresa: "Nova Digital",
            status: "Convertido",
            data: "Ontem, 16:20"
        }

    ];


    tbody.innerHTML =
        leads
            .map(lead => `

<tr>

<td class="lead-name">
    ${lead.nome}
</td>

<td>
    ${lead.empresa}
</td>

<td>
                        <span
                            class="badge ${getStatusBadgeClass(lead.status)}"
                        >
                            ${lead.status}
                        </span>
</td>

<td>
    ${lead.data}
</td>

</tr>

`)
            .join("");
}


/**
 * Retorna a classe CSS correspondente ao status.
 */
function getStatusBadgeClass(status) {

    switch ((status || "").toLowerCase()) {

        case "novo":
            return "badge--novo";

        case "contatado":
            return "badge--contatado";

        case "convertido":
            return "badge--convertido";

        default:
            return "badge--neutral";
    }
}


/**
 * =========================================================
 * MENU MOBILE
 * =========================================================
 */

function setupMobileMenu() {

    const mobileToggle =
        document.getElementById("mobileToggle");

    const sidebar =
        document.getElementById("sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");


    if (!mobileToggle || !sidebar || !overlay) {
        return;
    }


    function toggleSidebar() {

        sidebar.classList.toggle("open");

        overlay.classList.toggle("active");
    }


    mobileToggle.addEventListener(
        "click",
        toggleSidebar
    );


    overlay.addEventListener(
        "click",
        toggleSidebar
    );
}


/**
 * =========================================================
 * LOGOUT
 * =========================================================
 */

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutBtn");


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            logout();
        }
    );
}


/**
 * Remove o JWT e volta para o login.
 */
function logout() {

    localStorage.removeItem("token");

    window.location.href = "login.html";
}


/**
 * =========================================================
 * ERRO DO DASHBOARD
 * =========================================================
 */

function showDashboardError(message) {

    console.error(message);

    /*
     * O HTML atual não tem um elemento #dashboardError fixo, então a
     * mensagem nunca aparecia visualmente (só no console). Agora, se
     * ele não existir, criamos um banner no topo do conteúdo da
     * dashboard na hora.
     */
    let errorElement =
        document.getElementById("dashboardError");

    if (!errorElement) {

        errorElement = document.createElement("div");
        errorElement.id = "dashboardError";
        errorElement.style.cssText =
            "background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;" +
            "border-radius:8px;padding:12px 16px;margin-bottom:16px;" +
            "font-size:14px;line-height:1.4;";

        const content =
            document.querySelector(".dashboard-content");

        if (content) {
            content.prepend(errorElement);
        } else {
            document.body.prepend(errorElement);
        }
    }

    errorElement.textContent = message;

    errorElement.style.display = "block";
}