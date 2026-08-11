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
            'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em FROM usuarios WHERE id = $1',
            [id]
        );
        return resultado.rows[0];
    },

    // Lista todos os usuarios (usado na area administrativa), com filtro opcional de perfil
    async listarTodos(perfil) {
        if (perfil) {
            const resultado = await pool.query(
                'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em FROM usuarios WHERE perfil = $1 ORDER BY nome ASC',
                [perfil]
            );
            return resultado.rows;
        }
        const resultado = await pool.query(
            'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em FROM usuarios ORDER BY nome ASC'
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
    async atualizarSenha(id, senhaHash) {
        await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [senhaHash, id]);
    },

    // Remove um usuario
    async excluir(id) {
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    }
};

module.exports = UsuarioModel;
