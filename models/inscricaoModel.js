// =====================================================================
// SOEC - Model de Inscrições
// Salvar em: /models/inscricaoModel.js
// =====================================================================

const pool = require('../config/database');

module.exports = {
  // Lista todas as inscrições de um evento específico (usado na área administrativa)
  async listarPorEvento(eventoId) {
    const { rows } = await pool.query(
      `SELECT i.*, u.nome AS usuario_nome, u.matricula, u.turma
       FROM inscricoes i
       JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.evento_id = $1
       ORDER BY i.data_inscricao ASC`,
      [eventoId]
    );
    return rows;
  },

  // Lista todos os eventos em que um usuário está inscrito
  async listarPorUsuario(usuarioId) {
    const { rows } = await pool.query(
      `SELECT i.*, e.titulo, e.data_evento, e.local
       FROM inscricoes i
       JOIN eventos e ON e.id = i.evento_id
       WHERE i.usuario_id = $1
       ORDER BY e.data_evento ASC`,
      [usuarioId]
    );
    return rows;
  },

  // Verifica se o usuário já está inscrito no evento
  async jaInscrito(usuarioId, eventoId) {
    const { rows } = await pool.query(
      'SELECT id FROM inscricoes WHERE usuario_id = $1 AND evento_id = $2',
      [usuarioId, eventoId]
    );
    return !!rows[0];
  },

  // Conta quantas inscrições um evento já tem (para checar limite de vagas)
  async contarPorEvento(eventoId) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM inscricoes WHERE evento_id = $1',
      [eventoId]
    );
    return rows[0].total;
  },

  async criar({ usuario_id, evento_id }) {
    const { rows } = await pool.query(
      `INSERT INTO inscricoes (usuario_id, evento_id) VALUES ($1, $2) RETURNING *`,
      [usuario_id, evento_id]
    );
    return rows[0];
  },

  // Cancela a inscrição de um usuário em um evento (usado por ele mesmo)
  async cancelar(usuarioId, eventoId) {
    await pool.query(
      'DELETE FROM inscricoes WHERE usuario_id = $1 AND evento_id = $2',
      [usuarioId, eventoId]
    );
  },

  // Exclui uma inscrição pelo próprio id (usado pela administração)
  async excluirPorId(id) {
    await pool.query('DELETE FROM inscricoes WHERE id = $1', [id]);
  }
};