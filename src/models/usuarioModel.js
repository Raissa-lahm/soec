// =========================================================================
// models/usuarioModel.js
// Camada de acesso a dados da tabela "usuarios".
// Todas as consultas usam parametros ($1, $2...) para evitar SQL Injection.
// =========================================================================

const pool = require('../config/database');

const UsuarioModel = {

    // Busca um usuario pela matricula (usado no login)
    async buscarPorMatricula(matricula) {
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE matricula = $1',
            [matricula]
        );
        return resultado.rows[0];
    },

    // Busca um usuario pelo email (usado para validar duplicidade no cadastro)
    async buscarPorEmail(email) {
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [email]
        );
        return resultado.rows[0];
    },

    // Busca um usuario pelo ID
    async buscarPorId(id) {
        const resultado = await pool.query(
            'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em, (senha IS NULL) AS pendente FROM usuarios WHERE id = $1',
            [id]
        );
        return resultado.rows[0];
    },

    // Lista todos os usuarios (usado na area administrativa), com filtro opcional de perfil
    async listarTodos(perfil) {
        if (perfil) {
            const resultado = await pool.query(
                'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em, (senha IS NULL) AS pendente FROM usuarios WHERE perfil = $1 ORDER BY nome ASC',
                [perfil]
            );
            return resultado.rows;
        }
        const resultado = await pool.query(
            'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em, (senha IS NULL) AS pendente FROM usuarios ORDER BY nome ASC'
        );
        return resultado.rows;
    },

    // Cria um novo usuario (senha ja deve chegar com hash bcrypt aplicado)
    async criar({ nome, email, matricula, senhaHash, perfil, curso, turma }) {
        const resultado = await pool.query(
            `INSERT INTO usuarios (nome, email, matricula, senha, perfil, curso, turma)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, nome, email, matricula, perfil, curso, turma`,
            [nome, email, matricula, senhaHash, perfil, curso || null, turma || null]
        );
        return resultado.rows[0];
    },

    // Atualiza os dados de um usuario (sem alterar a senha)
    async atualizar(id, { nome, email, matricula, perfil, curso, turma }) {
        const resultado = await pool.query(
            `UPDATE usuarios
             SET nome = $1, email = $2, matricula = $3, perfil = $4, curso = $5, turma = $6
             WHERE id = $7
             RETURNING id, nome, email, matricula, perfil, curso, turma`,
            [nome, email, matricula, perfil, curso || null, turma || null, id]
        );
        return resultado.rows[0];
    },

    // Atualiza somente a senha (novo hash) de um usuario
    // Tambem limpa o codigo de ativacao: se o admin definiu a senha, o codigo nao serve mais
    async atualizarSenha(id, senhaHash) {
        await pool.query(
            `UPDATE usuarios
             SET senha = $1, codigo_ativacao_hash = NULL, codigo_expira_em = NULL, tentativas_ativacao = 0
             WHERE id = $2`,
            [senhaHash, id]
        );
    },

    // ---------------------------------------------------------------
    // PRIMEIRO ACESSO
    // Conta "pendente" = senha NULL. Ela existe no banco (foi autorizada
    // pela escola), mas ninguem definiu a senha ainda.
    // ---------------------------------------------------------------

    // Cria uma conta pendente (sem senha) ja com o hash do codigo de ativacao.
    // A validade e calculada no proprio banco (NOW() + dias) para nao depender
    // do fuso horario do servidor Node.
    async criarPendente({ nome, email, matricula, perfil, curso, turma, codigoHash, validadeDias }) {
        const resultado = await pool.query(
            `INSERT INTO usuarios
                (nome, email, matricula, senha, perfil, curso, turma,
                 codigo_ativacao_hash, codigo_expira_em, tentativas_ativacao)
             VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, NOW() + make_interval(days => $8), 0)
             RETURNING id, nome, email, matricula, perfil`,
            [nome, email, matricula, perfil, curso || null, turma || null, codigoHash, validadeDias]
        );
        return resultado.rows[0];
    },

    // Dados que a tela de primeiro acesso precisa para validar
    async buscarParaAtivacao(matricula) {
        const resultado = await pool.query(
            `SELECT id,
                    (senha IS NULL) AS pendente,
                    codigo_ativacao_hash,
                    tentativas_ativacao,
                    (codigo_expira_em IS NOT NULL AND codigo_expira_em > NOW()) AS codigo_valido
             FROM usuarios WHERE matricula = $1`,
            [matricula]
        );
        return resultado.rows[0];
    },

    // Conta mais um erro de codigo (ao chegar no limite o codigo e bloqueado)
    async registrarTentativaFalha(id) {
        await pool.query(
            'UPDATE usuarios SET tentativas_ativacao = tentativas_ativacao + 1 WHERE id = $1',
            [id]
        );
    },

    // Define a senha pela primeira vez e invalida o codigo.
    // O "AND senha IS NULL" garante que so funciona uma vez: se a conta ja foi
    // ativada (ou duas requisicoes chegarem juntas), a segunda nao altera nada.
    async ativarConta(id, senhaHash) {
        const resultado = await pool.query(
            `UPDATE usuarios
             SET senha = $1, codigo_ativacao_hash = NULL, codigo_expira_em = NULL, tentativas_ativacao = 0
             WHERE id = $2 AND senha IS NULL
             RETURNING id`,
            [senhaHash, id]
        );
        return resultado.rows[0];
    },

    // Gera um novo codigo para a pessoa e apaga a senha atual (usado quando
    // o codigo foi perdido ou a pessoa esqueceu a senha: ela refaz o primeiro acesso)
    async redefinirParaPrimeiroAcesso(id, codigoHash, validadeDias) {
        await pool.query(
            `UPDATE usuarios
             SET senha = NULL,
                 codigo_ativacao_hash = $1,
                 codigo_expira_em = NOW() + make_interval(days => $2),
                 tentativas_ativacao = 0
             WHERE id = $3`,
            [codigoHash, validadeDias, id]
        );
    },

    // Derruba as sessoes abertas de um usuario (a tabela "session" guarda o
    // usuario dentro do JSON). Usado quando a senha dele e apagada pela gestao.
    async encerrarSessoes(id) {
        await pool.query(
            "DELETE FROM session WHERE (sess::jsonb -> 'usuario' ->> 'id') = $1",
            [String(id)]
        );
    },

    // Remove um usuario
    async excluir(id) {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    }
};

module.exports = UsuarioModel;