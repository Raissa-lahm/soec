// =========================================================================
// routes/equipeRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const EquipeController = require('../controllers/equipeController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

// Equipes de um evento especifico
router.get('/eventos/:eventoId/equipes', autenticado, EquipeController.listarPorEvento);
router.get('/eventos/:eventoId/equipes/novo/form', autenticado, somenteGestao, EquipeController.exibirFormCriar);
router.post('/eventos/:eventoId/equipes', autenticado, somenteGestao, EquipeController.criar);

// Detalhes/gestao de uma equipe especifica
router.get('/equipes/:id', autenticado, EquipeController.detalhes);
router.put('/equipes/:id', autenticado, somenteGestao, EquipeController.atualizar);
router.delete('/equipes/:id', autenticado, somenteGestao, EquipeController.excluir);

// Participacao do proprio aluno na equipe
router.post('/equipes/:id/entrar', autenticado, EquipeController.entrar);
router.post('/equipes/:id/sair', autenticado, EquipeController.sair);

// Gestao de membros pela coordenacao/direcao
router.post('/equipes/:id/membros', autenticado, somenteGestao, EquipeController.adicionarMembroPorMatricula);
router.delete('/equipes/:id/membros/:usuarioId', autenticado, somenteGestao, EquipeController.removerMembro);

module.exports = router;
