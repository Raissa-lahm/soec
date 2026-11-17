const pool = require('../config/database');

module.exports = {
    async listar({ inicio, fim, cursoId = null, serie = null, todas = false }) {
        const r = await pool.query(`SELECT d.*,d.data_inicio::text,d.data_fim::text,c.nome AS curso_nome
            FROM calendario_datas d LEFT JOIN cursos c ON c.id=d.curso_id
            WHERE d.data_inicio <= $2::date AND COALESCE(d.data_fim,d.data_inicio) >= $1::date
              AND ($5::boolean OR d.curso_id IS NULL OR d.curso_id=$3)
              AND ($5::boolean OR d.serie IS NULL OR d.serie=$4)
            ORDER BY d.data_inicio,d.titulo`, [inicio,fim,cursoId,serie,todas]);
        return r.rows;
    },
    async todos() {
        const r = await pool.query(`SELECT d.*,d.data_inicio::text,d.data_fim::text,c.nome AS curso_nome
            FROM calendario_datas d LEFT JOIN cursos c ON c.id=d.curso_id ORDER BY data_inicio DESC`);
        return r.rows;
    },
    async trimestres(ano) {
        const r = await pool.query('SELECT id,ano,numero,inicio::text,fim::text FROM trimestres WHERE ano=$1 ORDER BY numero', [ano]);
        return r.rows;
    },
    async trimestreAtual() {
        const r = await pool.query(`SELECT numero,inicio::text,fim::text, GREATEST(0,(fim-CURRENT_DATE))::int AS dias_restantes
            FROM trimestres WHERE CURRENT_DATE BETWEEN inicio AND fim LIMIT 1`);
        return r.rows[0];
    },
    async proximas(quantidade=5,cursoId=null,serie=null,todas=false) {
        const r=await pool.query(`SELECT d.*,d.data_inicio::text,d.data_fim::text,c.nome AS curso_nome
            FROM calendario_datas d LEFT JOIN cursos c ON c.id=d.curso_id WHERE COALESCE(d.data_fim,d.data_inicio)>=CURRENT_DATE
              AND ($3::boolean OR d.curso_id IS NULL OR d.curso_id=$1) AND ($3::boolean OR d.serie IS NULL OR d.serie=$2)
            ORDER BY d.data_inicio LIMIT $4`,[cursoId,serie,todas,quantidade]);
        return r.rows;
    },
    async salvarData(data) {
        if(data.id) {
            await pool.query(`UPDATE calendario_datas SET titulo=$1,tipo=$2,data_inicio=$3,data_fim=$4,sem_aula=$5,curso_id=$6,serie=$7,descricao=$8 WHERE id=$9`,
                [data.titulo,data.tipo,data.dataInicio,data.dataFim||null,data.semAula,data.cursoId||null,data.serie||null,data.descricao||null,data.id]);
            return {id:data.id};
        }
        const r = await pool.query(`INSERT INTO calendario_datas(titulo,tipo,data_inicio,data_fim,sem_aula,curso_id,serie,descricao,criado_por)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [data.titulo,data.tipo,data.dataInicio,data.dataFim||null,data.semAula,data.cursoId||null,data.serie||null,data.descricao||null,data.criadoPor]);
        return r.rows[0];
    },
    async excluirData(id) { await pool.query('DELETE FROM calendario_datas WHERE id=$1',[id]); },
    async salvarTrimestre({ano,numero,inicio,fim}) {
        const r = await pool.query(`INSERT INTO trimestres(ano,numero,inicio,fim) VALUES($1,$2,$3,$4)
            ON CONFLICT(ano,numero) DO UPDATE SET inicio=EXCLUDED.inicio,fim=EXCLUDED.fim RETURNING id`,[ano,numero,inicio,fim]);
        return r.rows[0];
    },
    async excluirTrimestre(id) { await pool.query('DELETE FROM trimestres WHERE id=$1',[id]); },
    async copiarDatas(anoOrigem, anoDestino) {
        await pool.query(`INSERT INTO calendario_datas(titulo,tipo,data_inicio,data_fim,sem_aula,curso_id,serie,descricao,criado_por)
            SELECT titulo,tipo,make_date($2,EXTRACT(MONTH FROM data_inicio)::int,LEAST(EXTRACT(DAY FROM data_inicio)::int,EXTRACT(DAY FROM (date_trunc('month',make_date($2,EXTRACT(MONTH FROM data_inicio)::int,1)) + interval '1 month - 1 day'))::int)),
            CASE WHEN data_fim IS NULL THEN NULL ELSE make_date($2,EXTRACT(MONTH FROM data_fim)::int,LEAST(EXTRACT(DAY FROM data_fim)::int,EXTRACT(DAY FROM (date_trunc('month',make_date($2,EXTRACT(MONTH FROM data_fim)::int,1)) + interval '1 month - 1 day'))::int)) END,
            sem_aula,curso_id,serie,descricao,criado_por FROM calendario_datas WHERE EXTRACT(YEAR FROM data_inicio)=$1`,[anoOrigem,anoDestino]);
    }
};
