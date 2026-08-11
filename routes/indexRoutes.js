// =========================================================================
// routes/indexRoutes.js
// Rotas da pagina inicial e do calendario institucional (exigem login).
// =========================================================================

const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/homeController');
const autenticado = require('../middlewares/authMiddleware');

router.get('/', autenticado, HomeController.index);
router.get('/calendario', autenticado, HomeController.calendario);

module.exports = router;
