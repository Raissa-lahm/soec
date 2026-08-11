// =====================================================================
// SOEC - Rotas de Horários das Turmas
// Salvar em: /routes/horarioRoutes.js
// =====================================================================

const express = require('express');
const router = express.Router();

const horarioController = require('../controllers/horarioController');
const uploadHorario = require('../middlewares/uploadHorarioMiddleware');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');

// Aba pública (aluno ou coordenação logados): ver os horários
router.get('/horarios', autenticado, horarioController.listar);

// Área da coordenação: ver status + enviar/atualizar o PDF de cada curso
router.get(
  '/admin/horarios',
  autenticado,
  somenteGestao,
  horarioController.adminListar
);

router.post(
  '/admin/horarios/enviar',
  autenticado,
  somenteGestao,
  uploadHorario.single('arquivo'),
  horarioController.adminEnviar
);

module.exports = router;