// =========================================================================
// app.js
// Arquivo principal do SOEC - Sistema de Organizacao de Eventos do CIMOL.
// Aqui configuramos o Express, os middlewares globais, a sessao, o motor
// de views (EJS) e registramos todas as rotas da aplicacao.
// =========================================================================

require('dotenv').config();

const express = require('express');
const path = require('path');
const methodOverride = require('method-override');

const sessionConfig = require('./config/session');
const errorMiddleware = require('./middlewares/errorMiddleware');

// Importacao de todas as rotas
const authRoutes = require('./routes/authRoutes');
const indexRoutes = require('./routes/indexRoutes');
const eventoRoutes = require('./routes/eventoRoutes');
const comunicadoRoutes = require('./routes/comunicadoRoutes');
const regulamentoRoutes = require('./routes/regulamentoRoutes');
const inscricaoRoutes = require('./routes/inscricaoRoutes');
const equipeRoutes = require('./routes/equipeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const horarioRoutes = require('./routes/horarioRoutes');

const app = express();

// -------------------------------------------------------------------
// Configuracao do motor de views (EJS)
// -------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------------------------------------------------------
// Middlewares globais
// -------------------------------------------------------------------

// Serve arquivos estaticos (CSS, JS do cliente, imagens) da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Faz o parse do corpo das requisicoes (formularios HTML e JSON)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Permite que formularios HTML (que so suportam GET/POST) simulem
// verbos PUT e DELETE usando "?_method=PUT" na action do form.
app.use(methodOverride('_method'));

// Sessao autenticada (armazenada no PostgreSQL, ver config/session.js)
app.use(sessionConfig);

// Disponibiliza o usuario logado (se houver) em todas as views,
// sem precisar passar manualmente em cada res.render
app.use((req, res, next) => {
    res.locals.usuarioLogado = req.session.usuario || null;
    res.locals.rotaAtual = req.originalUrl;
    next();
});

// -------------------------------------------------------------------
// Rotas
// -------------------------------------------------------------------
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/', eventoRoutes);
app.use('/', comunicadoRoutes);
app.use('/', regulamentoRoutes);
app.use('/', inscricaoRoutes);
app.use('/', equipeRoutes);
app.use('/', adminRoutes);
app.use('/', horarioRoutes);

// -------------------------------------------------------------------
// Tratamento de erros (SEMPRE por ultimo)
// -------------------------------------------------------------------
app.use(errorMiddleware.naoEncontrado); // captura rotas 404
app.use(errorMiddleware);               // captura qualquer outro erro

// -------------------------------------------------------------------
// Inicializacao do servidor
// -------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SOEC] Servidor rodando em http://localhost:${PORT}`);
});