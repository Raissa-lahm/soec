// =====================================================================
// SOEC - Model de Usuários
// Salvar em: /models/usuarioModel.js
//
// Camada responsável exclusivamente por conversar com o banco de dados
// (tabela "usuarios"). Nenhuma regra de negócio ou de rota fica aqui,
// apenas consultas SQL. Todas as queries usam parâmetros ($1, $2...)
// em vez de concatenar strings, o que previne SQL Injection.
// =====================================================================

const pool = require('../config/database');

module.exports = {
  // Busca um usuário pela matrícula (usado no login)
  async buscarPorMatricula(matricula) {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE matricula = $1',
      [matricula]
    );
    return rows[0];
  },

  // Busca um usuário pelo id
  async buscarPorId(id) {
    const { rows } = await pool.query(
      'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em FROM usuarios WHERE id = $1',
      [id]
    );
    return rows[0];
  },

  // Busca um usuário pelo email (usado para validar duplicidade no cadastro)
  async buscarPorEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );
    return rows[0];
  },

  // Lista todos os usuários, com filtro opcional por perfil e por texto (nome/matrícula)
  async listarTodos({ perfil, busca } = {}) {
    let query = 'SELECT id, nome, email, matricula, perfil, curso, turma, criado_em FROM usuarios WHERE 1=1';
    const params = [];

    if (perfil) {
      params.push(perfil);
      query += ` AND perfil = $${params.length}`;
    }

    if (busca) {
      params.push(`%${busca}%`);
      query += ` AND (nome ILIKE $${params.length} OR matricula ILIKE $${params.length})`;
    }

    query += ' ORDER BY nome ASC';

    const { rows } = await pool.query(query, params);
    return rows;
  },

  // Cria um novo usuário. A senha já deve chegar criptografada (hash bcrypt).
  async criar({ nome, email, matricula, senha, perfil, curso, turma }) {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, matricula, senha, perfil, curso, turma)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nome, email, matricula, perfil, curso, turma, criado_em`,
      [nome, email, matricula, senha, perfil, curso || null, turma || null]
    );
    return rows[0];
  },

  // Atualiza os dados de um usuário. Se a senha vier vazia, mantém a senha atual.
  async atualizar(id, { nome, email, matricula, perfil, curso, turma, senha }) {
    if (senha) {
      const { rows } = await pool.query(
        `UPDATE usuarios
         SET nome = $1, email = $2, matricula = $3, perfil = $4, curso = $5, turma = $6, senha = $7
         WHERE id = $8
         RETURNING id, nome, email, matricula, perfil, curso, turma`,
        [nome, email, matricula, perfil, curso || null, turma || null, senha, id]
      );
      return rows[0];
    }

    const { rows } = await pool.query(
      `UPDATE usuarios
       SET nome = $1, email = $2, matricula = $3, perfil = $4, curso = $5, turma = $6
       WHERE id = $7
       RETURNING id, nome, email, matricula, perfil, curso, turma`,
      [nome, email, matricula, perfil, curso || null, turma || null, id]
    );
    return rows[0];
  },

  // Remove um usuário pelo id
  async excluir(id) {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  }
};