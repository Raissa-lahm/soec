// =========================================================================
// routes/inscricaoRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const InscricaoController = require('../controllers/inscricaoController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

router.get('/minhas-inscricoes', autenticado, InscricaoController.minhasInscricoes);
router.delete('/inscricoes/:id', autenticado, somenteGestao, InscricaoController.excluir);
router.post('/inscricoes/:id/pagamento', autenticado, somenteGestao, InscricaoController.confirmarPagamento);
router.post('/inscricoes/:id/isentar', autenticado, somenteGestao, InscricaoController.isentar);
router.post('/inscricoes/:id/autorizacao', autenticado, somenteGestao, InscricaoController.confirmarAutorizacao);
router.post('/inscricoes/:id/cancelar', autenticado, somenteGestao, InscricaoController.cancelarGestao);
router.post('/inscricoes/:id/cpf/revelar', autenticado, somenteGestao, InscricaoController.revelarCpf);

module.exports = router;
