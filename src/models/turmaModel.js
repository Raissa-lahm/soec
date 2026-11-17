const pool = require('../config/database');

module.exports = {
    async listar(ano) {
        const r = await pool.query(`SELECT t.*,c.numero AS curso_numero,c.nome AS curso_nome,c.ativo AS curso_ativo
            FROM turmas t JOIN cursos c ON c.id=t.curso_id WHERE t.ano_letivo=$1
            ORDER BY c.numero,t.serie,t.subturma NULLS FIRST`, [ano]);
        return r.rows;
    },
    async buscarPorId(id, ano = null) {
        const r = await pool.query(`SELECT t.*,c.numero AS curso_numero,c.nome AS curso_nome
            FROM turmas t JOIN cursos c ON c.id=t.curso_id WHERE t.id=$1 AND ($2::smallint IS NULL OR t.ano_letivo=$2)`, [id, ano]);
        return r.rows[0];
    },
    async buscarPorCodigo(codigo, ano) {
        const r = await pool.query(`SELECT t.*,c.numero AS curso_numero,c.nome AS curso_nome FROM turmas t
            JOIN cursos c ON c.id=t.curso_id WHERE t.codigo=$1 AND t.ano_letivo=$2 AND t.ativo=TRUE AND c.ativo=TRUE`, [codigo, ano]);
        return r.rows[0];
    },
    async salvar({ id, cursoId, serie, subturma, ano, codigo }) {
        if (id) {
            const r = await pool.query(`UPDATE turmas SET curso_id=$1,serie=$2,subturma=$3,ano_letivo=$4,codigo=$5 WHERE id=$6 RETURNING *`,
                [cursoId, serie, subturma, ano, codigo, id]);
            return r.rows[0];
        }
        const r = await pool.query(`INSERT INTO turmas(curso_id,serie,subturma,ano_letivo,codigo) VALUES($1,$2,$3,$4,$5) RETURNING *`,
            [cursoId, serie, subturma, ano, codigo]);
        return r.rows[0];
    },
    async desativar(id) {
        await pool.query('UPDATE turmas SET ativo=FALSE WHERE id=$1', [id]);
    },
    async mapearAluno({ id, cursoId, turmaId, cursoNome, turmaCodigo }) {
        await pool.query('UPDATE usuarios SET curso_id=$1,turma_id=$2,curso=$3,turma=$4 WHERE id=$5', [cursoId, turmaId, cursoNome, turmaCodigo, id]);
    },
    async alunosSemTurma(ano) {
        const r = await pool.query(`SELECT u.id,u.nome,u.matricula,u.curso,u.turma FROM usuarios u
            WHERE u.perfil='ALUNO' AND NOT EXISTS(SELECT 1 FROM turmas t WHERE t.id=u.turma_id AND t.ano_letivo=$1 AND t.ativo=TRUE) ORDER BY u.nome`,[ano]);
        return r.rows;
    }
};
