// =========================================================================
// controllers/eventoController.js
// CRUD completo de eventos + pesquisa + filtro por categoria e data.
// =========================================================================

const EventoModel = require('../models/eventoModel');
const InscricaoModel = require('../models/inscricaoModel');
const EquipeModel = require('../models/equipeModel');

const EventoController = {

    // GET /eventos -> lista de eventos, com pesquisa e filtros via querystring
    async listar(req, res, next) {
        try {
            const { pesquisa, tipo, data } = req.query;
            const eventos = await EventoModel.listar({ pesquisa, tipo, data });
            const tiposDisponiveis = await EventoModel.listarTiposDistintos();

            res.render('eventos/lista', {
                eventos,
                tiposDisponiveis,
                filtros: { pesquisa: pesquisa || '', tipo: tipo || '', data: data || '' }
            });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /eventos/:id -> detalhes do evento + equipes + status de inscricao do usuario
    async detalhes(req, res, next) {
        try {
            const evento = await EventoModel.buscarPorId(req.params.id);
            if (!evento) {
                return res.status(404).render('error', {
                    titulo: 'Evento nao encontrado',
                    mensagem: 'O evento solicitado nao existe ou foi removido.',
                    usuarioLogado: req.session.usuario
                });
            }

            const usuario = req.session.usuario;
            const jaInscrito = usuario
                ? await InscricaoModel.jaInscrito(usuario.id, evento.id)
                : false;

            const equipes = await EquipeModel.listarPorEvento(evento.id);

            res.render('eventos/detalhes', { evento, jaInscrito, equipes });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /eventos/novo/form -> formulario de criacao (somente gestao)
    exibirFormCriar(req, res) {
        res.render('eventos/form', { evento: null, acao: '/eventos' });
    },

    // GET /eventos/:id/editar -> formulario de edicao (somente gestao)
    async exibirFormEditar(req, res, next) {
        try {
            const evento = await EventoModel.buscarPorId(req.params.id);
            if (!evento) return res.redirect('/eventos');
            res.render('eventos/form', { evento, acao: `/eventos/${evento.id}?_method=PUT` });
        } catch (erro) {
            next(erro);
        }
    },

    // POST /eventos -> cria um novo evento
    async criar(req, res, next) {
        try {
            const { titulo, descricao, tipo, data_evento, local, vagas_limite } = req.body;

            if (!titulo || !tipo || !data_evento) {
                return res.status(400).render('eventos/form', {
                    evento: req.body,
                    acao: '/eventos',
                    erro: 'Preencha ao menos titulo, tipo e data do evento.'
                });
            }

            await EventoModel.criar({
                titulo, descricao, tipo, data_evento, local,
                vagas_limite: parseInt(vagas_limite, 10) || 0,
                criado_por: req.session.usuario.id
            });

            res.redirect('/eventos');
        } catch (erro) {
            next(erro);
        }
    },

    // PUT /eventos/:id -> atualiza um evento existente
    async atualizar(req, res, next) {
        try {
            const { titulo, descricao, tipo, data_evento, local, vagas_limite } = req.body;
            await EventoModel.atualizar(req.params.id, {
                titulo, descricao, tipo, data_evento, local,
                vagas_limite: parseInt(vagas_limite, 10) || 0
            });
            res.redirect(`/eventos/${req.params.id}`);
        } catch (erro) {
            next(erro);
        }
    },

    // DELETE /eventos/:id -> exclui um evento
    async excluir(req, res, next) {
        try {
            await EventoModel.excluir(req.params.id);
            res.redirect('/eventos');
        } catch (erro) {
            next(erro);
        }
    },

    // POST /eventos/:id/inscrever -> aluno se inscreve em um evento
    async inscrever(req, res, next) {
        try {
            const evento = await EventoModel.buscarPorId(req.params.id);
            const usuario = req.session.usuario;

            if (!evento) return res.redirect('/eventos');

            const jaInscrito = await InscricaoModel.jaInscrito(usuario.id, evento.id);
            if (jaInscrito) {
                return res.redirect(`/eventos/${evento.id}`);
            }

            // Verifica limite de vagas (0 = sem limite)
            if (evento.vagas_limite > 0) {
                const totalInscritos = await InscricaoModel.contarInscritos(evento.id);
                if (totalInscritos >= evento.vagas_limite) {
                    return res.status(400).render('error', {
                        titulo: 'Vagas esgotadas',
                        mensagem: 'Este evento ja atingiu o limite maximo de vagas.',
                        usuarioLogado: usuario
                    });
                }
            }

            await InscricaoModel.criar(usuario.id, evento.id);
            res.redirect(`/eventos/${evento.id}`);
        } catch (erro) {
            next(erro);
        }
    },

    // POST /eventos/:id/cancelar-inscricao -> aluno cancela sua propria inscricao
    async cancelarInscricao(req, res, next) {
        try {
            await InscricaoModel.cancelar(req.session.usuario.id, req.params.id);
            res.redirect(`/eventos/${req.params.id}`);
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = EventoController;
