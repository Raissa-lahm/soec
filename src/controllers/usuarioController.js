// =========================================================================
// controllers/usuarioController.js
// CRUD completo de usuarios - area administrativa (COORDENACAO/DIRECAO).
// =========================================================================

const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');
const {
    VALIDADE_DIAS,
    gerarCodigo,
    formatarCodigo,
    hashCodigo
} = require('../utils/ativacao');

const SALT_ROUNDS = 10;
const PERFIS_VALIDOS = ['ALUNO', 'PROFESSOR', 'COORDENACAO', 'DIRECAO'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -------------------------------------------------------------------
// Funcoes auxiliares da importacao (leitura da planilha)
// -------------------------------------------------------------------

// Tira acentos e espacos: "Coordenação " -> "Coordenacao"
function semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Converte o texto da planilha em linhas de campos.
// Aceita separador ; , ou TAB (copiar e colar do Excel gera TAB) e descobre
// qual e o separador contando qual aparece mais na primeira linha.
function lerPlanilha(texto) {
    const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
    if (linhas.length === 0) return [];

    const separador = [';', '\t', ','].reduce((melhor, sep) =>
        linhas[0].split(sep).length > linhas[0].split(melhor).length ? sep : melhor
    );

    return linhas.map((linha) =>
        linha.split(separador).map((campo) => campo.trim().replace(/^"|"$/g, '').trim())
    );
}

// Monta o CSV com os codigos, para a coordenacao baixar/imprimir
function montarCsvCodigos(criados) {
    const linhas = ['Nome;Matricula;Codigo de ativacao'];
    criados.forEach((c) => linhas.push(`${c.nome};${c.matricula};${c.codigo}`));
    return linhas.join('\r\n');
}

const UsuarioController = {

    // GET /admin -> painel administrativo (dashboard simples)
    async dashboard(req, res, next) {
        try {
            const usuarios = await UsuarioModel.listarTodos();
            const totais = {
                alunos: usuarios.filter(u => u.perfil === 'ALUNO').length,
                professores: usuarios.filter(u => u.perfil === 'PROFESSOR').length,
                coordenacao: usuarios.filter(u => u.perfil === 'COORDENACAO').length,
                direcao: usuarios.filter(u => u.perfil === 'DIRECAO').length
            };
            res.render('admin/dashboard', { totais });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /admin/usuarios -> lista usuarios, com filtro opcional por perfil
    async listar(req, res, next) {
        try {
            const { perfil } = req.query;
            const usuarios = await UsuarioModel.listarTodos(perfil);
            res.render('admin/usuarios', { usuarios, filtroPerfil: perfil || '' });
        } catch (erro) {
            next(erro);
        }
    },

    exibirFormCriar(req, res) {
        res.render('admin/usuarioForm', { usuario: null, acao: '/admin/usuarios' });
    },

    async exibirFormEditar(req, res, next) {
        try {
            const usuario = await UsuarioModel.buscarPorId(req.params.id);
            if (!usuario) return res.redirect('/admin/usuarios');
            res.render('admin/usuarioForm', { usuario, acao: `/admin/usuarios/${usuario.id}?_method=PUT` });
        } catch (erro) {
            next(erro);
        }
    },

    // POST /admin/usuarios -> cria um novo usuario (senha inicial obrigatoria)
    async criar(req, res, next) {
        try {
            const { nome, email, matricula, senha, perfil, curso, turma } = req.body;

            if (!nome || !email || !matricula || !senha || !perfil) {
                return res.status(400).render('admin/usuarioForm', {
                    usuario: req.body,
                    acao: '/admin/usuarios',
                    erro: 'Preencha todos os campos obrigatorios (nome, email, matricula, senha, perfil).'
                });
            }

            const emailExistente = await UsuarioModel.buscarPorEmail(email);
            const matriculaExistente = await UsuarioModel.buscarPorMatricula(matricula);
            if (emailExistente || matriculaExistente) {
                return res.status(400).render('admin/usuarioForm', {
                    usuario: req.body,
                    acao: '/admin/usuarios',
                    erro: 'Ja existe um usuario com este email ou matricula.'
                });
            }

            const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
            await UsuarioModel.criar({ nome, email, matricula, senhaHash, perfil, curso, turma });

            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    },

    // PUT /admin/usuarios/:id -> atualiza dados cadastrais (sem mexer na senha)
    async atualizar(req, res, next) {
        try {
            const { nome, email, matricula, perfil, curso, turma } = req.body;
            await UsuarioModel.atualizar(req.params.id, { nome, email, matricula, perfil, curso, turma });

            // Se uma nova senha foi informada no formulario, atualiza tambem
            if (req.body.senha && req.body.senha.trim().length > 0) {
                const senhaHash = await bcrypt.hash(req.body.senha, SALT_ROUNDS);
                await UsuarioModel.atualizarSenha(req.params.id, senhaHash);
            }

            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    },

    // GET /admin/usuarios/importar -> tela de importacao em massa
    exibirImportacao(req, res) {
        res.render('admin/importarUsuarios', { erro: null });
    },

    // POST /admin/usuarios/importar -> cadastra varias pessoas de uma vez.
    // Cada pessoa vira uma conta PENDENTE (sem senha) com um codigo de
    // ativacao. O codigo aparece UMA unica vez na tela de resultado: no
    // banco fica so o hash dele.
    async importar(req, res, next) {
        try {
            // Aceita arquivo CSV enviado OU texto colado na caixa
            let texto = req.body.dados || '';
            if (req.file) {
                texto = req.file.buffer.toString('utf8');
                // CSV salvo pelo Excel costuma vir em Windows-1252: se os acentos
                // quebraram (caractere \uFFFD), le de novo como latin1
                if (texto.includes('\uFFFD')) texto = req.file.buffer.toString('latin1');
            }

            let linhas = lerPlanilha(texto);
            if (linhas.length === 0) {
                return res.status(400).render('admin/importarUsuarios', {
                    erro: 'Envie um arquivo CSV ou cole os dados da planilha.'
                });
            }

            // Se a primeira linha for cabecalho (comeca com "nome"), descarta
            if (semAcento(linhas[0][0]).toLowerCase() === 'nome') linhas = linhas.slice(1);

            const criados = [];
            const ignorados = [];
            const matriculasVistas = new Set();
            const emailsVistos = new Set();

            // Colunas esperadas: nome ; matricula ; email ; perfil ; curso ; turma
            for (const [indice, campos] of linhas.entries()) {
                const [nome, matricula, email, perfilBruto, curso, turma] = campos;
                const rotulo = nome || matricula || `linha ${indice + 1}`;
                const perfil = semAcento(perfilBruto).toUpperCase() || 'ALUNO';

                let motivo = null;
                if (!nome || !matricula || !email) {
                    motivo = 'Faltam dados obrigatórios (nome, matrícula e email).';
                } else if (!EMAIL_REGEX.test(email)) {
                    motivo = 'Email inválido.';
                } else if (!PERFIS_VALIDOS.includes(perfil)) {
                    motivo = `Perfil inválido (use ${PERFIS_VALIDOS.join(', ')}).`;
                } else if (matriculasVistas.has(matricula) || emailsVistos.has(email.toLowerCase())) {
                    motivo = 'Matrícula ou email repetido dentro da própria planilha.';
                } else if (await UsuarioModel.buscarPorMatricula(matricula)
                        || await UsuarioModel.buscarPorEmail(email)) {
                    // Nunca sobrescreve quem ja esta cadastrado
                    motivo = 'Já existe usuário com esta matrícula ou email.';
                }

                if (motivo) {
                    ignorados.push({ nome: rotulo, matricula: matricula || '-', motivo });
                    continue;
                }

                matriculasVistas.add(matricula);
                emailsVistos.add(email.toLowerCase());

                const codigo = gerarCodigo();
                await UsuarioModel.criarPendente({
                    nome, email, matricula, perfil, curso, turma,
                    codigoHash: hashCodigo(codigo, matricula),
                    validadeDias: VALIDADE_DIAS
                });
                criados.push({ nome, matricula, codigo: formatarCodigo(codigo) });
            }

            res.render('admin/codigosGerados', {
                titulo: 'Resultado da importação',
                criados,
                ignorados,
                csv: montarCsvCodigos(criados)
            });
        } catch (erro) {
            next(erro);
        }
    },

    // POST /admin/usuarios/:id/codigo -> gera um NOVO codigo de ativacao.
    // Serve para codigo perdido/expirado/bloqueado e tambem para "esqueci a
    // senha": a senha atual e apagada e a pessoa refaz o primeiro acesso.
    async gerarNovoCodigo(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);

            // Mesma protecao do excluir: a gestao nao pode se trancar para fora
            if (id === req.session.usuario.id) {
                const usuarios = await UsuarioModel.listarTodos();
                return res.status(400).render('admin/usuarios', {
                    usuarios,
                    filtroPerfil: '',
                    erro: 'Você não pode gerar novo código para o próprio usuário enquanto estiver logado com ele.'
                });
            }

            const usuario = await UsuarioModel.buscarPorId(id);
            if (!usuario) return res.redirect('/admin/usuarios');

            const codigo = gerarCodigo();
            await UsuarioModel.redefinirParaPrimeiroAcesso(
                id, hashCodigo(codigo, usuario.matricula), VALIDADE_DIAS
            );
            // Se a pessoa estava logada em algum aparelho, derruba a sessao
            await UsuarioModel.encerrarSessoes(id);

            const criados = [{ nome: usuario.nome, matricula: usuario.matricula, codigo: formatarCodigo(codigo) }];
            res.render('admin/codigosGerados', {
                titulo: 'Novo código de ativação',
                criados,
                ignorados: [],
                csv: montarCsvCodigos(criados)
            });
        } catch (erro) {
            next(erro);
        }
    },

    // DELETE /admin/usuarios/:id -> remove um usuario
    async excluir(req, res, next) {
        try {
            // Impede que o usuario logado exclua a si mesmo, evitando ficar "trancado" fora
            if (parseInt(req.params.id, 10) === req.session.usuario.id) {
                const usuarios = await UsuarioModel.listarTodos();
                return res.status(400).render('admin/usuarios', {
                    usuarios,
                    filtroPerfil: '',
                    erro: 'Voce nao pode excluir o proprio usuario enquanto estiver logado com ele.'
                });
            }
            await UsuarioModel.excluir(req.params.id);
            res.redirect('/admin/usuarios');
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = UsuarioController;