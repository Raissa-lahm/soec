// =========================================================================
// models/inscricaoModel.js
// Camada de acesso a dados da tabela "inscricoes" (usuario <-> evento).
// =========================================================================

const pool = require('../config/database');

const InscricaoModel = {

    // Lista todas as inscricoes de um evento especifico (usado na gestao)
    async listarPorEvento(eventoId) {
        const resultado = await pool.query(
            `SELECT i.*, u.nome, u.matricula, u.turma
             FROM inscricoes i
             JOIN usuarios u ON u.id = i.usuario_id
             WHERE i.evento_id = $1
             ORDER BY i.data_inscricao ASC`,
            [eventoId]
        );
        return resultado.rows;
    },

    // Lista todas as inscricoes de um usuario (usado em "meus eventos")
    async listarPorUsuario(usuarioId) {
        const resultado = await pool.query(
            `SELECT i.*, e.titulo, e.data_evento, e.local, e.tipo
             FROM inscricoes i
             JOIN eventos e ON e.id = i.evento_id
             WHERE i.usuario_id = $1
             ORDER BY e.data_evento ASC`,
            [usuarioId]
        );
        return resultado.rows;
    },

    // Verifica se um usuario ja esta inscrito em um evento
    async jaInscrito(usuarioId, eventoId) {
        const resultado = await pool.query(
            'SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND evento_id = $2',
            [usuarioId, eventoId]
        );
        return resultado.rowCount > 0;
    },

    // Conta quantas vagas ja foram preenchidas em um evento
    async contarInscritos(eventoId) {
        const resultado = await pool.query(
            'SELECT COUNT(*)::int AS total FROM inscricoes WHERE evento_id = $1',
            [eventoId]
        );
        return resultado.rows[0].total;
    },

    async criar(usuarioId, eventoId) {
        const resultado = await pool.query(
            `INSERT INTO inscricoes (usuario_id, evento_id) VALUES ($1, $2) RETURNING *`,
            [usuarioId, eventoId]
        );
        return resultado.rows[0];
    },

    // Cancela a inscricao do proprio usuario (ou remocao feita pela gestao)
    async cancelar(usuarioId, eventoId) {
        await pool.query(
            'DELETE FROM inscricoes WHERE usuario_id = $1 AND evento_id = $2',
            [usuarioId, eventoId]
        );
    },

    // Remove por ID (usado na tela de gestao de inscricoes)
    async excluirPorId(id) {
        await pool.query('DELETE FROM inscricoes WHERE id = $1', [id]);
    }
};

module.exports = InscricaoModel;
