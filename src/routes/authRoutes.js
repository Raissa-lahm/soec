// =========================================================================
// routes/authRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

router.get('/login', AuthController.exibirLogin);
router.post('/login', AuthController.processarLogin);
router.post('/logout', AuthController.logout);

// Cadastro publico: qualquer pessoa cria a propria conta (sempre como ALUNO)
router.get('/cadastro', AuthController.exibirCadastro);
router.post('/cadastro', AuthController.processarCadastro);

// Primeiro acesso: rotas publicas (a pessoa ainda nao tem senha para logar).
// A protecao esta na validacao matricula + codigo de ativacao do controller.
router.get('/primeiro-acesso', AuthController.exibirPrimeiroAcesso);
router.post('/primeiro-acesso', AuthController.processarPrimeiroAcesso);

module.exports = router;