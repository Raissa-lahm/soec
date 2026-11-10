// =========================================================================
// config/session.js
// Configuracao do express-session.
// Usamos o connect-pg-simple para guardar as sessoes na tabela "session"
// do proprio PostgreSQL (em vez de guardar em memoria, o que se perderia
// toda vez que o servidor reiniciasse).
// =========================================================================

require('dotenv').config();
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./database');

module.exports = session({
    store: new pgSession({
        pool: pool,          // usa a mesma conexao do banco principal
        tableName: 'session' // tabela criada no schema.sql
    }),
    secret: process.env.SESSION_SECRET, // usado para assinar o cookie
    resave: false,               // nao regrava a sessao se nada mudou
    saveUninitialized: false,    // nao cria sessao vazia para visitantes
    cookie: {
        httpOnly: true,           // cookie nao pode ser lido via JS no navegador
        secure: process.env.NODE_ENV === 'production', // exige HTTPS em producao
        maxAge: 1000 * 60 * 60 * 4 // sessao expira em 4 horas
    }
});
