// =====================================================================
// SOEC - Controller de Autenticação
// Salvar em: /controllers/authController.js
// =====================================================================

const bcrypt = require('bcrypt');
const usuarioModel = require('../models/usuarioModel');

module.exports = {
  // Exibe a tela de login
  exibirLogin(req, res) {
    // Se já estiver logado, manda direto para a home
    if (req.session.usuario) {
      return res.redirect('/');
    }
    res.render('login', { erro: null });
  },

  // Processa o formulário de login (matrícula + senha)
  async processarLogin(req, res) {
    try {
      const { matricula, senha } = req.body;

      if (!matricula || !senha) {
        return res.render('login', { erro: 'Preencha matrícula e senha.' });
      }

      const usuario = await usuarioModel.buscarPorMatricula(matricula.trim());

      if (!usuario) {
        return res.render('login', { erro: 'Matrícula ou senha inválidos.' });
      }

      // Compara a senha digitada com o hash salvo no banco
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        return res.render('login', { erro: 'Matrícula ou senha inválidos.' });
      }

      // Guarda na sessão apenas os dados necessários (nunca a senha/hash)
      req.session.usuario = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        matricula: usuario.matricula,
        perfil: usuario.perfil,
        curso: usuario.curso,
        turma: usuario.turma
      };

      return res.redirect('/');
    } catch (erro) {
      console.error('Erro no login:', erro);
      return res.render('login', { erro: 'Erro interno ao tentar fazer login. Tente novamente.' });
    }
  },

  // Encerra a sessão do usuário
  logout(req, res) {
    req.session.destroy((erro) => {
      if (erro) {
        console.error('Erro ao encerrar sessão:', erro);
      }
      res.redirect('/login');
    });
  }
};