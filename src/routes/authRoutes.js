// =========================================================================
// routes/authRoutes.js
// =========================================================================

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { rateLimit } = require('express-rate-limit');

function criarLimitador(view, fields) { return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    handler(req, res) {
        return res.status(429).render(view, { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', ...fields });
    }
}); }
const limitarLogin = criarLimitador('login', { matricula: '' });
const limitarPrimeiroAcesso = criarLimitador('primeiroAcesso', { matricula: '', email: '' });
function somenteTrocaObrigatoria(req,res,next) {
    if (!req.session.usuario?.deveTrocarSenha) return res.redirect('/');
    return next();
}

router.get('/login', AuthController.exibirLogin);
router.post('/login', limitarLogin, AuthController.processarLogin);
router.post('/logout', AuthController.logout);

// Primeiro acesso: só matrículas previamente autorizadas podem criar senha.
router.get('/primeiro-acesso', AuthController.exibirPrimeiroAcesso);
router.post('/primeiro-acesso', limitarPrimeiroAcesso, AuthController.processarPrimeiroAcesso);
router.get('/trocar-senha', require('../middlewares/authMiddleware'), somenteTrocaObrigatoria, AuthController.exibirTrocarSenha);
router.post('/trocar-senha', require('../middlewares/authMiddleware'), somenteTrocaObrigatoria, AuthController.processarTrocarSenha);

module.exports = router;
