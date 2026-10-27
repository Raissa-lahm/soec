// =========================================================================
// controllers/regulamentoController.js
// CRUD completo de regulamentos.
// =========================================================================

const RegulamentoModel = require('../models/regulamentoModel');

const RegulamentoController = {

    async listar(req, res, next) {
        try {
            const regulamentos = await RegulamentoModel.listar();
            res.render('regulamentos/lista', { regulamentos });
        } catch (erro) {
            next(erro);
        }
    },

    exibirFormCriar(req, res) {
        res.render('regulamentos/form', { regulamento: null, acao: '/regulamentos' });
    },

    async exibirFormEditar(req, res, next) {
        try {
            const regulamento = await RegulamentoModel.buscarPorId(req.params.id);
            if (!regulamento) return res.redirect('/regulamentos');
            res.render('regulamentos/form', { regulamento, acao: `/regulamentos/${regulamento.id}?_method=PUT` });
        } catch (erro) {
            next(erro);
        }
    },

    async criar(req, res, next) {
        try {
            const { titulo, descricao, arquivo_url } = req.body;
            if (!titulo) {
                return res.status(400).render('regulamentos/form', {
                    regulamento: req.body,
                    acao: '/regulamentos',
                    erro: 'O titulo do regulamento e obrigatorio.'
                });
            }
            await RegulamentoModel.criar({ titulo, descricao, arquivo_url, criado_por: req.session.usuario.id });
            res.redirect('/regulamentos');
        } catch (erro) {
            next(erro);
        }
    },

    async atualizar(req, res, next) {
        try {
            const { titulo, descricao, arquivo_url } = req.body;
            await RegulamentoModel.atualizar(req.params.id, { titulo, descricao, arquivo_url });
            res.redirect('/regulamentos');
        } catch (erro) {
            next(erro);
        }
    },

    async excluir(req, res, next) {
        try {
            await RegulamentoModel.excluir(req.params.id);
            res.redirect('/regulamentos');
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = RegulamentoController;
