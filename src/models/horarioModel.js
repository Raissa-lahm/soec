// =====================================================================
// SOEC - Model de Horários das Turmas
// Salvar em: /src/models/horarioModel.js
// =====================================================================

const pool = require('../config/database');

async function suportaArquivoNoBanco() {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'horarios'
         AND column_name = 'arquivo_conteudo'
     ) AS disponivel`
  );
  return rows[0].disponivel;
}

module.exports = {
  async listarTodos() {
    const temColunaPersistente = await suportaArquivoNoBanco();
    const campoPersistente = temColunaPersistente
      ? 'h.arquivo_conteudo IS NOT NULL AS tem_arquivo_banco'
      : 'FALSE AS tem_arquivo_banco';
    const { rows } = await pool.query(
      `SELECT h.id, h.curso, h.arquivo_url, h.arquivo_nome_original,
              ${campoPersistente},
              h.atualizado_em, h.atualizado_por,
              u.nome AS atualizado_por_nome
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

  async buscarArquivoPorId(id) {
    if (!(await suportaArquivoNoBanco())) return undefined;
    const { rows } = await pool.query(
      `SELECT arquivo_conteudo, arquivo_nome_original
       FROM horarios WHERE id = $1 AND arquivo_conteudo IS NOT NULL`,
      [id]
    );
    return rows[0];
  },

  async salvarArquivo(curso, { arquivo_conteudo, arquivo_nome_original, atualizado_por }) {
    if (!(await suportaArquivoNoBanco())) {
      throw new Error('A migração 005 precisa ser aplicada ao banco antes de enviar horários.');
    }
    const { rows } = await pool.query(
      `UPDATE horarios
       SET arquivo_conteudo = $1, arquivo_url = NULL, arquivo_nome_original = $2,
           atualizado_em = NOW(), atualizado_por = $3
       WHERE curso = $4
       RETURNING *`,
      [arquivo_conteudo, arquivo_nome_original, atualizado_por, curso]
    );
    return rows[0];
  }
};
