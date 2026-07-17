// =====================================================================
// SOEC - Model de Equipes e Membros
// Salvar em: /models/equipeModel.js
// =====================================================================

const pool = require('../config/database');

module.exports = {
  // Lista todas as equipes de um evento, já com a contagem de membros
  async listarPorEvento(eventoId) {
    const { rows } = await pool.query(
      `SELECT eq.*,
              (SELECT COUNT(*) FROM equipe_membros em WHERE em.equipe_id = eq.id) AS total_membros
       FROM equipes eq
       WHERE eq.evento_id = $1
       ORDER BY eq.nome ASC`,
      [eventoId]
    );
    return rows;
  },

  async listarTodas() {
    const { rows } = await pool.query(
      `SELECT eq.*, e.titulo AS evento_titulo
       FROM equipes eq
       JOIN eventos e ON e.id = eq.evento_id
       ORDER BY eq.id DESC`
    );
    return rows;
  },

  async buscarPorId(id) {
    const { rows } = await pool.query(
      `SELECT eq.*, e.titulo AS evento_titulo
       FROM equipes eq
       JOIN eventos e ON e.id = eq.evento_id
       WHERE eq.id = $1`,
      [id]
    );
    return rows[0];
  },

  async criar({ nome, modalidade, evento_id }) {
    const { rows } = await pool.query(
      `INSERT INTO equipes (nome, modalidade, evento_id) VALUES ($1, $2, $3) RETURNING *`,
      [nome, modalidade || null, evento_id]
    );
    return rows[0];
  },

  async atualizar(id, { nome, modalidade }) {
    const { rows } = await pool.query(
      `UPDATE equipes SET nome = $1, modalidade = $2 WHERE id = $3 RETURNING *`,
      [nome, modalidade || null, id]
    );
    return rows[0];
  },

  async excluir(id) {
    await pool.query('DELETE FROM equipes WHERE id = $1', [id]);
  },

  // ---- Membros da equipe ----

  async listarMembros(equipeId) {
    const { rows } = await pool.query(
      `SELECT em.id, u.id AS usuario_id, u.nome, u.matricula, u.turma
       FROM equipe_membros em
       JOIN usuarios u ON u.id = em.usuario_id
       WHERE em.equipe_id = $1
       ORDER BY u.nome ASC`,
      [equipeId]
    );
    return rows;
  },

  async jaEhMembro(equipeId, usuarioId) {
    const { rows } = await pool.query(
      'SELECT id FROM equipe_membros WHERE equipe_id = $1 AND usuario_id = $2',
      [equipeId, usuarioId]
    );
    return !!rows[0];
  },

  async adicionarMembro(equipeId, usuarioId) {
    const { rows } = await pool.query(
      `INSERT INTO equipe_membros (equipe_id, usuario_id) VALUES ($1, $2) RETURNING *`,
      [equipeId, usuarioId]
    );
    return rows[0];
  },

  async removerMembro(equipeId, usuarioId) {
    await pool.query(
      'DELETE FROM equipe_membros WHERE equipe_id = $1 AND usuario_id = $2',
      [equipeId, usuarioId]
    );
  }
};