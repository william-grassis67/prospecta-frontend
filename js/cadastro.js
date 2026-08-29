/**
 * js/cadastro.js
 * Lógica da tela de cadastro (cadastro.html).
 *
 * Depende de config.js, storage.js, api.js e ui-helpers.js, carregados antes
 * deste arquivo (mesma ordem usada em login.html — foram adicionados os
 * mesmos <script> em cadastro.html).
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("cadastroForm");
  if (!form) return;

  const fields = {
    nome: document.getElementById("nome"),
    email: document.getElementById("email"),
    senha: document.getElementById("senha"),
    confirmarSenha: document.getElementById("confirmarSenha"),
  };

  const formAlert = document.getElementById("formAlert");
  const formSuccess = document.getElementById("formSuccess");
  const submitButton = document.getElementById("cadastroSubmit");

  let isSubmitting = false;

  // Alterna mostrar/ocultar senha nos campos com botão de toggle
  document.querySelectorAll("[data-toggle-for]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-toggle-for");
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    hideAlert(formAlert);
    hideAlert(formSuccess);
    Object.values(fields).forEach((f) => f && clearFieldError(f));

    const nome = fields.nome ? fields.nome.value.trim() : "";
    const email = fields.email ? fields.email.value.trim() : "";
    const senha = fields.senha ? fields.senha.value : "";
    const confirmarSenha = fields.confirmarSenha ? fields.confirmarSenha.value : "";

    let hasError = false;

    if (!nome) {
      showFieldError(fields.nome, "Informe seu nome completo.");
      hasError = true;
    }

    if (!email) {
      showFieldError(fields.email, "Informe seu e-mail.");
      hasError = true;
    } else if (!isValidEmail(email)) {
      showFieldError(fields.email, "Informe um e-mail válido.");
      hasError = true;
    }

    if (!senha) {
      showFieldError(fields.senha, "Crie uma senha.");
      hasError = true;
    } else if (senha.length < 8) {
      showFieldError(fields.senha, "A senha deve ter no mínimo 8 caracteres.");
      hasError = true;
    }

    if (!confirmarSenha) {
      showFieldError(fields.confirmarSenha, "Confirme sua senha.");
      hasError = true;
    } else if (senha && confirmarSenha !== senha) {
      showFieldError(fields.confirmarSenha, "As senhas não coincidem.");
      hasError = true;
    }

    if (hasError) return;

    isSubmitting = true;
    setLoading(submitButton, true);

    // ATENÇÃO — ponto ainda não confirmado: os nomes dos campos abaixo
    // (name/email/password) seguem o único formato já usado no projeto
    // (cadastro.js antigo), mas eu não tive acesso ao DTO real de cadastro.
    // Se o seu DTO usar outros nomes (ex.: "nome" em vez de "name"), ajuste
    // apenas este objeto.
    const payload = {
      name: nome,
      email: email,
      password: senha,
    };

    try {
      const data = await registerRequest(payload);

      // O AuthService atual (trecho de cadastro) retorna o User salvo, sem
      // JWT. Se no futuro o backend passar a devolver um token junto com o
      // cadastro, ele é detectado aqui automaticamente e o usuário já entra
      // logado; caso contrário, seguimos para o login manual.
      const token = data && (data.token || data.jwt || data.accessToken);

      if (token) {
        saveToken(token);
        showAlert(formSuccess || formAlert, "Conta criada com sucesso! Entrando no sistema...");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1200);
      } else {
        showAlert(formSuccess || formAlert, "Conta criada com sucesso! Redirecionando para o login...");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1500);
      }
    } catch (error) {
      showAlert(formAlert, error.message || "Não foi possível concluir o cadastro. Tente novamente.");
      isSubmitting = false;
      setLoading(submitButton, false);
    }
  });

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
});