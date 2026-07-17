// =====================================================================
// SOEC - Controller de Eventos
// Salvar em: /controllers/eventoController.js
// =====================================================================

const eventoModel = require('../models/eventoModel');
const inscricaoModel = require('../models/inscricaoModel');
const equipeModel = require('../models/equipeModel');

module.exports = {
  // Lista de eventos (com pesquisa por texto, filtro de categoria e data)
  async listar(req, res) {
    try {
      const { busca, tipo, data } = req.query;
      const eventos = await eventoModel.listar({ busca, tipo, data });
      const tipos = await eventoModel.listarTipos();

      res.render('eventos/lista', {
        eventos,
        tipos,
        filtros: { busca: busca || '', tipo: tipo || '', data: data || '' }
      });
    } catch (erro) {
      console.error('Erro ao listar eventos:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os eventos.' });
    }
  },

  // Detalhes de um evento específico + suas equipes
  async detalhes(req, res) {
    try {
      const { id } = req.params;
      const evento = await eventoModel.buscarPorId(id);

      if (!evento) {
        return res.status(404).render('erro', { titulo: 'Evento não encontrado', mensagem: 'Este evento não existe ou foi removido.' });
      }

      const usuario = req.session.usuario;
      const equipes = await equipeModel.listarPorEvento(id);
      const jaInscrito = usuario ? await inscricaoModel.jaInscrito(usuario.id, id) : false;

      res.render('eventos/detalhes', { evento, equipes, jaInscrito });
    } catch (erro) {
      console.error('Erro ao exibir detalhes do evento:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar o evento.' });
    }
  },

  // Aluno se inscreve em um evento
  async inscrever(req, res) {
    try {
      const { id } = req.params; // id do evento
      const usuario = req.session.usuario;

      const evento = await eventoModel.buscarPorId(id);
      if (!evento) {
        return res.status(404).render('erro', { titulo: 'Evento não encontrado', mensagem: 'Este evento não existe.' });
      }

      const jaInscrito = await inscricaoModel.jaInscrito(usuario.id, id);
      if (jaInscrito) {
        return res.redirect(`/eventos/${id}`);
      }

      // Verifica limite de vagas, se houver
      if (evento.vagas_limite) {
        const totalInscritos = await inscricaoModel.contarPorEvento(id);
        if (totalInscritos >= evento.vagas_limite) {
          return res.render('erro', { titulo: 'Vagas esgotadas', mensagem: 'Este evento não possui mais vagas disponíveis.' });
        }
      }

      await inscricaoModel.criar({ usuario_id: usuario.id, evento_id: id });
      res.redirect(`/eventos/${id}`);
    } catch (erro) {
      console.error('Erro ao se inscrever no evento:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível concluir a inscrição.' });
    }
  },

  // Aluno cancela a própria inscrição
  async cancelarInscricao(req, res) {
    try {
      const { id } = req.params; // id do evento
      const usuario = req.session.usuario;
      await inscricaoModel.cancelar(usuario.id, id);
      res.redirect(`/eventos/${id}`);
    } catch (erro) {
      console.error('Erro ao cancelar inscrição:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível cancelar a inscrição.' });
    }
  },

  // ---------------- Área administrativa (Coordenação/Direção) ----------------

  async adminListar(req, res) {
    try {
      const eventos = await eventoModel.listar({});
      res.render('admin/eventos', { eventos });
    } catch (erro) {
      console.error('Erro ao listar eventos (admin):', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os eventos.' });
    }
  },

  adminNovoForm(req, res) {
    res.render('admin/evento_form', { evento: null, erro: null });
  },

  async adminCriar(req, res) {
    try {
      const { titulo, descricao, tipo, data_evento, local, vagas_limite } = req.body;

      if (!titulo || !tipo || !data_evento) {
        return res.render('admin/evento_form', { evento: req.body, erro: 'Preencha os campos obrigatórios: título, tipo e data.' });
      }

      await eventoModel.criar({
        titulo, descricao, tipo, data_evento, local,
        vagas_limite: vagas_limite ? parseInt(vagas_limite, 10) : null,
        criado_por: req.session.usuario.id
      });

      res.redirect('/admin/eventos');
    } catch (erro) {
      console.error('Erro ao criar evento:', erro);
      res.render('admin/evento_form', { evento: req.body, erro: 'Não foi possível criar o evento. Verifique os dados.' });
    }
  },

  async adminEditarForm(req, res) {
    try {
      const evento = await eventoModel.buscarPorId(req.params.id);
      if (!evento) {
        return res.status(404).render('erro', { titulo: 'Evento não encontrado', mensagem: 'Este evento não existe.' });
      }
      res.render('admin/evento_form', { evento, erro: null });
    } catch (erro) {
      console.error('Erro ao carregar evento para edição:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar o evento.' });
    }
  },

  async adminAtualizar(req, res) {
    try {
      const { id } = req.params;
      const { titulo, descricao, tipo, data_evento, local, vagas_limite } = req.body;

      if (!titulo || !tipo || !data_evento) {
        return res.render('admin/evento_form', { evento: { id, ...req.body }, erro: 'Preencha os campos obrigatórios.' });
      }

      await eventoModel.atualizar(id, {
        titulo, descricao, tipo, data_evento, local,
        vagas_limite: vagas_limite ? parseInt(vagas_limite, 10) : null
      });

      res.redirect('/admin/eventos');
    } catch (erro) {
      console.error('Erro ao atualizar evento:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível atualizar o evento.' });
    }
  },

  async adminExcluir(req, res) {
    try {
      await eventoModel.excluir(req.params.id);
      res.redirect('/admin/eventos');
    } catch (erro) {
      console.error('Erro ao excluir evento:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível excluir o evento.' });
    }
  },

  // Lista as inscrições de um evento específico (gerenciamento administrativo)
  async adminInscricoes(req, res) {
    try {
      const evento = await eventoModel.buscarPorId(req.params.id);
      const inscricoes = await inscricaoModel.listarPorEvento(req.params.id);
      res.render('admin/inscricoes', { evento, inscricoes });
    } catch (erro) {
      console.error('Erro ao listar inscrições:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar as inscrições.' });
    }
  },

  async adminExcluirInscricao(req, res) {
    try {
      const { eventoId, inscricaoId } = req.params;
      await inscricaoModel.excluirPorId(inscricaoId);
      res.redirect(`/admin/eventos/${eventoId}/inscricoes`);
    } catch (erro) {
      console.error('Erro ao excluir inscrição:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível excluir a inscrição.' });
    }
  }
};