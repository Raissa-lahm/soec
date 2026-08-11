// =====================================================================
// SOEC - Controller de Horários das Turmas
// Salvar em: /controllers/horarioController.js
// =====================================================================

const horarioModel = require('../models/horarioModel');

module.exports = {
  // Tela de horários: mostra os PDFs pra todo mundo, e mostra o
  // formulário de enviar/atualizar direto nos cards para COORDENACAO/DIRECAO
  async listar(req, res) {
    try {
      const horarios = await horarioModel.listarTodos();
      res.render('horarios', {
        horarios,
        erro: req.query.erro || null,
        sucesso: req.query.sucesso || null
      });
    } catch (erro) {
      console.error('Erro ao listar horários:', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os horários.' });
    }
  },

  // ---------------- Área administrativa (Coordenação/Direção) ----------------

  async adminListar(req, res) {
    try {
      const horarios = await horarioModel.listarTodos();
      res.render('admin/horarios', {
        horarios,
        erro: req.query.erro || null,
        sucesso: req.query.sucesso || null
      });
    } catch (erro) {
      console.error('Erro ao listar horários (admin):', erro);
      res.status(500).render('erro', { titulo: 'Erro', mensagem: 'Não foi possível carregar os horários.' });
    }
  },

  // Recebe o PDF enviado pela coordenação/direção (upload inicial ou
  // atualização). Pode ser chamado tanto da tela /horarios quanto da
  // /admin/horarios — o campo escondido "voltarPara" diz pra onde voltar.
  async adminEnviar(req, res) {
    const destino = req.body.voltarPara === '/admin/horarios' ? '/admin/horarios' : '/horarios';

    try {
      const { curso } = req.body;

      if (!req.file) {
        return res.redirect(`${destino}?erro=${encodeURIComponent('Selecione um arquivo PDF antes de enviar.')}`);
      }

      const arquivo_url = `/uploads/horarios/${req.file.filename}`;

      await horarioModel.salvarArquivo(curso, {
        arquivo_url,
        arquivo_nome_original: req.file.originalname,
        atualizado_por: req.session.usuario.id
      });

      res.redirect(`${destino}?sucesso=${encodeURIComponent(`Horário do curso "${curso}" atualizado com sucesso.`)}`);
    } catch (erro) {
      console.error('Erro ao enviar horário:', erro);
      res.redirect(`${destino}?erro=${encodeURIComponent(erro.message || 'Não foi possível enviar o PDF.')}`);
    }
  }
};