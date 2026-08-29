/**
 * Funções para salvar, ler e remover o token JWT no navegador (localStorage).
 * Mantidas separadas para facilitar a troca por outra estratégia de
 * armazenamento no futuro (ex: cookies), sem mexer no resto do código.
 */

function saveToken(token) {
  localStorage.setItem("token", token);
}

function getToken() {
  return localStorage.getItem("token");
}

function removeToken() {
  localStorage.removeItem("token");
}
