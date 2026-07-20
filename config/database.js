// =========================================================================
// config/database.js
// Responsavel por criar e exportar o "pool" de conexoes com o PostgreSQL.
// Um pool reaproveita conexoes abertas, o que e muito mais eficiente do
// que abrir/fechar uma conexao nova a cada consulta.
// =========================================================================

require('dotenv').config(); // carrega as variaveis do arquivo .env
const { Pool } = require('pg');

// Cria o pool usando os dados definidos no .env
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Testa a conexao assim que o servidor sobe, para avisar rapido se algo
// estiver errado no .env (senha incorreta, banco nao existe, etc.)
pool.connect()
    .then((client) => {
        console.log('[SOEC] Conectado ao PostgreSQL com sucesso.');
        client.release();
    })
    .catch((err) => {
        console.error('[SOEC] ERRO ao conectar no PostgreSQL:', err.message);
    });

// Exportamos o pool para ser usado pelos "models" com queries parametrizadas,
// ex: pool.query('SELECT * FROM usuarios WHERE id = $1', [id])
module.exports = pool;
