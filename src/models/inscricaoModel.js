const pool = require('../config/database');
const { verificarElegibilidade } = require('../utils/elegibilidade');

async function promover(client, evento) {
    if (Number(evento.vagas_limite) <= 0) return;
    let total=(await client.query("SELECT COUNT(*)::int AS n FROM inscricoes WHERE evento_id=$1 AND status IN ('PENDENTE','CONFIRMADA')",[evento.id])).rows[0].n;
    while(total < Number(evento.vagas_limite)) {
        const prox=await client.query("SELECT * FROM inscricoes WHERE evento_id=$1 AND status='LISTA_ESPERA' ORDER BY data_inscricao,id FOR UPDATE SKIP LOCKED LIMIT 1",[evento.id]);
        if(!prox.rowCount) break;
        const i=prox.rows[0];
        if(i.usa_transporte && evento.vagas_transporte !== null) {
            const usados=(await client.query("SELECT COUNT(*)::int AS n FROM inscricoes WHERE evento_id=$1 AND usa_transporte=TRUE AND status IN ('PENDENTE','CONFIRMADA')",[evento.id])).rows[0].n;
            if(usados >= Number(evento.vagas_transporte)) {
                if(evento.transporte_obrigatorio) break;
                i.usa_transporte=false;
                i.valor_total=Number(evento.valor_inscricao);
                i.pagamento_status=Number(i.valor_total)===0?'ISENTO':'PENDENTE';
            }
        }
        let status='PENDENTE';
        const usuario=(await client.query('SELECT cpf_hash FROM usuarios WHERE id=$1',[i.usuario_id])).rows[0];
        const dadosOk=(!evento.exige_cpf||Boolean(usuario?.cpf_hash))&&(!evento.exige_contato_emergencia||(i.contato_emergencia_nome&&i.contato_emergencia_telefone));
        if(['PAGO','ISENTO'].includes(i.pagamento_status)&&(!evento.exige_autorizacao_responsavel||i.autorizacao_recebida)&&dadosOk) status='CONFIRMADA';
        await client.query('UPDATE inscricoes SET status=$1,usa_transporte=$2,valor_total=$3,pagamento_status=$4,atualizado_em=NOW() WHERE id=$5',[status,i.usa_transporte,i.valor_total,i.pagamento_status,i.id]);
        total++;
    }
}

async function lockedEvent(client,eventId) {
    const r=await client.query('SELECT * FROM eventos WHERE id=$1 FOR UPDATE',[eventId]);
    return r.rows[0];
}

const InscricaoModel={
    async listarPorEvento(eventoId) {
        await this.expirarVencidas(eventoId);
        const r=await pool.query(`SELECT i.*,u.id AS usuario_id,u.nome,u.matricula,u.turma,u.cpf_hash IS NOT NULL AS tem_cpf,u.cpf_cifrado,
            e.exige_cpf,e.exige_contato_emergencia,e.exige_autorizacao_responsavel
            FROM inscricoes i JOIN usuarios u ON u.id=i.usuario_id JOIN eventos e ON e.id=i.evento_id
            WHERE i.evento_id=$1 ORDER BY CASE i.status WHEN 'CONFIRMADA' THEN 1 WHEN 'PENDENTE' THEN 2 WHEN 'LISTA_ESPERA' THEN 3 ELSE 4 END,i.data_inscricao`,[eventoId]);
        return r.rows;
    },
    async totais(eventoId) {
        const r=await pool.query(`SELECT COUNT(*) FILTER(WHERE status='CONFIRMADA')::int AS confirmadas,
            COUNT(*) FILTER(WHERE status='PENDENTE')::int AS pendentes,COUNT(*) FILTER(WHERE status='LISTA_ESPERA')::int AS lista_espera,
            COALESCE(SUM(valor_total) FILTER(WHERE pagamento_status='PAGO'),0)::numeric AS arrecadado,
            COALESCE(SUM(valor_total) FILTER(WHERE pagamento_status='PENDENTE' AND status IN ('PENDENTE','CONFIRMADA')),0)::numeric AS a_receber,
            COUNT(*) FILTER(WHERE usa_transporte=TRUE AND status IN ('PENDENTE','CONFIRMADA'))::int AS transporte_usado
            FROM inscricoes WHERE evento_id=$1`,[eventoId]);
        return r.rows[0];
    },
    async listarPorUsuario(usuarioId) {
        const r=await pool.query(`SELECT i.*,e.titulo,e.data_evento,e.local,e.tipo,e.prazo_pagamento,e.exige_autorizacao_responsavel
            FROM inscricoes i JOIN eventos e ON e.id=i.evento_id WHERE i.usuario_id=$1 ORDER BY e.data_evento`,[usuarioId]);
        return r.rows;
    },
    async jaInscrito(usuarioId,eventoId) {
        const r=await pool.query("SELECT 1 FROM inscricoes WHERE usuario_id=$1 AND evento_id=$2 AND status NOT IN ('CANCELADA','EXPIRADA')",[usuarioId,eventoId]);
        return r.rowCount>0;
    },
    async contarInscritos(eventoId) {
        const r=await pool.query("SELECT COUNT(*)::int AS total FROM inscricoes WHERE evento_id=$1 AND status IN ('PENDENTE','CONFIRMADA')",[eventoId]);
        return r.rows[0].total;
    },
    async promoverVagasLiberadas(client,eventoId) {
        const r=await client.query('SELECT * FROM eventos WHERE id=$1 FOR UPDATE',[eventoId]);
        if(r.rows[0])await promover(client,r.rows[0]);
    },
    async disponibilidadeTransporte(eventoId) {
        const r=await pool.query(`SELECT e.vagas_transporte,
            COUNT(i.id) FILTER(WHERE i.usa_transporte=TRUE AND i.status IN ('PENDENTE','CONFIRMADA'))::int AS usados
            FROM eventos e LEFT JOIN inscricoes i ON i.evento_id=e.id WHERE e.id=$1 GROUP BY e.id`,[eventoId]);
        const row=r.rows[0];
        return {usados:row?.usados||0,limite:row?.vagas_transporte??null,disponivel:!row||row.vagas_transporte===null||(row.usados<Number(row.vagas_transporte))};
    },
    async inscrever({usuario,eventoId,usaTransporte=false,cpfCipher=null,cpfHash=null,contatoNome=null,contatoTelefone=null,aceiteDados=false}) {
        const client=await pool.connect();
        try {
            await client.query('BEGIN');
            const evento=await lockedEvent(client,eventoId);
            if(!evento) throw Object.assign(new Error('Evento não encontrado.'),{code:'EVENTO_INEXISTENTE'});
            const elig=await verificarElegibilidade(usuario,evento,{client,verificarVagas:false,cpf:Boolean(cpfHash),cpfJaSalvo:!cpfHash&&Boolean((await client.query('SELECT cpf_hash FROM usuarios WHERE id=$1',[usuario.id])).rows[0]?.cpf_hash),contatoNome,contatoTelefone});
            if(!elig.ok) throw Object.assign(new Error(elig.mensagemPublica),{code:elig.codigo});
            if(evento.exige_cpf && !aceiteDados) throw Object.assign(new Error('Aceite o uso dos dados para continuar.'),{code:'ACEITE_DADOS'});
            if(usaTransporte && !evento.transporte_ofertado) throw Object.assign(new Error('Este evento não oferece transporte.'),{code:'TRANSPORTE'});
            const usadosTrans=(await client.query("SELECT COUNT(*)::int AS n FROM inscricoes WHERE evento_id=$1 AND usa_transporte=TRUE AND status IN ('PENDENTE','CONFIRMADA')",[evento.id])).rows[0].n;
            if(usaTransporte && evento.vagas_transporte !== null && usadosTrans>=Number(evento.vagas_transporte)) throw Object.assign(new Error('As vagas de transporte estão esgotadas.'),{code:'TRANSPORTE_LOTADO'});
            if(evento.transporte_obrigatorio && (!usaTransporte || (evento.vagas_transporte!==null&&usadosTrans>=Number(evento.vagas_transporte)))) throw Object.assign(new Error('O transporte é obrigatório, mas não há vaga disponível.'),{code:'TRANSPORTE_OBRIGATORIO'});
            if(cpfCipher&&cpfHash) await client.query('UPDATE usuarios SET cpf_cifrado=$1,cpf_hash=$2,cpf_consentimento_em=NOW() WHERE id=$3',[cpfCipher,cpfHash,usuario.id]);
            const total=Number(evento.valor_inscricao)+(usaTransporte?Number(evento.valor_transporte):0);
            const ocupadas=Number(evento.vagas_limite)>0?(await client.query("SELECT COUNT(*)::int AS n FROM inscricoes WHERE evento_id=$1 AND status IN ('PENDENTE','CONFIRMADA')",[evento.id])).rows[0].n:0;
            const status=Number(evento.vagas_limite)>0&&ocupadas>=Number(evento.vagas_limite)?'LISTA_ESPERA':'PENDENTE';
            const pagamento=total===0?'ISENTO':'PENDENTE';
            let finalStatus=status;
            if(status==='PENDENTE'&&pagamento==='ISENTO'&&!evento.exige_autorizacao_responsavel) finalStatus='CONFIRMADA';
            const r=await client.query(`INSERT INTO inscricoes(usuario_id,evento_id,status,usa_transporte,valor_total,pagamento_status,contato_emergencia_nome,contato_emergencia_telefone,aceite_dados_em)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $9 THEN NOW() ELSE NULL END)
                ON CONFLICT(usuario_id,evento_id) DO UPDATE SET status=EXCLUDED.status,usa_transporte=EXCLUDED.usa_transporte,valor_total=EXCLUDED.valor_total,
                    pagamento_status=EXCLUDED.pagamento_status,contato_emergencia_nome=EXCLUDED.contato_emergencia_nome,
                    contato_emergencia_telefone=EXCLUDED.contato_emergencia_telefone,aceite_dados_em=EXCLUDED.aceite_dados_em,data_inscricao=NOW(),atualizado_em=NOW()
                WHERE inscricoes.status IN ('CANCELADA','EXPIRADA') RETURNING *`,[usuario.id,evento.id,finalStatus,usaTransporte,total,pagamento,contatoNome,contatoTelefone,aceiteDados]);
            if(!r.rowCount) throw Object.assign(new Error('Você já possui uma inscrição neste evento.'),{code:'JA_INSCRITO'});
            await client.query('COMMIT'); return r.rows[0];
        } catch(e) { await client.query('ROLLBACK'); throw e; }
        finally { client.release(); }
    },
    async cancelar(usuarioId,eventId) {
        const client=await pool.connect();
        try { await client.query('BEGIN'); const evento=await lockedEvent(client,eventId); if(!evento) { await client.query('COMMIT'); return; }
            await client.query("UPDATE inscricoes SET status='CANCELADA',atualizado_em=NOW() WHERE usuario_id=$1 AND evento_id=$2 AND status NOT IN ('CANCELADA','EXPIRADA')",[usuarioId,eventId]);
            await promover(client,evento); await client.query('COMMIT');
        } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    },
    async excluirPorId(id) {
        const r=await pool.query('SELECT evento_id,usuario_id FROM inscricoes WHERE id=$1',[id]); if(!r.rowCount)return;
        await this.cancelar(r.rows[0].usuario_id,r.rows[0].evento_id);
    },
    async expirarVencidas(eventId=null) {
        const ids=eventId?[{id:Number(eventId)}]:(await pool.query("SELECT id FROM eventos WHERE prazo_pagamento < NOW() AND status <> 'CANCELADO'")).rows;
        for(const row of ids) {
            const client=await pool.connect();
            try { await client.query('BEGIN'); const evento=await lockedEvent(client,row.id); if(!evento||!evento.prazo_pagamento||new Date(evento.prazo_pagamento)>=new Date()) { await client.query('COMMIT'); continue; }
                await client.query("UPDATE inscricoes SET status='EXPIRADA',atualizado_em=NOW() WHERE evento_id=$1 AND status='PENDENTE'",[row.id]);
                await promover(client,evento); await client.query('COMMIT');
            } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
        }
    },
    async atualizarPagamento(id,{forma,usuarioId,isencao=false,motivo=null}) {
        const client=await pool.connect();
        try { await client.query('BEGIN'); const found=await client.query('SELECT evento_id,status FROM inscricoes WHERE id=$1',[id]); if(!found.rowCount)throw new Error('Inscrição não encontrada.');
            const evento=await lockedEvent(client,found.rows[0].evento_id);
            const estado=await client.query('SELECT status FROM inscricoes WHERE id=$1 FOR UPDATE',[id]);
            const paid=isencao?'ISENTO':'PAGO';
            if(!['PENDENTE','CONFIRMADA'].includes(estado.rows[0]?.status))throw Object.assign(new Error('Não é possível atualizar pagamento nesta inscrição.'),{status:400});
            await client.query(`UPDATE inscricoes SET pagamento_status=$1,pagamento_forma=$2,pago_em=CASE WHEN $1='PAGO' THEN NOW() ELSE NULL END,
                pagamento_confirmado_por=$3,isencao_motivo=$4,atualizado_em=NOW() WHERE id=$5`,[paid,isencao?null:forma,usuarioId,isencao?motivo:null,id]);
            await recalcular(client,id,evento); await client.query('COMMIT');
        } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
    },
    async confirmarAutorizacao(id,usuarioId) {
        const client=await pool.connect();
        try { await client.query('BEGIN'); const f=await client.query('SELECT evento_id,status FROM inscricoes WHERE id=$1',[id]); if(!f.rowCount)throw new Error('Inscrição não encontrada.');
            const e=await lockedEvent(client,f.rows[0].evento_id); const estado=await client.query('SELECT status FROM inscricoes WHERE id=$1 FOR UPDATE',[id]);
            if(!['PENDENTE','CONFIRMADA'].includes(estado.rows[0]?.status))throw Object.assign(new Error('Não é possível confirmar autorização nesta inscrição.'),{status:400});
            await client.query('UPDATE inscricoes SET autorizacao_recebida=TRUE,autorizacao_confirmada_por=$1,atualizado_em=NOW() WHERE id=$2',[usuarioId,id]); await recalcular(client,id,e); await client.query('COMMIT');
        } catch(x){await client.query('ROLLBACK');throw x;} finally{client.release();}
    },
    async cancelarGestao(id) { return this.excluirPorId(id); },
    async restrictionStatus(userId,eventId) {
        const r=await pool.query(`SELECT EXISTS(SELECT 1 FROM restricoes_inscricao WHERE usuario_id=$1 AND (evento_id IS NULL OR evento_id=$2) AND revogado_em IS NULL AND (vigente_ate IS NULL OR vigente_ate>=CURRENT_DATE)) AS restrito`,[userId,eventId]);return r.rows[0].restrito;
    },
    async cpfCifradoPorInscricao(id) {
        const r=await pool.query('SELECT i.usuario_id,i.evento_id,u.cpf_cifrado FROM inscricoes i JOIN usuarios u ON u.id=i.usuario_id WHERE i.id=$1',[id]);
        return r.rows[0];
    }
};

async function recalcular(client,id,event) {
    const r=await client.query(`SELECT i.*,u.cpf_hash FROM inscricoes i JOIN usuarios u ON u.id=i.usuario_id WHERE i.id=$1 FOR UPDATE`,[id]);
    if(!r.rowCount)return;
    const i=r.rows[0]; if(i.status==='CANCELADA'||i.status==='EXPIRADA'||i.status==='LISTA_ESPERA')return;
    const dadosOk=(!event.exige_cpf||Boolean(i.cpf_hash))&&(!event.exige_contato_emergencia||(i.contato_emergencia_nome&&i.contato_emergencia_telefone));
    const confirmed=['PAGO','ISENTO'].includes(i.pagamento_status)&&(!event.exige_autorizacao_responsavel||i.autorizacao_recebida)&&dadosOk;
    await client.query('UPDATE inscricoes SET status=$1,atualizado_em=NOW() WHERE id=$2',[confirmed?'CONFIRMADA':'PENDENTE',id]);
}

module.exports=InscricaoModel;
