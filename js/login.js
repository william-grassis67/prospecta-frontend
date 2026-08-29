/**
 * js/login.js
 * Lógica da tela de login (login.html).
 *
 * Depende de config.js, storage.js, api.js e ui-helpers.js, carregados antes
 * deste arquivo (ver a ordem de <script> em login.html).
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailField = document.getElementById("email");
  const senhaField = document.getElementById("senha");
  const submitButton = document.getElementById("loginSubmit");
  const formAlert = document.getElementById("formAlert");

  if (!form) return;

  // Trava simples para impedir envios simultâneos (ex: duplo clique/Enter
  // repetido) enquanto uma requisição já está em andamento.
  let isSubmitting = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    hideAlert(formAlert);
    clearFieldError(emailField);
    clearFieldError(senhaField);

    const email = emailField ? emailField.value.trim() : "";
    const password = senhaField ? senhaField.value : "";

    let hasError = false;

    if (!email) {
      showFieldError(emailField, "Informe seu e-mail.");
      hasError = true;
    }

    if (!password) {
      showFieldError(senhaField, "Informe sua senha.");
      hasError = true;
    }

    if (hasError) return;

    isSubmitting = true;
    setLoading(submitButton, true);

    try {
      // loginRequest (api.js) já retorna o JWT como string — o backend
      // responde ao login com o token em texto puro, não em JSON.
      const token = await loginRequest(email, password);

      // Salva o JWT via storage.js; nunca salvamos a senha em nenhum lugar.
      saveToken(token);

      window.location.href = "dashboard.html";
    } catch (error) {
      showAlert(formAlert, error.message || "Não foi possível realizar o login.");
      isSubmitting = false;
      setLoading(submitButton, false);
    }
  });
});