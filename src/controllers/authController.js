const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');
const AuditoriaModel = require('../models/auditoriaModel');
const { conferirCodigo } = require('../utils/ativacao');

const SALT_ROUNDS = 10;
const SENHA_MINIMA_ALUNO = 7;
const SENHA_MINIMA_GESTAO = 10;
const SENHA_MAXIMA = 72;
const ERRO_CREDENCIAIS = 'Matrícula ou senha inválidos.';
const ERRO_ATIVACAO = 'Dados inválidos ou código expirado';

function regraSenhaGestao(senha, usuario) {
    const partesEmail = String(usuario.email || '').toLowerCase().split('@');
    return senha.length >= SENHA_MINIMA_GESTAO && senha.length <= SENHA_MAXIMA &&
        senha !== usuario.matricula && senha.toLowerCase() !== String(usuario.email).toLowerCase() &&
        senha.toLowerCase() !== partesEmail[0];
}

function salvarSessao(req, usuario) {
    return new Promise((resolve, reject) => req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.usuario = {
            id: usuario.id, nome: usuario.nome, email: usuario.email, matricula: usuario.matricula,
            perfil: usuario.perfil, curso: usuario.curso, turma: usuario.turma,
            deveTrocarSenha: Boolean(usuario.deve_trocar_senha)
        };
        resolve();
    }));
}

const AuthController = {
    exibirLogin(req, res) {
        if (req.session.usuario) return res.redirect(req.session.usuario.deveTrocarSenha ? '/trocar-senha' : '/');
        const sucesso = req.session.mensagemLogin || null;
        delete req.session.mensagemLogin;
        res.render('login', { erro: null, matricula: '', sucesso });
    },
    async processarLogin(req, res, next) {
        try {
            const matricula = String(req.body.matricula || '').trim();
            const senha = String(req.body.senha || '');
            const usuario = matricula ? await UsuarioModel.buscarPorMatricula(matricula) : null;
            if (usuario?.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
                return res.status(401).render('login', { erro: ERRO_CREDENCIAIS, matricula });
            }
            const senhaValida = usuario?.senha ? await bcrypt.compare(senha, usuario.senha) : false;
            if (!senhaValida) {
                if (usuario) await UsuarioModel.registrarFalhaLogin(usuario.id);
                if (usuario) await AuditoriaModel.registrar({ alvoId: usuario.id, acao: 'LOGIN_FALHA', detalhe: 'Credencial inválida', ip: req.ip });
                return res.status(401).render('login', { erro: ERRO_CREDENCIAIS, matricula });
            }
            await UsuarioModel.limparFalhasLogin(usuario.id);
            await AuditoriaModel.registrar({ usuarioId: usuario.id, alvoId: usuario.id, acao: 'LOGIN_SUCESSO', ip: req.ip });
            const destinoAnterior = req.session.redirectTo || '/';
            await salvarSessao(req, usuario);
            const destino = usuario.deve_trocar_senha ? '/trocar-senha' : destinoAnterior;
            delete req.session.redirectTo;
            return res.redirect(destino);
        } catch (erro) { next(erro); }
    },
    exibirTrocarSenha(req, res) {
        res.render('trocarSenha', { erro: null });
    },
    async processarTrocarSenha(req, res, next) {
        try {
            const usuario = await UsuarioModel.buscarPorId(req.session.usuario.id);
            const senha = String(req.body.senha || '');
            const confirmar = String(req.body.confirmarSenha || '');
            const minimo = usuario.perfil === 'ALUNO' ? SENHA_MINIMA_ALUNO : SENHA_MINIMA_GESTAO;
            let valido = senha.length >= minimo && senha.length <= SENHA_MAXIMA && senha === confirmar && senha !== usuario.matricula;
            if (usuario.perfil !== 'ALUNO') valido = valido && regraSenhaGestao(senha, usuario);
            if (!valido) return res.status(400).render('trocarSenha', {
                erro: `A senha deve ter ao menos ${minimo} caracteres, ser diferente da matrícula e coincidir com a confirmação${usuario.perfil === 'ALUNO' ? '' : ', do e-mail e da parte local do e-mail'}.`
            });
            await UsuarioModel.trocarSenhaObrigatoria(usuario.id, await bcrypt.hash(senha, SALT_ROUNDS));
            await AuditoriaModel.registrar({ usuarioId: usuario.id, alvoId: usuario.id, acao: 'TROCAR_SENHA', ip: req.ip });
            req.session.usuario.deveTrocarSenha = false;
            return res.redirect('/');
        } catch (erro) { next(erro); }
    },
    exibirPrimeiroAcesso(req, res) {
        res.render('primeiroAcesso', { erro: null, matricula: '', email: '' });
    },
    async processarPrimeiroAcesso(req, res, next) {
        const matricula = String(req.body.matricula || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const codigo = String(req.body.codigo || '');
        const senha = String(req.body.senha || '');
        const confirmar = String(req.body.confirmarSenha || '');
        const recusar = () => res.status(400).render('primeiroAcesso', { erro: ERRO_ATIVACAO, matricula: '', email: '' });
        try {
            const usuario = await UsuarioModel.buscarParaAtivacao(matricula, email);
            const criterios = usuario && ['PROFESSOR','COORDENACAO','DIRECAO'].includes(usuario.perfil) && !usuario.senha &&
                usuario.codigo_ativacao_hash && usuario.codigo_expira_em && new Date(usuario.codigo_expira_em) > new Date() &&
                usuario.tentativas_ativacao < 5;
            if (!criterios) return recusar();
            const minimo = SENHA_MINIMA_GESTAO;
            const senhaOk = senha === confirmar && regraSenhaGestao(senha, usuario);
            const codigoOk = conferirCodigo(codigo, matricula, usuario.codigo_ativacao_hash);
            if (!codigoOk) {
                await UsuarioModel.registrarFalhaAtivacao(usuario.id);
                return recusar();
            }
            if (!senhaOk) return recusar();
            const ativada = await UsuarioModel.ativarConta(usuario.id, await bcrypt.hash(senha, SALT_ROUNDS));
            if (!ativada) return recusar();
            await UsuarioModel.encerrarSessoes(usuario.id);
            await AuditoriaModel.registrar({ alvoId: usuario.id, acao: 'ATIVAR_CONTA', ip: req.ip });
            req.session.mensagemLogin = 'Conta ativada com sucesso. Entre com sua matrícula e senha.';
            return res.redirect('/login');
        } catch (erro) { next(erro); }
    },
    logout(req, res, next) {
        req.session.destroy((erro) => {
            if (erro) return next(erro);
            res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
            return res.redirect('/login');
        });
    }
};

module.exports = AuthController;
