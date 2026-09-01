/**
 * js/forgotpassword.js
 * Lógica da tela de recuperação de senha (forgotpassword.html), agora em
 * 3 etapas: e-mail → código de 6 dígitos → nova senha.
 *
 * Depende de config.js, api.js e ui-helpers.js, carregados antes deste
 * arquivo (ver ordem de <script> em forgotpassword.html).
 */

document.addEventListener("DOMContentLoaded", () => {
    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");
    const successNotice = document.getElementById("successNotice");

    if (!step1) return;

    // Estado da tela: e-mail informado, resetToken emitido após verificar o código.
    let currentEmail = "";
    let resetToken = "";
    let resendCooldownInterval = null;

    /* =========================================================
       ETAPA 1 — solicitar código
       ========================================================= */

    const forgotForm = document.getElementById("forgotForm");
    const emailField = document.getElementById("email");
    const forgotSubmit = document.getElementById("forgotSubmit");
    const step1Alert = document.getElementById("step1Alert");

    let isSubmittingStep1 = false;

    forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmittingStep1) return;

        hideAlert(step1Alert);
        if (emailField) clearFieldError(emailField);

        const email = emailField ? emailField.value.trim() : "";

        if (!email) {
            showFieldError(emailField, "Informe seu e-mail.");
            return;
        }
        if (!isValidEmail(email)) {
            showFieldError(emailField, "Informe um e-mail válido.");
            return;
        }

        isSubmittingStep1 = true;
        setLoading(forgotSubmit, true);

        try {
            await forgotPasswordRequest(email);
            currentEmail = email;
            goToStep2();
        } catch (error) {
            showAlert(step1Alert, error.message || "Não foi possível enviar o código. Tente novamente.");
        } finally {
            isSubmittingStep1 = false;
            setLoading(forgotSubmit, false);
        }
    });

    /* =========================================================
       ETAPA 2 — código de verificação
       ========================================================= */

    const codeForm = document.getElementById("codeForm");
    const codeInputs = Array.from(document.querySelectorAll(".code-input"));
    const verifySubmit = document.getElementById("verifySubmit");
    const step2Alert = document.getElementById("step2Alert");
    const maskedEmailEl = document.getElementById("maskedEmail");
    const resendCodeBtn = document.getElementById("resendCodeBtn");

    let isSubmittingStep2 = false;

    // Aceita apenas números, avança automaticamente, volta com Backspace.
    codeInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
            if (input.value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" && !input.value && index > 0) {
                codeInputs[index - 1].focus();
                codeInputs[index - 1].value = "";
            }
        });

        // Permite colar os 6 números de uma vez em qualquer campo.
        input.addEventListener("paste", (event) => {
            event.preventDefault();
            const pasted = (event.clipboardData || window.clipboardData)
                .getData("text")
                .replace(/[^0-9]/g, "")
                .slice(0, codeInputs.length);

            pasted.split("").forEach((digit, i) => {
                if (codeInputs[i]) codeInputs[i].value = digit;
            });

            const nextIndex = Math.min(pasted.length, codeInputs.length - 1);
            codeInputs[nextIndex].focus();
        });
    });

    codeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmittingStep2) return;

        hideAlert(step2Alert);

        const code = codeInputs.map((input) => input.value).join("");

        if (code.length !== 6) {
            showAlert(step2Alert, "Digite os 6 dígitos do código.");
            return;
        }

        isSubmittingStep2 = true;
        setLoading(verifySubmit, true);

        try {
            const data = await verifyResetCodeRequest(currentEmail, code);
            resetToken = data && data.resetToken;
            goToStep3();
        } catch (error) {
            showAlert(step2Alert, error.message || "O código informado está incorreto.");
            codeInputs.forEach((input) => (input.value = ""));
            codeInputs[0].focus();
        } finally {
            isSubmittingStep2 = false;
            setLoading(verifySubmit, false);
        }
    });

    resendCodeBtn.addEventListener("click", async () => {
        if (resendCodeBtn.disabled) return;

        hideAlert(step2Alert);
        resendCodeBtn.disabled = true;

        try {
            await forgotPasswordRequest(currentEmail);
            codeInputs.forEach((input) => (input.value = ""));
            codeInputs[0].focus();
            startResendCooldown();
        } catch (error) {
            showAlert(step2Alert, error.message || "Não foi possível reenviar o código. Tente novamente.");
            resendCodeBtn.disabled = false;
        }
    });

    function startResendCooldown() {
        let secondsLeft = 60;
        resendCodeBtn.disabled = true;
        resendCodeBtn.textContent = `Reenviar código (${secondsLeft}s)`;

        clearInterval(resendCooldownInterval);
        resendCooldownInterval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                clearInterval(resendCooldownInterval);
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = "Reenviar código";
            } else {
                resendCodeBtn.textContent = `Reenviar código (${secondsLeft}s)`;
            }
        }, 1000);
    }

    /* =========================================================
       ETAPA 3 — nova senha
       ========================================================= */

    const newPasswordForm = document.getElementById("newPasswordForm");
    const novaSenhaField = document.getElementById("novaSenha");
    const confirmarNovaSenhaField = document.getElementById("confirmarNovaSenha");
    const newPasswordSubmit = document.getElementById("newPasswordSubmit");
    const step3Alert = document.getElementById("step3Alert");

    let isSubmittingStep3 = false;

    newPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmittingStep3) return;

        hideAlert(step3Alert);
        clearFieldError(novaSenhaField);
        clearFieldError(confirmarNovaSenhaField);

        const novaSenha = novaSenhaField.value;
        const confirmarNovaSenha = confirmarNovaSenhaField.value;

        let hasError = false;

        if (!novaSenha) {
            showFieldError(novaSenhaField, "Crie uma senha.");
            hasError = true;
        } else if (novaSenha.length < 8) {
            showFieldError(novaSenhaField, "A senha deve ter no mínimo 8 caracteres.");
            hasError = true;
        }

        if (!confirmarNovaSenha) {
            showFieldError(confirmarNovaSenhaField, "Confirme sua senha.");
            hasError = true;
        } else if (novaSenha && confirmarNovaSenha !== novaSenha) {
            showFieldError(confirmarNovaSenhaField, "As senhas não coincidem.");
            hasError = true;
        }

        if (hasError) return;

        isSubmittingStep3 = true;
        setLoading(newPasswordSubmit, true);

        try {
            await resetPasswordRequest(resetToken, novaSenha);
            step3.hidden = true;
            if (successNotice) successNotice.hidden = false;
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1800);
        } catch (error) {
            showAlert(step3Alert, error.message || "Não foi possível alterar sua senha.");
            isSubmittingStep3 = false;
            setLoading(newPasswordSubmit, false);
        }
    });

    /* =========================================================
       NAVEGAÇÃO ENTRE ETAPAS
       ========================================================= */

    function goToStep2() {
        step1.hidden = true;
        step2.hidden = false;
        if (maskedEmailEl) maskedEmailEl.textContent = maskEmail(currentEmail);
        startResendCooldown();
        codeInputs[0].focus();
    }

    function goToStep3() {
        step2.hidden = true;
        step3.hidden = false;
        clearInterval(resendCooldownInterval);
        novaSenhaField.focus();
    }

    function maskEmail(email) {
        const [local, domain] = email.split("@");
        if (!local || !domain) return email;
        const maskedLocal = local.charAt(0) + "***";
        return `${maskedLocal}@${domain}`;
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
});