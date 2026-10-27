// =========================================================================
// models/comunicadoModel.js
// Camada de acesso a dados da tabela "comunicados".
// =========================================================================

const pool = require('../config/database');

const ComunicadoModel = {

    async listar() {
        const resultado = await pool.query(
            `SELECT c.*, u.nome AS nome_criador
             FROM comunicados c
             JOIN usuarios u ON u.id = c.criado_por
             ORDER BY c.data_publicacao DESC`
        );
        return resultado.rows;
    },

    async buscarPorId(id) {
        const resultado = await pool.query(
            `SELECT c.*, u.nome AS nome_criador
             FROM comunicados c
             JOIN usuarios u ON u.id = c.criado_por
             WHERE c.id = $1`,
            [id]
        );
        return resultado.rows[0];
    },

    async criar({ titulo, descricao, criado_por }) {
        const resultado = await pool.query(
            `INSERT INTO comunicados (titulo, descricao, criado_por)
             VALUES ($1, $2, $3) RETURNING *`,
            [titulo, descricao, criado_por]
        );
        return resultado.rows[0];
    },

    async atualizar(id, { titulo, descricao }) {
        const resultado = await pool.query(
            `UPDATE comunicados SET titulo = $1, descricao = $2 WHERE id = $3 RETURNING *`,
            [titulo, descricao, id]
        );
        return resultado.rows[0];
    },

    async excluir(id) {
        await pool.query('DELETE FROM comunicados WHERE id = $1', [id]);
    }
};

module.exports = ComunicadoModel;
