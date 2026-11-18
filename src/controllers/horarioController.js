// =====================================================================
// SOEC - Controller de Horários das Turmas
// Salvar em: /src/controllers/horarioController.js
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
      res.status(500).render('error', { titulo: 'Erro', mensagem: 'Não foi possível carregar os horários.' });
    }
  },

  async baixarArquivo(req, res) {
    try {
      const arquivo = await horarioModel.buscarArquivoPorId(Number(req.params.id));
      if (!arquivo) {
        return res.status(404).send('Horário não encontrado.');
      }

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      });
      return res.send(arquivo.arquivo_conteudo);
    } catch (erro) {
      console.error('Erro ao abrir horário:', erro);
      return res.status(500).send('Não foi possível abrir o horário.');
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

      const atualizado = await horarioModel.salvarArquivo(curso, {
        arquivo_conteudo: req.file.buffer,
        arquivo_nome_original: req.file.originalname,
        atualizado_por: req.session.usuario.id
      });

      if (!atualizado) {
        return res.redirect(`${destino}?erro=${encodeURIComponent('O curso informado não foi encontrado.')}`);
      }

      res.redirect(`${destino}?sucesso=${encodeURIComponent(`Horário do curso "${curso}" atualizado com sucesso.`)}`);
    } catch (erro) {
      console.error('Erro ao enviar horário:', erro);
      res.redirect(`${destino}?erro=${encodeURIComponent(erro.message || 'Não foi possível enviar o PDF.')}`);
    }
  }
};
