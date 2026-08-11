// =========================================================================
// controllers/comunicadoController.js
// CRUD completo de comunicados.
// =========================================================================

const ComunicadoModel = require('../models/comunicadoModel');

const ComunicadoController = {

    async listar(req, res, next) {
        try {
            const comunicados = await ComunicadoModel.listar();
            res.render('comunicados/lista', { comunicados });
        } catch (erro) {
            next(erro);
        }
    },

    exibirFormCriar(req, res) {
        res.render('comunicados/form', { comunicado: null, acao: '/comunicados' });
    },

    async exibirFormEditar(req, res, next) {
        try {
            const comunicado = await ComunicadoModel.buscarPorId(req.params.id);
            if (!comunicado) return res.redirect('/comunicados');
            res.render('comunicados/form', { comunicado, acao: `/comunicados/${comunicado.id}?_method=PUT` });
        } catch (erro) {
            next(erro);
        }
    },

    async criar(req, res, next) {
        try {
            const { titulo, descricao } = req.body;
            if (!titulo) {
                return res.status(400).render('comunicados/form', {
                    comunicado: req.body,
                    acao: '/comunicados',
                    erro: 'O titulo do comunicado e obrigatorio.'
                });
            }
            await ComunicadoModel.criar({ titulo, descricao, criado_por: req.session.usuario.id });
            res.redirect('/comunicados');
        } catch (erro) {
            next(erro);
        }
    },

    async atualizar(req, res, next) {
        try {
            const { titulo, descricao } = req.body;
            await ComunicadoModel.atualizar(req.params.id, { titulo, descricao });
            res.redirect('/comunicados');
        } catch (erro) {
            next(erro);
        }
    },

    async excluir(req, res, next) {
        try {
            await ComunicadoModel.excluir(req.params.id);
            res.redirect('/comunicados');
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = ComunicadoController;
