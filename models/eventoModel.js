// =====================================================================
// SOEC - Model de Eventos
// Salvar em: /models/eventoModel.js
// =====================================================================

const pool = require('../config/database');

module.exports = {
  // Lista eventos com filtros opcionais de pesquisa por texto, tipo (categoria) e data
  async listar({ busca, tipo, data } = {}) {
    let query = `
      SELECT e.*, u.nome AS criador_nome,
             (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id) AS total_inscritos
      FROM eventos e
      JOIN usuarios u ON u.id = e.criado_por
      WHERE 1=1
    `;
    const params = [];

    if (busca) {
      params.push(`%${busca}%`);
      query += ` AND (e.titulo ILIKE $${params.length} OR e.descricao ILIKE $${params.length})`;
    }

    if (tipo) {
      params.push(tipo);
      query += ` AND e.tipo = $${params.length}`;
    }

    if (data) {
      params.push(data); // formato esperado: 'YYYY-MM-DD'
      query += ` AND DATE(e.data_evento) = $${params.length}`;
    }

    query += ' ORDER BY e.data_evento ASC';

    const { rows } = await pool.query(query, params);
    return rows;
  },

  // Busca um evento pelo id, incluindo o total de inscritos
  async buscarPorId(id) {
    const { rows } = await pool.query(
      `SELECT e.*, u.nome AS criador_nome,
              (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id) AS total_inscritos
       FROM eventos e
       JOIN usuarios u ON u.id = e.criado_por
       WHERE e.id = $1`,
      [id]
    );
    return rows[0];
  },

  // Lista todos os eventos futuros (usado no calendário)
  async listarParaCalendario() {
    const { rows } = await pool.query(
      `SELECT id, titulo, tipo, data_evento, local FROM eventos ORDER BY data_evento ASC`
    );
    return rows;
  },

  async criar({ titulo, descricao, tipo, data_evento, local, vagas_limite, criado_por }) {
    const { rows } = await pool.query(
      `INSERT INTO eventos (titulo, descricao, tipo, data_evento, local, vagas_limite, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [titulo, descricao, tipo, data_evento, local, vagas_limite || null, criado_por]
    );
    return rows[0];
  },

  async atualizar(id, { titulo, descricao, tipo, data_evento, local, vagas_limite }) {
    const { rows } = await pool.query(
      `UPDATE eventos
       SET titulo = $1, descricao = $2, tipo = $3, data_evento = $4, local = $5, vagas_limite = $6
       WHERE id = $7
       RETURNING *`,
      [titulo, descricao, tipo, data_evento, local, vagas_limite || null, id]
    );
    return rows[0];
  },

  async excluir(id) {
    await pool.query('DELETE FROM eventos WHERE id = $1', [id]);
  },

  // Retorna todos os tipos/categorias distintos já cadastrados (para popular filtro)
  async listarTipos() {
    const { rows } = await pool.query('SELECT DISTINCT tipo FROM eventos ORDER BY tipo');
    return rows.map(r => r.tipo);
  }
};