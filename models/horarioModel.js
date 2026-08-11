// =====================================================================
// SOEC - Model de Horários das Turmas
// Salvar em: /models/horarioModel.js
// =====================================================================

const pool = require('../config/database');

module.exports = {
  async listarTodos() {
    const { rows } = await pool.query(
      `SELECT h.*, u.nome AS atualizado_por_nome
       FROM horarios h
       LEFT JOIN usuarios u ON u.id = h.atualizado_por
       ORDER BY h.curso ASC`
    );
    return rows;
  },

  async buscarPorCurso(curso) {
    const { rows } = await pool.query(
      'SELECT * FROM horarios WHERE curso = $1',
      [curso]
    );
    return rows[0];
  },

  async salvarArquivo(curso, { arquivo_url, arquivo_nome_original, atualizado_por }) {
    const { rows } = await pool.query(
      `UPDATE horarios
       SET arquivo_url = $1, arquivo_nome_original = $2, atualizado_em = NOW(), atualizado_por = $3
       WHERE curso = $4
       RETURNING *`,
      [arquivo_url, arquivo_nome_original, atualizado_por, curso]
    );
    return rows[0];
  }
};