// =========================================================================
// routes/authRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.get('/login', AuthController.exibirLogin);
router.post('/login', AuthController.processarLogin);
router.post('/logout', AuthController.logout);

// Primeiro acesso: só matrículas previamente autorizadas podem criar senha.
router.get('/primeiro-acesso', AuthController.exibirPrimeiroAcesso);
router.post('/primeiro-acesso', AuthController.processarPrimeiroAcesso);

module.exports = router;
