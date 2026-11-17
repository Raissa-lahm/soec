// =========================================================================
// controllers/equipeController.js
// CRUD completo de equipes + gerenciamento de membros.
// =========================================================================

const EquipeModel = require('../models/equipeModel');
const EventoModel = require('../models/eventoModel');
const UsuarioModel = require('../models/usuarioModel');
const InscricaoModel = require('../models/inscricaoModel');
const { verificarElegibilidade } = require('../utils/elegibilidade');

const EquipeController = {

    // GET /eventos/:eventoId/equipes -> lista equipes de um evento
    async listarPorEvento(req, res, next) {
        try {
            const evento = await EventoModel.buscarPorId(req.params.eventoId);
            if (!evento) return res.redirect('/eventos');
            const equipes = await EquipeModel.listarPorEvento(evento.id);
            res.render('equipes/lista', { evento, equipes });
        } catch (erro) {
            next(erro);
        }
    },

    exibirFormCriar(req, res) {
        res.render('equipes/form', { equipe: null, eventoId: req.params.eventoId });
    },

    async criar(req, res, next) {
        try {
            const { nome, modalidade } = req.body;
            const eventoId = req.params.eventoId;
            if (!nome) {
                return res.status(400).render('equipes/form', {
                    equipe: req.body,
                    eventoId,
                    erro: 'O nome da equipe e obrigatorio.'
                });
            }
            await EquipeModel.criar({ nome, modalidade, evento_id: eventoId });
            res.redirect(`/eventos/${eventoId}/equipes`);
        } catch (erro) {
            next(erro);
        }
    },

    // GET /equipes/:id -> detalhes da equipe + membros + participar
    async detalhes(req, res, next) {
        try {
            const equipe = await EquipeModel.buscarPorId(req.params.id);
            if (!equipe) return res.redirect('/eventos');

            const membros = await EquipeModel.listarMembros(equipe.id);
            const usuario = req.session.usuario;
            const jaEhMembro = usuario ? await EquipeModel.jaEhMembro(equipe.id, usuario.id) : false;

            res.render('equipes/detalhes', { equipe, membros, jaEhMembro });
        } catch (erro) {
            next(erro);
        }
    },

    async atualizar(req, res, next) {
        try {
            const { nome, modalidade } = req.body;
            const equipe = await EquipeModel.atualizar(req.params.id, { nome, modalidade });
            res.redirect(`/equipes/${equipe.id}`);
        } catch (erro) {
            next(erro);
        }
    },

    async excluir(req, res, next) {
        try {
            const equipe = await EquipeModel.buscarPorId(req.params.id);
            await EquipeModel.excluir(req.params.id);
            res.redirect(`/eventos/${equipe.evento_id}/equipes`);
        } catch (erro) {
            next(erro);
        }
    },

    // POST /equipes/:id/entrar -> aluno entra na equipe (ele mesmo)
    async entrar(req, res, next) {
        try {
            const equipeId = req.params.id;
            const usuarioId = req.session.usuario.id;
            const equipe = await EquipeModel.buscarPorId(equipeId);
            if (!equipe) return res.redirect('/eventos');
            const usuario = await UsuarioModel.buscarPorId(usuarioId);
            const evento = await EventoModel.buscarPorId(equipe.evento_id);
            const elegivel = usuario?.perfil === 'ALUNO' && await InscricaoModel.jaInscrito(usuarioId,equipe.evento_id) &&
                (await verificarElegibilidade(usuario,evento,{verificarInscricao:false,verificarVagas:false,validarDados:false})).ok;
            if (!elegivel) {
                const membros = await EquipeModel.listarMembros(equipeId);
                return res.status(403).render('equipes/detalhes',{equipe,membros,jaEhMembro:false,erro:'Este aluno não pode ser adicionado a esta equipe.'});
            }
            const jaEhMembro = await EquipeModel.jaEhMembro(equipeId, usuarioId);
            if (!jaEhMembro) {
                await EquipeModel.adicionarMembro(equipeId, usuarioId);
            }
            res.redirect(`/equipes/${equipeId}`);
        } catch (erro) {
            next(erro);
        }
    },

    // POST /equipes/:id/sair -> aluno sai da equipe (ele mesmo)
    async sair(req, res, next) {
        try {
            await EquipeModel.removerMembro(req.params.id, req.session.usuario.id);
            res.redirect(`/equipes/${req.params.id}`);
        } catch (erro) {
            next(erro);
        }
    },

    // POST /equipes/:id/membros -> gestao adiciona um membro pela matricula
    async adicionarMembroPorMatricula(req, res, next) {
        try {
            const { matricula } = req.body;
            const usuarioAlvo = await UsuarioModel.buscarPorMatricula(matricula);
            const equipe = await EquipeModel.buscarPorId(req.params.id);

            if (!usuarioAlvo) {
                const membros = await EquipeModel.listarMembros(req.params.id);
                return res.status(400).render('equipes/detalhes', {
                    equipe, membros, jaEhMembro: false,
                    erro: 'Nenhum usuario encontrado com essa matricula.'
                });
            }

            const evento=await EventoModel.buscarPorId(equipe.evento_id);
            const elegivel=usuarioAlvo.perfil==='ALUNO' && await InscricaoModel.jaInscrito(usuarioAlvo.id,equipe.evento_id) &&
                (await verificarElegibilidade(usuarioAlvo,evento,{verificarInscricao:false,verificarVagas:false,validarDados:false})).ok;
            if(!elegivel) {
                const membros=await EquipeModel.listarMembros(req.params.id);
                return res.status(400).render('equipes/detalhes',{equipe,membros,jaEhMembro:false,erro:'Este aluno não pode ser adicionado a esta equipe.'});
            }

            const jaEhMembro = await EquipeModel.jaEhMembro(req.params.id, usuarioAlvo.id);
            if (!jaEhMembro) {
                await EquipeModel.adicionarMembro(req.params.id, usuarioAlvo.id);
            }
            res.redirect(`/equipes/${req.params.id}`);
        } catch (erro) {
            next(erro);
        }
    },

    // DELETE /equipes/:id/membros/:usuarioId -> gestao remove um membro
    async removerMembro(req, res, next) {
        try {
            await EquipeModel.removerMembro(req.params.id, req.params.usuarioId);
            res.redirect(`/equipes/${req.params.id}`);
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = EquipeController;
