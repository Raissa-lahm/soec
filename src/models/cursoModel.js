const pool = require('../config/database');

module.exports = {
    async listar({ incluirInativos = false } = {}) {
        const r = await pool.query(`SELECT id, numero, nome, ativo FROM cursos ${incluirInativos ? '' : 'WHERE ativo=TRUE'} ORDER BY numero`);
        return r.rows;
    },
    async buscarPorNumero(numero) {
        const r = await pool.query('SELECT id,numero,nome,ativo FROM cursos WHERE numero=$1', [numero]);
        return r.rows[0];
    }
};
