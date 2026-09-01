/**
 * js/lead-scoring.js
 *
 * Cálculo do "Lead Score" (0 a 100) — a pontuação de OPORTUNIDADE de um lead,
 * baseada exclusivamente nos dados que o backend realmente retorna hoje em
 * /api/leads/search (nome, tipo, endereco, telefone, email, website,
 * latitude, longitude).
 *
 * Este arquivo é independente (não depende de api.js, storage.js etc.) e
 * expõe uma única função global: calculateLeadScore(lead, searchParams).
 *
 * IMPORTANTE — o que este cálculo NÃO faz e por quê:
 * - Não avalia "quantidade de avaliações" nem "qualidade do site" (site
 *   antigo/quebrado), porque o backend atual não envia esses campos.
 * - Não avalia redes sociais, porque não existe campo de redes sociais no
 *   objeto de lead retornado hoje.
 * Se esses dados forem adicionados futuramente pelo backend, os pesos
 * abaixo (PESOS) podem ser ajustados e novos fatores incluídos sem alterar
 * a assinatura da função.
 */

/* =========================================================
   PESOS (valores mágicos centralizados aqui, nada espalhado
   pelo restante do código)
   ========================================================= */
const LEAD_SCORE_PESOS = Object.freeze({
    SEM_SITE: 35,           // não ter site é a maior oportunidade (venda de sites)
    TELEFONE: 20,
    EMAIL: 10,
    CATEGORIA_CORRESPONDE: 20,
    LOCALIZACAO_CORRESPONDE: 15,
    PENALIDADE_SEM_CONTATO: -15 // sem telefone E sem e-mail ao mesmo tempo
});

/*
 * OBS.: os campos "emoji" abaixo passaram a conter classes de ícone do
 * Font Awesome (ex.: "fa-solid fa-circle-check"), em vez de caracteres de
 * emoji, para padronização visual (ver item 10 do escopo do projeto). O
 * nome do campo foi mantido como "emoji" para não quebrar quem já consome
 * esses objetos — apenas o conteúdo mudou de caractere para classe CSS.
 */
const LEAD_SCORE_FAIXAS = Object.freeze([
    { min: 80, max: 100, nivel: "alta", label: "Alta oportunidade", emoji: "fa-solid fa-circle-check" },
    { min: 50, max: 79, nivel: "media", label: "Média oportunidade", emoji: "fa-solid fa-circle-exclamation" },
    { min: 25, max: 49, nivel: "baixa", label: "Baixa oportunidade", emoji: "fa-solid fa-triangle-exclamation" },
    { min: 0, max: 24, nivel: "nao-qualificado", label: "Não qualificado", emoji: "fa-solid fa-circle-minus" }
]);

/* =========================================================
   HELPERS DE TEXTO (comparação tolerante a acentos/caixa)
   ========================================================= */
function normalizarTexto(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function possuiValor(valor) {
    if (valor === null || valor === undefined) return false;
    const str = String(valor).trim();
    return str !== "" && str.toLowerCase() !== "null" && str.toLowerCase() !== "undefined";
}

/**
 * Verifica correspondência textual "parcial" entre dois campos
 * (um contém o outro), já normalizados.
 */
function correspondeParcialmente(a, b) {
    const na = normalizarTexto(a);
    const nb = normalizarTexto(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
}

/* =========================================================
   FUNÇÃO PRINCIPAL
   ========================================================= */

/**
 * Calcula o Lead Score de um lead com base nos dados disponíveis
 * e nos parâmetros usados na busca (para checar correspondência
 * de categoria/localização).
 *
 * @param {Object} lead - objeto de lead retornado pelo backend
 * @param {Object} searchParams - { tipo, localizacao } usados na busca
 * @returns {{
 *   score: number,
 *   nivel: string,
 *   label: string,
 *   emoji: string,
 *   motivos: Array<{ texto: string, positivo: boolean, emoji: string }>
 * }}
 */
function calculateLeadScore(lead, searchParams) {
    const params = searchParams || {};
    const motivos = [];
    let score = 0;

    const temTelefone = possuiValor(lead && lead.telefone);
    const temEmail = possuiValor(lead && lead.email);
    const temWebsite = possuiValor(lead && lead.website);

    /* --- Site --- */
    if (!temWebsite) {
        score += LEAD_SCORE_PESOS.SEM_SITE;
        motivos.push({ texto: "Não possui site", positivo: true, emoji: "fa-solid fa-globe" });
    } else {
        motivos.push({ texto: "Já possui site", positivo: false, emoji: "fa-solid fa-globe" });
    }

    /* --- Telefone --- */
    if (temTelefone) {
        score += LEAD_SCORE_PESOS.TELEFONE;
        motivos.push({ texto: "Telefone disponível", positivo: true, emoji: "fa-solid fa-phone" });
    }

    /* --- E-mail --- */
    if (temEmail) {
        score += LEAD_SCORE_PESOS.EMAIL;
        motivos.push({ texto: "E-mail disponível", positivo: true, emoji: "fa-solid fa-envelope" });
    }

    /* --- Penalidade: nenhum contato direto --- */
    if (!temTelefone && !temEmail) {
        score += LEAD_SCORE_PESOS.PENALIDADE_SEM_CONTATO;
        motivos.push({ texto: "Sem telefone e sem e-mail", positivo: false, emoji: "fa-solid fa-ban" });
    }

    /* --- Categoria corresponde ao nicho pesquisado --- */
    if (possuiValor(params.tipo) && possuiValor(lead && lead.tipo)) {
        if (correspondeParcialmente(lead.tipo, params.tipo)) {
            score += LEAD_SCORE_PESOS.CATEGORIA_CORRESPONDE;
            motivos.push({ texto: "Categoria corresponde ao nicho pesquisado", positivo: true, emoji: "fa-solid fa-building" });
        }
    }

    /* --- Localização corresponde à região pesquisada --- */
    if (possuiValor(params.localizacao) && possuiValor(lead && lead.endereco)) {
        if (correspondeParcialmente(lead.endereco, params.localizacao)) {
            score += LEAD_SCORE_PESOS.LOCALIZACAO_CORRESPONDE;
            motivos.push({ texto: "Localização corresponde à busca", positivo: true, emoji: "fa-solid fa-location-dot" });
        }
    }

    /* --- Dados insuficientes (não inventamos pontuação) --- */
    if (!temTelefone && !temEmail && !possuiValor(lead && lead.endereco)) {
        motivos.push({ texto: "Poucos dados disponíveis para avaliar este lead", positivo: false, emoji: "fa-solid fa-circle-info" });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const faixa =
        LEAD_SCORE_FAIXAS.find((f) => score >= f.min && score <= f.max) ||
        LEAD_SCORE_FAIXAS[LEAD_SCORE_FAIXAS.length - 1];

    return {
        score,
        nivel: faixa.nivel,
        label: faixa.label,
        emoji: faixa.emoji,
        motivos
    };
}

/**
 * Retorna a classe CSS do badge de acordo com o nível de oportunidade.
 * Usada pelo leads.js na hora de renderizar os cards.
 */
function getLeadScoreBadgeClass(nivel) {
    switch (nivel) {
        case "alta":
            return "lead-score-badge--alta";
        case "media":
            return "lead-score-badge--media";
        case "baixa":
            return "lead-score-badge--baixa";
        default:
            return "lead-score-badge--nao-qualificado";
    }
}