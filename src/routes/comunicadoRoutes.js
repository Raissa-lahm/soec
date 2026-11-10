// =========================================================================
// routes/comunicadoRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const ComunicadoController = require('../controllers/comunicadoController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

router.get('/comunicados', autenticado, ComunicadoController.listar);
router.get('/comunicados/novo/form', autenticado, somenteGestao, ComunicadoController.exibirFormCriar);
router.post('/comunicados', autenticado, somenteGestao, ComunicadoController.criar);
router.get('/comunicados/:id/editar', autenticado, somenteGestao, ComunicadoController.exibirFormEditar);
router.put('/comunicados/:id', autenticado, somenteGestao, ComunicadoController.atualizar);
router.delete('/comunicados/:id', autenticado, somenteGestao, ComunicadoController.excluir);

module.exports = router;
