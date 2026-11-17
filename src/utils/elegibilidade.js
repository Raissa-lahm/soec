'use strict';
const pool = require('../config/database');

const MENSAGEM_RESTRICAO = 'Você não está habilitado a se inscrever neste evento. Procure a Direção.';

async function verificarElegibilidade(usuario, evento, opcoes = {}) {
    const db = opcoes.client || pool;
    const agora = opcoes.agora || new Date();
    if (!evento || evento.status !== 'ABERTO') return { ok: false, codigo: 'EVENTO_FECHADO', mensagemPublica: 'As inscrições para este evento não estão abertas.' };
    if (evento.inscricao_inicio && new Date(evento.inscricao_inicio) > agora) return { ok: false, codigo: 'FORA_DA_JANELA', mensagemPublica: 'As inscrições ainda não começaram.' };
    if (evento.inscricao_fim && new Date(evento.inscricao_fim) < agora) return { ok: false, codigo: 'FORA_DA_JANELA', mensagemPublica: 'O prazo de inscrição terminou.' };

    let turma = null;
    if (usuario?.perfil === 'ALUNO') {
        const r = await db.query(`SELECT t.curso_id,t.serie FROM usuarios u
            LEFT JOIN LATERAL (SELECT ano FROM anos_letivos ORDER BY (CURRENT_DATE BETWEEN inicio AND fim) DESC,ano DESC LIMIT 1) vig ON TRUE
            LEFT JOIN turmas t ON t.id=u.turma_id AND t.ano_letivo=vig.ano WHERE u.id=$1`, [usuario.id]);
        turma = r.rows[0];
        const cursos = await db.query('SELECT curso_id FROM evento_cursos WHERE evento_id=$1', [evento.id]);
        const permitidos = cursos.rows.map(row => Number(row.curso_id));
        const serieOk = !evento.series_permitidas || evento.series_permitidas.length === 0 ||
            (turma && evento.series_permitidas.map(Number).includes(Number(turma.serie)));
        const cursoOk = permitidos.length === 0 || (turma && permitidos.includes(Number(turma.curso_id)));
        if (!cursoOk || !serieOk) {
            const nomesCursos = await db.query('SELECT nome FROM cursos WHERE id=ANY($1::int[]) ORDER BY numero', [permitidos]);
            const publico = [...nomesCursos.rows.map(x => x.nome), ...(evento.series_permitidas || []).map(s => `${s}ª série`)].join(' / ');
            return { ok: false, codigo: 'PUBLICO_ALVO', mensagemPublica: `Evento exclusivo para: ${publico || 'alunos elegíveis'}.` };
        }
        const restricao = await db.query(`SELECT 1 FROM restricoes_inscricao WHERE usuario_id=$1 AND (evento_id IS NULL OR evento_id=$2)
            AND revogado_em IS NULL AND (vigente_ate IS NULL OR vigente_ate >= CURRENT_DATE) LIMIT 1`, [usuario.id, evento.id]);
        if (restricao.rowCount) return { ok: false, codigo: 'RESTRICAO', mensagemPublica: MENSAGEM_RESTRICAO };
    }

    if (opcoes.verificarInscricao !== false) {
        const inscricao = await db.query(`SELECT 1 FROM inscricoes WHERE usuario_id=$1 AND evento_id=$2
            AND status NOT IN ('CANCELADA','EXPIRADA') LIMIT 1`, [usuario.id, evento.id]);
        if (inscricao.rowCount) return { ok: false, codigo: 'JA_INSCRITO', mensagemPublica: 'Você já possui uma inscrição neste evento.' };
    }
    if (opcoes.verificarVagas !== false && Number(evento.vagas_limite) > 0) {
        const vagas = await db.query(`SELECT COUNT(*)::int AS total FROM inscricoes WHERE evento_id=$1 AND status IN ('PENDENTE','CONFIRMADA')`, [evento.id]);
        if (vagas.rows[0].total >= Number(evento.vagas_limite)) return { ok: false, codigo: 'VAGAS', mensagemPublica: 'As vagas estão esgotadas. Você pode entrar na lista de espera.' };
    }
    if (opcoes.validarDados !== false && evento.exige_cpf && !opcoes.cpf && !opcoes.cpfJaSalvo) return { ok: false, codigo: 'CPF', mensagemPublica: 'Informe um CPF válido para continuar.' };
    if (opcoes.validarDados !== false && evento.exige_contato_emergencia && (!opcoes.contatoNome || !opcoes.contatoTelefone)) return { ok: false, codigo: 'CONTATO_EMERGENCIA', mensagemPublica: 'Informe os dados do contato de emergência.' };
    if (evento.exige_autorizacao_responsavel && opcoes.autorizacaoRecebida !== true) {
        // Este campo é fornecido/confirmado pela gestão; no cadastro do aluno, não é bloqueante.
    }
    return { ok: true, codigo: 'OK', mensagemPublica: '' , turma };
}

module.exports = { verificarElegibilidade, MENSAGEM_RESTRICAO };
