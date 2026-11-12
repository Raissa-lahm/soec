// =========================================================================
// controllers/authController.js
// Controla login e logout do sistema.
// O login e feito por MATRICULA + SENHA (nao por email), conforme pedido.
// =========================================================================

const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');

const SALT_ROUNDS = 10;
const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 72; // limite do bcrypt: acima disso o resto da senha seria ignorado
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MATRICULA_REGEX = /^[\w.-]{3,30}$/; // letras, numeros, ponto, hifen e underline

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

    // GET /cadastro -> formulario de cadastro publico
    exibirCadastro(req, res) {
        if (req.session.usuario) {
            return res.redirect('/');
        }
        res.render('cadastro', { erro: null, dados: {} });
    },

    // POST /cadastro -> qualquer pessoa da escola cria a propria conta e ja entra.
    // O PERFIL NUNCA vem do formulario: todo cadastro publico nasce como ALUNO.
    // Professor, coordenacao e direcao so sao definidos pela gestao (area admin).
    async processarCadastro(req, res, next) {
        try {
            const nome = String(req.body.nome || '').trim();
            const matricula = String(req.body.matricula || '').trim();
            const email = String(req.body.email || '').trim().toLowerCase();
            const curso = String(req.body.curso || '').trim();
            const turma = String(req.body.turma || '').trim();
            const senha = String(req.body.senha || '');
            const confirmarSenha = String(req.body.confirmarSenha || '');

            // Devolve os dados digitados (menos as senhas) para a pessoa nao redigitar tudo
            const dados = { nome, matricula, email, curso, turma };
            const recusar = (erro) => res.status(400).render('cadastro', { erro, dados });

            if (!nome || !matricula || !email || !senha || !confirmarSenha) {
                return recusar('Preencha nome, matrícula, email e senha.');
            }
            if (nome.length < 3 || nome.length > 150) {
                return recusar('Informe seu nome completo.');
            }
            if (!MATRICULA_REGEX.test(matricula)) {
                return recusar('Matrícula inválida. Use de 3 a 30 caracteres, sem espaços.');
            }
            if (!EMAIL_REGEX.test(email) || email.length > 150) {
                return recusar('Email inválido.');
            }
            if (curso.length > 100 || turma.length > 50) {
                return recusar('Curso ou turma muito longos.');
            }
            if (senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA) {
                return recusar(`A senha precisa ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres.`);
            }
            if (senha !== confirmarSenha) {
                return recusar('As senhas não conferem.');
            }

            // Avisos separados: a pessoa precisa saber QUAL dado ja esta em uso
            const AVISO_MATRICULA =
                'Esta matrícula já está cadastrada. Se for a sua, entre pelo login. ' +
                'Se você não criou essa conta, procure a coordenação.';
            const AVISO_EMAIL =
                'Este email já está sendo usado em outra conta. Use outro email ou entre pelo login.';

            if (await UsuarioModel.buscarPorMatricula(matricula)) {
                return recusar(AVISO_MATRICULA);
            }
            if (await UsuarioModel.buscarPorEmail(email)) {
                return recusar(AVISO_EMAIL);
            }

            const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

            let novo;
            try {
                novo = await UsuarioModel.criar({
                    nome, email, matricula, senhaHash,
                    perfil: 'ALUNO',
                    curso: curso || null,
                    turma: turma || null
                });
            } catch (erroBanco) {
                // 23505 = violacao de UNIQUE: duas pessoas cadastraram a mesma
                // matricula/email ao mesmo tempo (a checagem acima nao pegou)
                if (erroBanco.code === '23505') {
                    return recusar(String(erroBanco.constraint).includes('email') ? AVISO_EMAIL : AVISO_MATRICULA);
                }
                throw erroBanco;
            }

            // Ja deixa a pessoa logada (mesmos dados de sessao do login)
            req.session.usuario = {
                id: novo.id,
                nome: novo.nome,
                email: novo.email,
                matricula: novo.matricula,
                perfil: novo.perfil,
                curso: novo.curso,
                turma: novo.turma
            };

            return res.redirect('/');
        } catch (erro) {
            next(erro);
        }
    },

    // GET /primeiro-acesso -> formulario para ativar a conta e criar a senha
    exibirPrimeiroAcesso(req, res) {
        if (req.session.usuario) {
            return res.redirect('/');
        }
        res.render('primeiroAcesso', { erro: null, nome: '', matricula: '' });
    },

    // POST /primeiro-acesso -> valida matrícula autorizada e grava a senha
    async processarPrimeiroAcesso(req, res, next) {
        try {
            const { nome, matricula, senha, confirmarSenha } = req.body;
            const nomeLimpo = String(nome || '').trim();
            const matriculaLimpa = String(matricula || '').trim();

            const recusar = (status, erro) =>
                res.status(status).render('primeiroAcesso', { erro, nome: nomeLimpo, matricula: matriculaLimpa });

            if (!nomeLimpo || !matriculaLimpa || !senha || !confirmarSenha) {
                return recusar(400, 'Preencha todos os campos.');
            }
            if (senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA) {
                return recusar(400, `A senha precisa ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres.`);
            }
            if (senha !== confirmarSenha) {
                return recusar(400, 'As senhas não conferem.');
            }

            const mensagemGenerica =
                'Não foi possível ativar a conta. Confira se a matrícula está autorizada e ainda não foi ativada.';
            const conta = await UsuarioModel.buscarParaAtivacao(matriculaLimpa, nomeLimpo);
            if (!conta || !conta.pendente) {
                return recusar(400, mensagemGenerica);
            }

            const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
            const ativada = await UsuarioModel.ativarConta(conta.id, senhaHash);
            if (!ativada) {
                return recusar(400, mensagemGenerica);
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