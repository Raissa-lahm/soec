// =====================================================================
// SOEC - Configuração de conexão com o PostgreSQL
// Salvar em: /config/database.js
//
// Usamos "pool" de conexões (em vez de criar uma conexão nova a cada
// consulta), o que é a prática recomendada para aplicações Node + pg:
// as conexões são reaproveitadas, melhorando desempenho e evitando
// esgotar o limite de conexões do banco.
// =====================================================================

require('dotenv').config(); // carrega as variáveis do arquivo .env
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,                     // número máximo de conexões simultâneas no pool
  idleTimeoutMillis: 30000,    // tempo até fechar conexões ociosas
  connectionTimeoutMillis: 5000
});

// Testa a conexão assim que o servidor sobe, para avisar cedo se algo
// estiver errado (credenciais, banco não criado, etc.)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', err.message);
    return;
  }
  console.log('✅ Conectado ao PostgreSQL com sucesso.');
  release(); // devolve a conexão de teste ao pool
});

module.exports = pool;