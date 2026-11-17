// =========================================================================
// controllers/comunicadoController.js
// CRUD completo de comunicados.
// =========================================================================

const ComunicadoModel = require('../models/comunicadoModel');

function dataValida(valor) {
    if (!valor) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function erroDatas({ data_evento, prazo_final }) {
    if (!dataValida(data_evento) || !dataValida(prazo_final)) return 'Informe datas válidas.';
    if (data_evento && prazo_final && prazo_final < data_evento) return 'O prazo final não pode ser anterior à data da atividade.';
    return null;
}

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
            const { titulo, descricao, data_evento, prazo_final } = req.body;
            const problemaDatas = erroDatas({ data_evento, prazo_final });
            if (!titulo || problemaDatas) {
                return res.status(400).render('comunicados/form', {
                    comunicado: req.body,
                    acao: '/comunicados',
                    erro: problemaDatas || 'O título do comunicado é obrigatório.'
                });
            }
            await ComunicadoModel.criar({ titulo, descricao, data_evento, prazo_final, criado_por: req.session.usuario.id });
            res.redirect('/comunicados');
        } catch (erro) {
            next(erro);
        }
    },

    async atualizar(req, res, next) {
        try {
            const { titulo, descricao, data_evento, prazo_final } = req.body;
            const problemaDatas = erroDatas({ data_evento, prazo_final });
            if (!titulo || problemaDatas) {
                const comunicado = { ...req.body, id: req.params.id };
                return res.status(400).render('comunicados/form', {
                    comunicado,
                    acao: `/comunicados/${req.params.id}?_method=PUT`,
                    erro: problemaDatas || 'O título do comunicado é obrigatório.'
                });
            }
            await ComunicadoModel.atualizar(req.params.id, { titulo, descricao, data_evento, prazo_final });
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
