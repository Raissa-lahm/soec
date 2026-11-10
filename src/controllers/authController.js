// =========================================================================
// controllers/authController.js
// Controla login e logout do sistema.
// O login e feito por MATRICULA + SENHA (nao por email), conforme pedido.
// =========================================================================

const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');
const { MAX_TENTATIVAS, conferirCodigo } = require('../utils/ativacao');

const SALT_ROUNDS = 10;
const SENHA_MINIMA = 8;

const AuthController = {

    // GET /login -> exibe o formulario de login
    exibirLogin(req, res) {
        // Se ja estiver logado, manda direto para a home
        if (req.session.usuario) {
            return res.redirect('/');
        }
        // Mensagem deixada pelo primeiro acesso ("senha criada, faca login")
        const sucesso = req.session.mensagemLogin || null;
        delete req.session.mensagemLogin;
        res.render('login', { erro: null, matricula: '', sucesso });
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

            // Conta pendente (primeiro acesso ainda nao feito) tem senha NULL:
            // nao ha o que comparar, entao cai na mesma mensagem generica de erro
            const senhaValida = usuario.senha ? await bcrypt.compare(senha, usuario.senha) : false;

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

    // GET /primeiro-acesso -> formulario para ativar a conta e criar a senha
    exibirPrimeiroAcesso(req, res) {
        if (req.session.usuario) {
            return res.redirect('/');
        }
        res.render('primeiroAcesso', { erro: null, matricula: '' });
    },

    // POST /primeiro-acesso -> valida matricula + codigo e grava a senha
    async processarPrimeiroAcesso(req, res, next) {
        try {
            const { matricula, codigo, senha, confirmarSenha } = req.body;
            const matriculaLimpa = String(matricula || '').trim();

            const recusar = (status, erro) =>
                res.status(status).render('primeiroAcesso', { erro, matricula: matriculaLimpa });

            if (!matriculaLimpa || !codigo || !senha || !confirmarSenha) {
                return recusar(400, 'Preencha todos os campos.');
            }
            if (senha.length < SENHA_MINIMA) {
                return recusar(400, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
            }
            if (senha !== confirmarSenha) {
                return recusar(400, 'As senhas não conferem.');
            }

            // Mensagem unica para todos os motivos de recusa: assim a tela nao
            // revela se a matricula existe, ja foi ativada ou se o codigo expirou
            const MENSAGEM_GENERICA =
                'Não foi possível ativar a conta. Confira a matrícula e o código. ' +
                'Se o código expirou, foi bloqueado ou a conta já foi ativada, procure a coordenação.';

            const conta = await UsuarioModel.buscarParaAtivacao(matriculaLimpa);

            // Conta inexistente, ja ativada, sem codigo valido ou bloqueada por tentativas
            if (!conta || !conta.pendente || !conta.codigo_valido
                || conta.tentativas_ativacao >= MAX_TENTATIVAS) {
                return recusar(400, MENSAGEM_GENERICA);
            }

            // Codigo errado: conta a tentativa (apos MAX_TENTATIVAS erros o codigo trava)
            if (!conferirCodigo(codigo, matriculaLimpa, conta.codigo_ativacao_hash)) {
                await UsuarioModel.registrarTentativaFalha(conta.id);
                return recusar(400, MENSAGEM_GENERICA);
            }

            // Tudo certo: grava a senha com bcrypt e invalida o codigo
            const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
            const ativada = await UsuarioModel.ativarConta(conta.id, senhaHash);
            if (!ativada) {
                return recusar(400, MENSAGEM_GENERICA);
            }

            req.session.mensagemLogin = 'Senha criada com sucesso! Entre com sua matrícula e senha.';
            return res.redirect('/login');
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