// =========================================================================
// routes/adminRoutes.js
// Todas as rotas aqui exigem perfil COORDENACAO ou DIRECAO.
// =========================================================================

const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/usuarioController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao } = require('../middlewares/permissaoMiddleware');
const uploadUsuarios = require('../middlewares/uploadUsuariosMiddleware');

router.get('/admin', autenticado, somenteGestao, UsuarioController.dashboard);

router.get('/admin/usuarios', autenticado, somenteGestao, UsuarioController.listar);
router.get('/admin/usuarios/novo/form', autenticado, somenteGestao, UsuarioController.exibirFormCriar);
router.post('/admin/usuarios', autenticado, somenteGestao, UsuarioController.criar);
router.get('/admin/usuarios/:id/editar', autenticado, somenteGestao, UsuarioController.exibirFormEditar);
router.put('/admin/usuarios/:id', autenticado, somenteGestao, UsuarioController.atualizar);
router.delete('/admin/usuarios/:id', autenticado, somenteGestao, UsuarioController.excluir);
router.post('/admin/usuarios/:id/redefinir-acesso', autenticado, somenteGestao, UsuarioController.redefinirAcesso);
router.get('/admin/usuarios/importar', autenticado, somenteGestao, UsuarioController.exibirImportacao);
router.post('/admin/usuarios/importar', autenticado, somenteGestao, uploadUsuarios.single('arquivo'), UsuarioController.importar);

module.exports = router;
