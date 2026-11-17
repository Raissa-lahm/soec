// =========================================================================
// models/comunicadoModel.js
// Camada de acesso a dados da tabela "comunicados".
// =========================================================================

const pool = require('../config/database');

const ComunicadoModel = {

    async listar() {
        const resultado = await pool.query(
            `SELECT c.*, c.data_evento::text, c.prazo_final::text, u.nome AS nome_criador
             FROM comunicados c
             JOIN usuarios u ON u.id = c.criado_por
             ORDER BY c.data_publicacao DESC`
        );
        return resultado.rows;
    },

    async buscarPorId(id) {
        const resultado = await pool.query(
            `SELECT c.*, c.data_evento::text, c.prazo_final::text, u.nome AS nome_criador
             FROM comunicados c
             JOIN usuarios u ON u.id = c.criado_por
             WHERE c.id = $1`,
            [id]
        );
        return resultado.rows[0];
    },

    async listarParaCalendario({ inicio, fim }) {
        const resultado = await pool.query(
            `SELECT id, titulo, data_evento::text, prazo_final::text
             FROM comunicados
             WHERE data_evento BETWEEN $1::date AND $2::date
                OR prazo_final BETWEEN $1::date AND $2::date
             ORDER BY COALESCE(data_evento, prazo_final), titulo`,
            [inicio, fim]
        );
        return resultado.rows;
    },

    async criar({ titulo, descricao, data_evento, prazo_final, criado_por }) {
        const resultado = await pool.query(
            `INSERT INTO comunicados (titulo, descricao, data_evento, prazo_final, criado_por)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [titulo, descricao, data_evento || null, prazo_final || null, criado_por]
        );
        return resultado.rows[0];
    },

    async atualizar(id, { titulo, descricao, data_evento, prazo_final }) {
        const resultado = await pool.query(
            `UPDATE comunicados SET titulo = $1, descricao = $2, data_evento = $3, prazo_final = $4 WHERE id = $5 RETURNING *`,
            [titulo, descricao, data_evento || null, prazo_final || null, id]
        );
        return resultado.rows[0];
    },

    async excluir(id) {
        await pool.query('DELETE FROM comunicados WHERE id = $1', [id]);
    }
};

module.exports = ComunicadoModel;
