/**
 * Pequenas funções de apoio para ligar o JavaScript aos estados visuais
 * que já existem no style.css (.is-error, .is-loading, .notice).
 * Usadas por login.js e cadastro.js.
 */

/** Marca um campo como inválido e mostra a mensagem abaixo dele. */
function showFieldError(inputEl, message) {
  const field = inputEl.closest(".field");
  if (!field) return;

  field.classList.add("is-error");

  let messageEl = field.querySelector(".field__message--error");
  if (!messageEl) {
    messageEl = document.createElement("span");
    messageEl.className = "field__message field__message--error";
    messageEl.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' +
      "<span></span>";
    field.appendChild(messageEl);
  }
  messageEl.querySelector("span").textContent = message;
}

/** Remove o estado de erro de um campo. */
function clearFieldError(inputEl) {
  const field = inputEl.closest(".field");
  if (!field) return;
  field.classList.remove("is-error");
}

/** Exibe o alerta geral do formulário (ex: erro de login, erro de conexão). */
function showAlert(alertEl, message) {
  if (!alertEl) return;
  alertEl.querySelector("span").textContent = message;
  alertEl.hidden = false;
}

/** Esconde o alerta geral do formulário. */
function hideAlert(alertEl) {
  if (!alertEl) return;
  alertEl.hidden = true;
}

/** Liga/desliga o estado de carregamento visual do botão (spinner do style.css). */
function setLoading(buttonEl, isLoading) {
  if (!buttonEl) return;
  buttonEl.classList.toggle("is-loading", isLoading);
  buttonEl.disabled = isLoading;
}
