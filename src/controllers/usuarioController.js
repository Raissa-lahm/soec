// =========================================================================
// controllers/usuarioController.js
// CRUD completo de usuarios - area administrativa (COORDENACAO/DIRECAO).
// =========================================================================

const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');

const SALT_ROUNDS = 10;

const UsuarioController = {

    // GET /admin -> painel administrativo (dashboard simples)
    async dashboard(req, res, next) {
        try {
            const usuarios = await UsuarioModel.listarTodos();
            const totais = {
                alunos: usuarios.filter(u => u.perfil === 'ALUNO').length,
                professores: usuarios.filter(u => u.perfil === 'PROFESSOR').length,
                coordenacao: usuarios.filter(u => u.perfil === 'COORDENACAO').length,
                direcao: usuarios.filter(u => u.perfil === 'DIRECAO').length
            };
            res.render('admin/dashboard', { totais });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /admin/usuarios -> lista usuarios, com filtro opcional por perfil
    async listar(req, res, next) {
        try {
            const { perfil } = req.query;
            const usuarios = await UsuarioModel.listarTodos(perfil);
            res.render('admin/usuarios', { usuarios, filtroPerfil: perfil || '' });
        } catch (erro) {
            next(erro);
        }
    },

    exibirFormCriar(req, res) {
        res.render('admin/usuarioForm', { usuario: null, acao: '/admin/usuarios' });
    },

    async exibirFormEditar(req, res, next) {
        try {
            const usuario = await UsuarioModel.buscarPorId(req.params.id);
            if (!usuario) return res.redirect('/admin/usuarios');
            res.render('admin/usuarioForm', { usuario, acao: `/admin/usuarios/${usuario.id}?_method=PUT` });
        } catch (erro) {
            next(erro);
        }
    },

    // POST /admin/usuarios -> cria um novo usuario (senha inicial obrigatoria)
    async criar(req, res, next) {
        try {
            const { nome, email, matricula, senha, perfil, curso, turma } = req.body;

            if (!nome || !email || !matricula || !senha || !perfil) {
                return res.status(400).render('admin/usuarioForm', {
                    usuario: req.body,
                    acao: '/admin/usuarios',
                    erro: 'Preencha todos os campos obrigatorios (nome, email, matricula, senha, perfil).'
                });
            }

            const emailExistente = await UsuarioModel.buscarPorEmail(email);
            const matriculaExistente = await UsuarioModel.buscarPorMatricula(matricula);
            if (emailExistente || matriculaExistente) {
                return res.status(400).render('admin/usuarioForm', {
                    usuario: req.body,
                    acao: '/admin/usuarios',
                    erro: 'Ja existe um usuario com este email ou matricula.'
                });
            }

            const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
            await UsuarioModel.criar({ nome, email, matricula, senhaHash, perfil, curso, turma });

            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    },

    // PUT /admin/usuarios/:id -> atualiza dados cadastrais (sem mexer na senha)
    async atualizar(req, res, next) {
        try {
            const { nome, email, matricula, perfil, curso, turma } = req.body;
            await UsuarioModel.atualizar(req.params.id, { nome, email, matricula, perfil, curso, turma });

            // Se uma nova senha foi informada no formulario, atualiza tambem
            if (req.body.senha && req.body.senha.trim().length > 0) {
                const senhaHash = await bcrypt.hash(req.body.senha, SALT_ROUNDS);
                await UsuarioModel.atualizarSenha(req.params.id, senhaHash);
            }

            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    },

    // DELETE /admin/usuarios/:id -> remove um usuario
    async excluir(req, res, next) {
        try {
            // Impede que o usuario logado exclua a si mesmo, evitando ficar "trancado" fora
            if (parseInt(req.params.id, 10) === req.session.usuario.id) {
                const usuarios = await UsuarioModel.listarTodos();
                return res.status(400).render('admin/usuarios', {
                    usuarios,
                    filtroPerfil: '',
                    erro: 'Voce nao pode excluir o proprio usuario enquanto estiver logado com ele.'
                });
            }
            await UsuarioModel.excluir(req.params.id);
            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = UsuarioController;
