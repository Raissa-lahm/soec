// =========================================================================
// routes/eventoRoutes.js
// Rotas de eventos: visualizacao (todos os perfis logados) e
// criacao/edicao/exclusao (somente COORDENACAO e DIRECAO).
// =========================================================================

const express = require('express');
const router = express.Router();
const EventoController = require('../controllers/eventoController');
const InscricaoController = require('../controllers/inscricaoController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

// Pesquisa, filtro por categoria/data e listagem geral
router.get('/eventos', autenticado, EventoController.listar);

// IMPORTANTE: a rota de formulario de criacao precisa vir ANTES de "/:id"
// para o Express nao interpretar "novo" como um ID de evento.
router.get('/eventos/novo/form', autenticado, somenteGestao, EventoController.exibirFormCriar);
router.post('/eventos', autenticado, somenteGestao, EventoController.criar);

router.get('/eventos/:id/editar', autenticado, somenteGestao, EventoController.exibirFormEditar);
router.put('/eventos/:id', autenticado, somenteGestao, EventoController.atualizar);
router.delete('/eventos/:id', autenticado, somenteGestao, EventoController.excluir);

// Inscricao do aluno/professor em um evento
router.post('/eventos/:id/inscrever', autenticado, EventoController.inscrever);
router.post('/eventos/:id/cancelar-inscricao', autenticado, EventoController.cancelarInscricao);

// Gestao de inscritos de um evento especifico (somente gestao)
router.get('/eventos/:id/inscricoes', autenticado, somenteGestao, InscricaoController.gerenciarPorEvento);

// Detalhes do evento (deve ficar por ultimo, pois "/:id" e generico)
router.get('/eventos/:id', autenticado, EventoController.detalhes);

module.exports = router;
