// =====================================================================
// SOEC - Model de Regulamentos
// Salvar em: /models/regulamentoModel.js
// =====================================================================

const pool = require('../config/database');

module.exports = {
  async listar() {
    const { rows } = await pool.query(
      `SELECT r.*, u.nome AS criador_nome
       FROM regulamentos r
       JOIN usuarios u ON u.id = r.criado_por
       ORDER BY r.criado_em DESC`
    );
    return rows;
  },

  async buscarPorId(id) {
    const { rows } = await pool.query(
      `SELECT r.*, u.nome AS criador_nome
       FROM regulamentos r
       JOIN usuarios u ON u.id = r.criado_por
       WHERE r.id = $1`,
      [id]
    );
    return rows[0];
  },

  async criar({ titulo, descricao, arquivo_url, criado_por }) {
    const { rows } = await pool.query(
      `INSERT INTO regulamentos (titulo, descricao, arquivo_url, criado_por)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [titulo, descricao, arquivo_url || null, criado_por]
    );
    return rows[0];
  },

  async atualizar(id, { titulo, descricao, arquivo_url }) {
    const { rows } = await pool.query(
      `UPDATE regulamentos SET titulo = $1, descricao = $2, arquivo_url = $3 WHERE id = $4 RETURNING *`,
      [titulo, descricao, arquivo_url || null, id]
    );
    return rows[0];
  },

  async excluir(id) {
    await pool.query('DELETE FROM regulamentos WHERE id = $1', [id]);
  }
};