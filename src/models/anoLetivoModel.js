const pool = require('../config/database');

module.exports = {
    async vigente() {
        const r = await pool.query(`SELECT ano,inicio,fim FROM anos_letivos
            ORDER BY (CURRENT_DATE BETWEEN inicio AND fim) DESC, ano DESC LIMIT 1`);
        return r.rows[0] || { ano: new Date().getFullYear(), inicio: null, fim: null };
    },
    async listar() {
        const r = await pool.query('SELECT ano,inicio::text,fim::text FROM anos_letivos ORDER BY ano DESC');
        return r.rows;
    },
    async salvar({ ano, inicio, fim }) {
        const r = await pool.query(`INSERT INTO anos_letivos(ano,inicio,fim) VALUES($1,$2,$3)
            ON CONFLICT(ano) DO UPDATE SET inicio=EXCLUDED.inicio,fim=EXCLUDED.fim RETURNING *`, [ano,inicio,fim]);
        return r.rows[0];
    },
    async excluir(ano) { await pool.query('DELETE FROM anos_letivos WHERE ano=$1',[ano]); }
};
