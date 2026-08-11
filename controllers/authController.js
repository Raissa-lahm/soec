// =========================================================================
// controllers/authController.js
// Controla login e logout do sistema.
// O login e feito por MATRICULA + SENHA (nao por email), conforme pedido.
// =========================================================================

const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');

const AuthController = {

    // GET /login -> exibe o formulario de login
    exibirLogin(req, res) {
        // Se ja estiver logado, manda direto para a home
        if (req.session.usuario) {
            return res.redirect('/');
        }
        res.render('login', { erro: null, matricula: '' });
    },

    // POST /login -> processa a tentativa de login
    async processarLogin(req, res, next) {
        try {
            const { matricula, senha } = req.body;

            if (!matricula || !senha) {
                return res.status(400).render('login', {
                    erro: 'Preencha matricula e senha.',
                    matricula: matricula || ''
                });
            }

            const usuario = await UsuarioModel.buscarPorMatricula(matricula.trim());

            if (!usuario) {
                // Mensagem generica de proposito (nao revela se a matricula existe ou nao)
                return res.status(401).render('login', {
                    erro: 'Matricula ou senha invalidos.',
                    matricula
                });
            }

            const senhaValida = await bcrypt.compare(senha, usuario.senha);

            if (!senhaValida) {
                return res.status(401).render('login', {
                    erro: 'Matricula ou senha invalidos.',
                    matricula
                });
            }

            // Guarda na sessao apenas os dados necessarios (nunca a senha!)
            req.session.usuario = {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                matricula: usuario.matricula,
                perfil: usuario.perfil,
                curso: usuario.curso,
                turma: usuario.turma
            };

            // Se o usuario tentou acessar uma pagina protegida antes do login,
            // volta para ela. Senao, vai para a home.
            const destino = req.session.redirectTo || '/';
            delete req.session.redirectTo;

            return res.redirect(destino);
        } catch (erro) {
            next(erro);
        }
    },

    // POST /logout -> encerra a sessao
    logout(req, res, next) {
        req.session.destroy((erro) => {
            if (erro) return next(erro);
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });
    }
};

module.exports = AuthController;
