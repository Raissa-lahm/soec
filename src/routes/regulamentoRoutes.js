// =========================================================================
// routes/regulamentoRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const RegulamentoController = require('../controllers/regulamentoController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

router.get('/regulamentos', autenticado, RegulamentoController.listar);
router.get('/regulamentos/novo/form', autenticado, somenteGestao, RegulamentoController.exibirFormCriar);
router.post('/regulamentos', autenticado, somenteGestao, RegulamentoController.criar);
router.get('/regulamentos/:id/editar', autenticado, somenteGestao, RegulamentoController.exibirFormEditar);
router.put('/regulamentos/:id', autenticado, somenteGestao, RegulamentoController.atualizar);
router.delete('/regulamentos/:id', autenticado, somenteGestao, RegulamentoController.excluir);

module.exports = router;
