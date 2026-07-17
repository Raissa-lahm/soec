// =====================================================================
// SOEC - Configuração da sessão de autenticação
// Salvar em: /config/session.js
//
// Centraliza as opções do express-session para manter o app.js limpo
// e facilitar ajustes futuros (ex: trocar para store em banco/Redis).
// =====================================================================

require('dotenv').config();
const session = require('express-session');

module.exports = session({
  secret: process.env.SESSION_SECRET || 'segredo_padrao_trocar_em_producao',
  resave: false,             // não salva a sessão se nada foi alterado
  saveUninitialized: false,  // não cria sessão vazia para visitantes não logados
  cookie: {
    httpOnly: true,          // impede acesso ao cookie via JavaScript no navegador (proteção XSS)
    secure: false,           // true apenas se o site rodar em HTTPS
    maxAge: 1000 * 60 * 60 * 4 // sessão expira em 4 horas
  }
});