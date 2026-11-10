// =========================================================================
// models/eventoModel.js
// Camada de acesso a dados da tabela "eventos".
// =========================================================================

const pool = require('../config/database');

const EventoModel = {

    // Lista eventos com filtros opcionais de pesquisa (titulo), categoria (tipo) e data
    async listar({ pesquisa, tipo, data } = {}) {
        const condicoes = [];
        const valores = [];
        let indice = 1;

        let sql = `
            SELECT e.*, u.nome AS nome_criador,
                   (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id) AS total_inscritos
            FROM eventos e
            JOIN usuarios u ON u.id = e.criado_por
        `;

        if (pesquisa) {
            condicoes.push(`e.titulo ILIKE $${indice}`);
            valores.push(`%${pesquisa}%`);
            indice++;
        }
        if (tipo) {
            condicoes.push(`e.tipo = $${indice}`);
            valores.push(tipo);
            indice++;
        }
        if (data) {
            condicoes.push(`e.data_evento::date = $${indice}::date`);
            valores.push(data);
            indice++;
        }

        if (condicoes.length > 0) {
            sql += ' WHERE ' + condicoes.join(' AND ');
        }

        sql += ' ORDER BY e.data_evento ASC';

        const resultado = await pool.query(sql, valores);
        return resultado.rows;
    },

    // Lista eventos futuros para o calendario institucional
    async listarParaCalendario() {
        const resultado = await pool.query(
            `SELECT id, titulo, tipo, data_evento, local
             FROM eventos
             ORDER BY data_evento ASC`
        );
        return resultado.rows;
    },

    // Busca um evento pelo ID, incluindo nome de quem criou
    async buscarPorId(id) {
        const resultado = await pool.query(
            `SELECT e.*, u.nome AS nome_criador,
                    (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id) AS total_inscritos
             FROM eventos e
             JOIN usuarios u ON u.id = e.criado_por
             WHERE e.id = $1`,
            [id]
        );
        return resultado.rows[0];
    },

    async criar({ titulo, descricao, tipo, data_evento, local, vagas_limite, criado_por }) {
        const resultado = await pool.query(
            `INSERT INTO eventos (titulo, descricao, tipo, data_evento, local, vagas_limite, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [titulo, descricao, tipo, data_evento, local, vagas_limite || 0, criado_por]
        );
        return resultado.rows[0];
    },

    async atualizar(id, { titulo, descricao, tipo, data_evento, local, vagas_limite }) {
        const resultado = await pool.query(
            `UPDATE eventos
             SET titulo = $1, descricao = $2, tipo = $3, data_evento = $4, local = $5, vagas_limite = $6
             WHERE id = $7
             RETURNING *`,
            [titulo, descricao, tipo, data_evento, local, vagas_limite || 0, id]
        );
        return resultado.rows[0];
    },

    async excluir(id) {
        await pool.query('DELETE FROM eventos WHERE id = $1', [id]);
    },

    // Lista todos os "tipos" (categorias) de evento distintos, para montar o filtro
    async listarTiposDistintos() {
        const resultado = await pool.query('SELECT DISTINCT tipo FROM eventos ORDER BY tipo ASC');
        return resultado.rows.map(r => r.tipo);
    }
};

module.exports = EventoModel;
