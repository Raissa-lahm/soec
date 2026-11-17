require('dotenv').config();
const pool = require('../src/config/database');
const { parseCodigoTurma } = require('../src/utils/turmas');

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
const aplicar = process.argv.includes('--apply') && !process.argv.includes('--dry-run');

async function main() {
    const [cursosResult, anoResult, alunosResult] = await Promise.all([
        pool.query('SELECT id,numero,nome FROM cursos'),
        pool.query(`SELECT ano FROM anos_letivos ORDER BY (CURRENT_DATE BETWEEN inicio AND fim) DESC,ano DESC LIMIT 1`),
        pool.query("SELECT id,nome,matricula,curso,turma FROM usuarios WHERE perfil='ALUNO' AND turma_id IS NULL ORDER BY nome")
    ]);
    const ano=anoResult.rows[0]?.ano||new Date().getFullYear();
    const turmasResult=await pool.query(`SELECT t.id,t.codigo,t.ano_letivo,t.curso_id,c.nome AS curso_nome
        FROM turmas t JOIN cursos c ON c.id=t.curso_id WHERE t.ativo=TRUE AND t.ano_letivo=$1
        ORDER BY t.ano_letivo DESC`,[ano]);
    const porCurso = new Map(cursosResult.rows.map(c => [normalizar(c.nome), c]));
    const turmaAtual = new Map();
    for (const t of turmasResult.rows) if (!turmaAtual.has(`${t.curso_id}:${normalizar(t.codigo)}`)) turmaAtual.set(`${t.curso_id}:${normalizar(t.codigo)}`, t);
    const mapeados=[], ignorados=[];
    for (const aluno of alunosResult.rows) {
        const curso=porCurso.get(normalizar(aluno.curso));
        const parsed=parseCodigoTurma(aluno.turma);
        const turma=curso && parsed && parsed.cursoNumero===Number(curso.numero)
            ? turmaAtual.get(`${curso.id}:${normalizar(aluno.turma)}`)
            : null;
        if (!curso || !turma) {
            ignorados.push({matricula:aluno.matricula,nome:aluno.nome,curso:aluno.curso,turma:aluno.turma,razao:!curso?'curso não reconhecido':'código de turma ausente ou ambíguo no ano vigente'});
            continue;
        }
        mapeados.push({id:aluno.id,matricula:aluno.matricula,curso:curso.nome,turma:turma.codigo,curso_id:curso.id,turma_id:turma.id});
    }
    console.log(`Modo: ${aplicar?'APLICAR':'DRY-RUN'} (ano letivo ${ano}${process.argv.includes('--dry-run')?' explícito':''})`);
    console.log(`Mapeáveis: ${mapeados.length}; não mapeados: ${ignorados.length}`);
    for (const item of mapeados) console.log(`OK ${item.matricula}: ${item.curso}/${item.turma}`);
    for (const item of ignorados) console.log(`REVISAR ${item.matricula}: curso="${item.curso||''}" turma="${item.turma||''}" (${item.razao})`);
    if (aplicar) {
        const client=await pool.connect();
        try {
            await client.query('BEGIN');
            for(const item of mapeados) await client.query('UPDATE usuarios SET curso_id=$1,turma_id=$2 WHERE id=$3',[item.curso_id,item.turma_id,item.id]);
            await client.query('COMMIT');
            console.log(`Atualizados: ${mapeados.length}`);
        } catch(e) { await client.query('ROLLBACK'); throw e; }
        finally { client.release(); }
    }
}
main().catch(e=>{ console.error(`[migrarCursoTurmaUsuarios] ${e.message}`); process.exitCode=1; }).finally(()=>pool.end());
