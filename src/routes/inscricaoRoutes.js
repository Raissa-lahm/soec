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

module.exports = router;
