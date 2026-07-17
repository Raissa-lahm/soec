// =====================================================================
// SOEC - Controller de Comunicados
// Salvar em: /controllers/comunicadoController.js
// =====================================================================

const comunicadoModel = require('../models/comunicadoModel');

module.exports = {
  // Visão pública: lista de comunicados
  async listar(req, res) {
    try {
      const comunicados = await comunicadoModel.listar();
      res.render('comunicados', { comunicados });
    } catch (erro) {
      console.error('Erro ao listar comunicados:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os comunicados.' });
    }
  },

  // ---------------- Área administrativa ----------------

  async adminListar(req, res) {
    try {
      const comunicados = await comunicadoModel.listar();
      res.render('admin/comunicados', { comunicados });
    } catch (erro) {
      console.error('Erro ao listar comunicados (admin):', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os comunicados.' });
    }
  },

  adminNovoForm(req, res) {
    res.render('admin/comunicado_form', { comunicado: null, erro: null });
  },

  async adminCriar(req, res) {
    try {
      const { titulo, descricao } = req.body;

      if (!titulo || !descricao) {
        return res.render('admin/comunicado_form', { comunicado: req.body, erro: 'Preencha todos os campos.' });
      }

      await comunicadoModel.criar({ titulo, descricao, criado_por: req.session.usuario.id });
      res.redirect('/admin/comunicados');
    } catch (erro) {
      console.error('Erro ao criar comunicado:', erro);
      res.render('admin/comunicado_form', { comunicado: req.body, erro: 'Não foi possível publicar o comunicado.' });
    }
  },

  async adminEditarForm(req, res) {
    try {
      const comunicado = await comunicadoModel.buscarPorId(req.params.id);
      if (!comunicado) {
        return res.status(404).render('erro', { titulo: 'Não encontrado', mensagem: 'Comunicado não encontrado.' });
      }
      res.render('admin/comunicado_form', { comunicado, erro: null });
    } catch (erro) {
      console.error('Erro ao carregar comunicado:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar o comunicado.' });
    }
  },

  async adminAtualizar(req, res) {
    try {
      const { titulo, descricao } = req.body;
      if (!titulo || !descricao) {
        return res.render('admin/comunicado_form', { comunicado: { id: req.params.id, ...req.body }, erro: 'Preencha todos os campos.' });
      }
      await comunicadoModel.atualizar(req.params.id, { titulo, descricao });
      res.redirect('/admin/comunicados');
    } catch (erro) {
      console.error('Erro ao atualizar comunicado:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível atualizar o comunicado.' });
    }
  },

  async adminExcluir(req, res) {
    try {
      await comunicadoModel.excluir(req.params.id);
      res.redirect('/admin/comunicados');
    } catch (erro) {
      console.error('Erro ao excluir comunicado:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível excluir o comunicado.' });
    }
  }
};