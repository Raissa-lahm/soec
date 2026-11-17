// =========================================================================
// routes/adminRoutes.js
// Todas as rotas aqui exigem perfil COORDENACAO ou DIRECAO.
// =========================================================================

const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/usuarioController');
const autenticado = require('../middlewares/authMiddleware');
const { somenteGestao, somenteDirecao } = require('../middlewares/permissaoMiddleware');
const uploadUsuarios = require('../middlewares/uploadUsuariosMiddleware');
const EscolarController = require('../controllers/escolarController');
const RestricaoController = require('../controllers/restricaoController');

router.get('/admin', autenticado, somenteGestao, UsuarioController.dashboard);
router.get('/admin/gestao-escolar', autenticado, somenteGestao, EscolarController.inicio);
router.post('/admin/anos-letivos', autenticado, somenteGestao, EscolarController.salvarAno);
router.delete('/admin/anos-letivos/:ano', autenticado, somenteGestao, EscolarController.excluirAno);
router.post('/admin/trimestres', autenticado, somenteGestao, EscolarController.salvarTrimestre);
router.delete('/admin/trimestres/:id', autenticado, somenteGestao, EscolarController.excluirTrimestre);
router.post('/admin/turmas', autenticado, somenteGestao, EscolarController.salvarTurma);
router.put('/admin/turmas/:id', autenticado, somenteGestao, EscolarController.salvarTurma);
router.post('/admin/turmas/:id/desativar', autenticado, somenteGestao, EscolarController.desativarTurma);
router.post('/admin/calendario-datas', autenticado, somenteGestao, EscolarController.salvarData);
router.put('/admin/calendario-datas/:id', autenticado, somenteGestao, EscolarController.salvarData);
router.delete('/admin/calendario-datas/:id', autenticado, somenteGestao, EscolarController.excluirData);
router.post('/admin/calendario-datas/copiar', autenticado, somenteGestao, EscolarController.copiarDatas);
router.get('/admin/alunos-sem-turma', autenticado, somenteGestao, EscolarController.listarSemTurma);
router.post('/admin/alunos/:id/turma', autenticado, somenteGestao, EscolarController.corrigirTurma);

router.get('/admin/restricoes', autenticado, somenteDirecao, RestricaoController.listar);
router.post('/admin/restricoes', autenticado, somenteDirecao, RestricaoController.criar);
router.post('/admin/restricoes/:id/revogar', autenticado, somenteDirecao, RestricaoController.revogar);

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
