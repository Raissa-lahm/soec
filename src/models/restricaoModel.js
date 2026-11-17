const pool = require('../config/database');
const InscricaoModel = require('./inscricaoModel');

module.exports = {
    async criarLote({ matriculas, eventoId, motivo, vigenteAte, criadoPor, cancelar }) {
        const client = await pool.connect();
        const criadas = [];
        try {
            await client.query('BEGIN');
            // Serializa criação de restrição com inscrever/cancelar, que também bloqueiam a linha do evento.
            await client.query('SELECT id FROM eventos WHERE ($1::int IS NULL OR id=$1) ORDER BY id FOR UPDATE', [eventoId || null]);
            for (const matricula of [...new Set(matriculas.map(m => String(m).trim()).filter(Boolean))]) {
                const alvo = await client.query("SELECT id FROM usuarios WHERE matricula=$1 AND perfil='ALUNO'", [matricula]);
                if (!alvo.rowCount) continue;
                const r = await client.query(`INSERT INTO restricoes_inscricao(usuario_id,evento_id,motivo,vigente_ate,criado_por)
                    VALUES($1,$2,$3,$4,$5) RETURNING id,usuario_id,evento_id`,
                    [alvo.rows[0].id, eventoId || null, motivo, vigenteAte || null, criadoPor]);
                criadas.push(r.rows[0]);
                if (cancelar) {
                    const cancel = await client.query(`UPDATE inscricoes SET status='CANCELADA',atualizado_em=NOW()
                    WHERE usuario_id=$1 AND status IN ('PENDENTE','CONFIRMADA','LISTA_ESPERA') AND ($2::int IS NULL OR evento_id=$2) RETURNING evento_id`,
                        [alvo.rows[0].id,eventoId || null]);
                    const eventos = cancel.rows.map(row => row.evento_id);
                    if (eventos.length) {
                        const unicos=[...new Set(eventos)];
                        await client.query('DELETE FROM equipe_membros em USING equipes eq WHERE em.equipe_id=eq.id AND em.usuario_id=$1 AND eq.evento_id=ANY($2::int[])', [alvo.rows[0].id,unicos]);
                        for(const eventId of unicos)await InscricaoModel.promoverVagasLiberadas(client,eventId);
                    }
                }
            }
            await client.query('COMMIT');
            return criadas;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally { client.release(); }
    },
    async listar({ historico = false } = {}) {
        const r = await pool.query(`SELECT r.id,r.usuario_id,r.evento_id,r.motivo,r.vigente_ate,r.criado_em,r.revogado_em,
            (r.revogado_em IS NULL AND (r.vigente_ate IS NULL OR r.vigente_ate>=CURRENT_DATE)) AS vigente,
            u.nome,u.matricula,e.titulo AS evento_titulo FROM restricoes_inscricao r JOIN usuarios u ON u.id=r.usuario_id
            LEFT JOIN eventos e ON e.id=r.evento_id
            WHERE ${historico ? 'TRUE' : "r.revogado_em IS NULL AND (r.vigente_ate IS NULL OR r.vigente_ate >= CURRENT_DATE)"}
            ORDER BY r.criado_em DESC`);
        return r.rows;
    },
    async revogar(id, usuarioId) {
        const client=await pool.connect();
        try {
            await client.query('BEGIN');
            const atual=await client.query('SELECT usuario_id,evento_id FROM restricoes_inscricao WHERE id=$1 AND revogado_em IS NULL',[id]);
            if(!atual.rowCount){await client.query('COMMIT');return null;}
            await client.query('SELECT id FROM eventos WHERE ($1::int IS NULL OR id=$1) ORDER BY id FOR UPDATE',[atual.rows[0].evento_id]);
            const r=await client.query(`UPDATE restricoes_inscricao SET revogado_em=NOW(),revogado_por=$2
                WHERE id=$1 AND revogado_em IS NULL RETURNING id,usuario_id,evento_id`,[id,usuarioId]);
            await client.query('COMMIT');return r.rows[0];
        } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
    }
};
