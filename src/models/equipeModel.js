// =========================================================================
// models/equipeModel.js
// Camada de acesso a dados das tabelas "equipes" e "equipe_membros".
// =========================================================================

const pool = require('../config/database');

const EquipeModel = {

    // Lista todas as equipes de um evento, ja com a contagem de membros
    async listarPorEvento(eventoId) {
        const resultado = await pool.query(
            `SELECT eq.*,
                    (SELECT COUNT(*) FROM equipe_membros em WHERE em.equipe_id = eq.id) AS total_membros
             FROM equipes eq
             WHERE eq.evento_id = $1
             ORDER BY eq.nome ASC`,
            [eventoId]
        );
        return resultado.rows;
    },

    async buscarPorId(id) {
        const resultado = await pool.query(
            `SELECT eq.*, e.titulo AS titulo_evento
             FROM equipes eq
             JOIN eventos e ON e.id = eq.evento_id
             WHERE eq.id = $1`,
            [id]
        );
        return resultado.rows[0];
    },

    async criar({ nome, modalidade, evento_id }) {
        const resultado = await pool.query(
            `INSERT INTO equipes (nome, modalidade, evento_id) VALUES ($1, $2, $3) RETURNING *`,
            [nome, modalidade || null, evento_id]
        );
        return resultado.rows[0];
    },

    async atualizar(id, { nome, modalidade }) {
        const resultado = await pool.query(
            `UPDATE equipes SET nome = $1, modalidade = $2 WHERE id = $3 RETURNING *`,
            [nome, modalidade || null, id]
        );
        return resultado.rows[0];
    },

    async excluir(id) {
        await pool.query('DELETE FROM equipes WHERE id = $1', [id]);
    },

    // --------------------- Membros da equipe ---------------------

    async listarMembros(equipeId) {
        const resultado = await pool.query(
            `SELECT em.id AS membro_id, u.id AS usuario_id, u.nome, u.matricula, u.turma
             FROM equipe_membros em
             JOIN usuarios u ON u.id = em.usuario_id
             WHERE em.equipe_id = $1
             ORDER BY u.nome ASC`,
            [equipeId]
        );
        return resultado.rows;
    },

    async jaEhMembro(equipeId, usuarioId) {
        const resultado = await pool.query(
            'SELECT 1 FROM equipe_membros WHERE equipe_id = $1 AND usuario_id = $2',
            [equipeId, usuarioId]
        );
        return resultado.rowCount > 0;
    },

    async adicionarMembro(equipeId, usuarioId) {
        const resultado = await pool.query(
            `INSERT INTO equipe_membros (equipe_id, usuario_id) VALUES ($1, $2) RETURNING *`,
            [equipeId, usuarioId]
        );
        return resultado.rows[0];
    },

    async removerMembro(equipeId, usuarioId) {
        await pool.query(
            'DELETE FROM equipe_membros WHERE equipe_id = $1 AND usuario_id = $2',
            [equipeId, usuarioId]
        );
    }
};

module.exports = EquipeModel;
