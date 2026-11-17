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
                   (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id AND i.status IN ('PENDENTE','CONFIRMADA')) AS total_inscritos,
                   COALESCE((SELECT array_agg(ec.curso_id ORDER BY c.numero) FROM evento_cursos ec JOIN cursos c ON c.id=ec.curso_id WHERE ec.evento_id=e.id), ARRAY[]::int[]) AS curso_ids,
                   COALESCE((SELECT array_agg(c.nome ORDER BY c.numero) FROM evento_cursos ec JOIN cursos c ON c.id=ec.curso_id WHERE ec.evento_id=e.id), ARRAY[]::text[]) AS curso_nomes
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

    // Lista eventos para o calendario institucional
    async listarParaCalendario() {
        const resultado = await pool.query(
            `SELECT id, titulo, tipo, local,
                    EXTRACT(YEAR FROM data_evento)::int AS ano,
                    EXTRACT(MONTH FROM data_evento)::int AS mes,
                    EXTRACT(DAY FROM data_evento)::int AS dia,
                    TO_CHAR(data_evento, 'HH24:MI') AS horario
             FROM eventos WHERE status IN ('ABERTO','ENCERRADO')
             ORDER BY data_evento ASC`
        );
        return resultado.rows;
    },

    // Busca um evento pelo ID, incluindo nome de quem criou
    async buscarPorId(id) {
        const resultado = await pool.query(
            `SELECT e.*, u.nome AS nome_criador,
                    (SELECT COUNT(*) FROM inscricoes i WHERE i.evento_id = e.id AND i.status IN ('PENDENTE','CONFIRMADA')) AS total_inscritos,
                    COALESCE((SELECT array_agg(ec.curso_id ORDER BY c.numero) FROM evento_cursos ec JOIN cursos c ON c.id=ec.curso_id WHERE ec.evento_id=e.id), ARRAY[]::int[]) AS curso_ids,
                    COALESCE((SELECT array_agg(c.nome ORDER BY c.numero) FROM evento_cursos ec JOIN cursos c ON c.id=ec.curso_id WHERE ec.evento_id=e.id), ARRAY[]::text[]) AS curso_nomes
             FROM eventos e
             JOIN usuarios u ON u.id = e.criado_por
             WHERE e.id = $1`,
            [id]
        );
        return resultado.rows[0];
    },

    async criar(dados) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const evento = await salvarEvento(client, dados);
            await salvarCursos(client, evento.id, dados.curso_ids || []);
            await client.query('COMMIT');
            return evento;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    },

    async atualizar(id, dados) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const evento = await salvarEvento(client, { ...dados, id });
            await salvarCursos(client, id, dados.curso_ids || []);
            await client.query('COMMIT');
            return evento;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
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

async function salvarEvento(client,d) {
    const values=[d.titulo,d.descricao,d.tipo,d.data_evento,d.local,d.vagas_limite,d.criado_por,d.modo_inscricao,d.status,d.inscricao_inicio,d.inscricao_fim,d.valor_inscricao,d.prazo_pagamento,d.externo,d.endereco,d.ponto_encontro,d.saida_em,d.retorno_em,d.transporte_ofertado,d.transporte_obrigatorio,d.valor_transporte,d.vagas_transporte,d.exige_cpf,d.exige_contato_emergencia,d.exige_autorizacao_responsavel,d.series_permitidas];
    const columns='titulo,descricao,tipo,data_evento,local,vagas_limite,criado_por,modo_inscricao,status,inscricao_inicio,inscricao_fim,valor_inscricao,prazo_pagamento,externo,endereco,ponto_encontro,saida_em,retorno_em,transporte_ofertado,transporte_obrigatorio,valor_transporte,vagas_transporte,exige_cpf,exige_contato_emergencia,exige_autorizacao_responsavel,series_permitidas';
    if(d.id) {
        const sets=columns.split(',').filter(c=>c!=='criado_por').map((c,i)=>`${c}=$${i+1}`).join(',');
        const updateValues=values.filter((_,i)=>i!==6); updateValues.push(d.id);
        const r=await client.query(`UPDATE eventos SET ${sets} WHERE id=$${updateValues.length} RETURNING *`,updateValues); return r.rows[0];
    }
    const r=await client.query(`INSERT INTO eventos(${columns}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values); return r.rows[0];
}
async function salvarCursos(client,eventoId,cursoIds) {
    await client.query('DELETE FROM evento_cursos WHERE evento_id=$1',[eventoId]);
    for(const cursoId of [...new Set(cursoIds.map(Number).filter(Number.isInteger))]) await client.query('INSERT INTO evento_cursos(evento_id,curso_id) VALUES($1,$2)',[eventoId,cursoId]);
}

module.exports = EventoModel;
