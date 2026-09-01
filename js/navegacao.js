/**
 * js/navegacao.js
 * Gerenciamento de navegação SPA do Dashboard e abas de Configurações.
 */

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. NAVEGAÇÃO PRINCIPAL DO DASHBOARD
    // ==========================================
    const sidebarLinks = document.querySelectorAll("[data-nav-target]");
    const dashboardSections = document.querySelectorAll(".dashboard-section");

    function navigateToSection(targetId) {
        if (!targetId) return;

        // Oculta todas as seções e mostra apenas a selecionada
        dashboardSections.forEach((sec) => {
            if (sec.id === targetId) {
                sec.hidden = false;
                sec.classList.add("is-active");
            } else {
                sec.hidden = true;
                sec.classList.remove("is-active");
            }
        });

        // Atualiza o estado visual da sidebar
        sidebarLinks.forEach((link) => {
            const target = link.getAttribute("data-nav-target");
            if (target === targetId) {
                link.classList.add("is-active");
            } else {
                link.classList.remove("is-active");
            }
        });
    }

    sidebarLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("data-nav-target");
            navigateToSection(targetId);
        });
    });

    // ==========================================
    // 2. NAVEGAÇÃO INTERNA DE CONFIGURAÇÕES
    // ==========================================
    const configTabs = document.querySelectorAll(".settings-tab-btn");
    const configPanels = document.querySelectorAll(".settings-panel");

    function switchConfigTab(panelId) {
        if (!panelId) return;

        configPanels.forEach((panel) => {
            if (panel.id === panelId) {
                panel.hidden = false;
            } else {
                panel.hidden = true;
            }
        });

        configTabs.forEach((tab) => {
            const target = tab.getAttribute("data-config-tab");
            if (target === panelId) {
                tab.classList.add("is-active");
            } else {
                tab.classList.remove("is-active");
            }
        });
    }

    configTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const panelId = tab.getAttribute("data-config-tab");
            switchConfigTab(panelId);
        });
    });

    // Suporte ao clique nas variáveis {{tag}} para rápida inserção
    const varTags = document.querySelectorAll(".var-tag");
    const msgTextarea = document.getElementById("configLeadlyAiTemplate");

    varTags.forEach((tag) => {
        tag.addEventListener("click", () => {
            if (!msgTextarea) return;
            const textToInsert = tag.textContent;
            const start = msgTextarea.selectionStart;
            const end = msgTextarea.selectionEnd;
            const text = msgTextarea.value;
            msgTextarea.value = text.substring(0, start) + textToInsert + text.substring(end);
            msgTextarea.focus();
            msgTextarea.selectionStart = msgTextarea.selectionEnd = start + textToInsert.length;
        });
    });
});