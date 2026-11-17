const pool = require('../config/database');

const COLUNAS = `id, nome, email, matricula, perfil, curso, turma, criado_em,
    curso_id, turma_id, senha IS NULL AS pendente, deve_trocar_senha`;

const UsuarioModel = {
    async buscarPorMatricula(matricula) {
        const r = await pool.query('SELECT * FROM usuarios WHERE matricula = $1', [matricula]);
        return r.rows[0];
    },
    async registrarFalhaLogin(id) {
        await pool.query(`UPDATE usuarios SET tentativas_login=tentativas_login+1,
            bloqueado_ate=CASE WHEN tentativas_login+1 >= 5 THEN NOW()+INTERVAL '15 minutes' ELSE bloqueado_ate END
            WHERE id=$1`, [id]);
    },
    async limparFalhasLogin(id) {
        await pool.query('UPDATE usuarios SET tentativas_login=0,bloqueado_ate=NULL WHERE id=$1', [id]);
    },
    async buscarPorEmail(email) {
        const r = await pool.query('SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
        return r.rows[0];
    },
    async buscarPorId(id) {
        const r = await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE id = $1`, [id]);
        return r.rows[0];
    },
    async listarTodos(perfil) {
        const r = perfil
            ? await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE perfil = $1 ORDER BY nome`, [perfil])
            : await pool.query(`SELECT ${COLUNAS} FROM usuarios ORDER BY nome`);
        return r.rows;
    },
    async criar({ nome, email, matricula, senhaHash = null, perfil, curso, turma, cursoId = null, turmaId = null, deveTrocarSenha = false }) {
        const r = await pool.query(
            `INSERT INTO usuarios (nome,email,matricula,senha,perfil,curso,turma,curso_id,turma_id,deve_trocar_senha)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id,nome,email,matricula,perfil,curso,turma,deve_trocar_senha`,
            [nome, email, matricula, senhaHash, perfil, curso || null, turma || null, cursoId, turmaId, deveTrocarSenha]
        );
        return r.rows[0];
    },
    async criarPendente({ nome, email, matricula, perfil, curso, turma, cursoId = null, codigoHash, validadeHoras = 48 }) {
        const r = await pool.query(
            `INSERT INTO usuarios (nome,email,matricula,senha,perfil,curso,turma,curso_id,codigo_ativacao_hash,codigo_expira_em,tentativas_ativacao,deve_trocar_senha)
             VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,NOW()+make_interval(hours => $9),0,FALSE)
             RETURNING id,nome,email,matricula,perfil`,
            [nome,email,matricula,perfil,curso || null,turma || null,cursoId,codigoHash,validadeHoras]
        );
        return r.rows[0];
    },
    async atualizar(id, { nome, email, matricula, perfil, curso, turma, cursoId = null, turmaId = null }) {
        const r = await pool.query(
            `UPDATE usuarios SET nome=$1,email=$2,matricula=$3,perfil=$4,curso=$5,turma=$6,curso_id=$7,turma_id=$8 WHERE id=$9 RETURNING ${COLUNAS}`,
            [nome,email,matricula,perfil,curso || null,turma || null,cursoId,turmaId,id]
        );
        return r.rows[0];
    },
    async trocarSenhaObrigatoria(id, senhaHash) {
        const r = await pool.query(
            `UPDATE usuarios SET senha=$1,deve_trocar_senha=FALSE,senha_alterada_em=NOW(),
             codigo_ativacao_hash=NULL,codigo_expira_em=NULL,tentativas_ativacao=0 WHERE id=$2 RETURNING id`,
            [senhaHash,id]
        );
        return r.rows[0];
    },
    async ativarConta(id, senhaHash) {
        const r = await pool.query(
            `UPDATE usuarios SET senha=$1,deve_trocar_senha=FALSE,senha_alterada_em=NOW(),
             codigo_ativacao_hash=NULL,codigo_expira_em=NULL,tentativas_ativacao=0
             WHERE id=$2 AND senha IS NULL AND perfil IN ('PROFESSOR','COORDENACAO','DIRECAO')
               AND codigo_expirA_em > NOW() AND tentativas_ativacao < 5 RETURNING id`, [senhaHash,id]);
        return r.rows[0];
    },
    async buscarParaAtivacao(matricula, email) {
        const r = await pool.query(
            `SELECT id,matricula,email,perfil,senha,codigo_ativacao_hash,codigo_expira_em,tentativas_ativacao
             FROM usuarios WHERE matricula=$1 AND LOWER(email)=LOWER($2)`, [matricula,email]);
        return r.rows[0];
    },
    async registrarFalhaAtivacao(id) {
        await pool.query(`UPDATE usuarios SET tentativas_ativacao=LEAST(tentativas_ativacao+1,5) WHERE id=$1 AND senha IS NULL`, [id]);
    },
    async redefinirAluno(id, senhaHash) {
        await pool.query(`UPDATE usuarios SET senha=$1,deve_trocar_senha=TRUE,senha_alterada_em=NULL,
            codigo_ativacao_hash=NULL,codigo_expira_em=NULL,tentativas_ativacao=0 WHERE id=$2 AND perfil='ALUNO'`, [senhaHash,id]);
    },
    async redefinirParaPrimeiroAcesso(id, codigoHash, validadeHoras = 48) {
        await pool.query(`UPDATE usuarios SET senha=NULL,deve_trocar_senha=FALSE,codigo_ativacao_hash=$1,
            codigo_expira_em=NOW()+make_interval(hours => $2),tentativas_ativacao=0 WHERE id=$3`, [codigoHash,validadeHoras,id]);
    },
    async contarDirecoesAtivas() {
        const r = await pool.query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE perfil='DIRECAO' AND senha IS NOT NULL`);
        return r.rows[0].total;
    },
    async encerrarSessoes(id) {
        await pool.query("DELETE FROM session WHERE (sess::jsonb -> 'usuario' ->> 'id') = $1", [String(id)]);
    },
    async excluir(id) { await pool.query('DELETE FROM usuarios WHERE id=$1', [id]); }
};

module.exports = UsuarioModel;
