// =========================================================================
// controllers/inscricaoController.js
// Gerenciamento (CRUD) de inscricoes pela coordenacao/direcao, e listagem
// de "meus eventos" pelo aluno/professor.
// =========================================================================

const InscricaoModel = require('../models/inscricaoModel');
const EventoModel = require('../models/eventoModel');

const InscricaoController = {

    // GET /minhas-inscricoes -> lista as inscricoes do usuario logado
    async minhasInscricoes(req, res, next) {
        try {
            const inscricoes = await InscricaoModel.listarPorUsuario(req.session.usuario.id);
            res.render('inscricoes/minhas', { inscricoes });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /eventos/:id/inscricoes -> gestao ve todos os inscritos em um evento
    async gerenciarPorEvento(req, res, next) {
        try {
            const evento = await EventoModel.buscarPorId(req.params.id);
            if (!evento) return res.redirect('/eventos');
            const inscricoes = await InscricaoModel.listarPorEvento(evento.id);
            res.render('inscricoes/gerenciar', { evento, inscricoes });
        } catch (erro) {
            next(erro);
        }
    },

    // DELETE /inscricoes/:id -> gestao remove a inscricao de um aluno
    async excluir(req, res, next) {
        try {
            await InscricaoModel.excluirPorId(req.params.id);
            res.redirect('back');
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = InscricaoController;
