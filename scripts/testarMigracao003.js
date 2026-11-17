const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {Pool}=require('pg');

const usarBancoConfigurado=process.argv.includes('--usar-banco-configurado-com-rollback');
if(usarBancoConfigurado)require('dotenv').config({path:path.join(__dirname,'..','.env')});
const connectionString=process.env.SOEC_TEST_DATABASE_URL;
if(!connectionString&&!usarBancoConfigurado) {
    console.error('Defina SOEC_TEST_DATABASE_URL para banco PostgreSQL descartável ou use --usar-banco-configurado-com-rollback para executar somente em schemas temporários com ROLLBACK.');
    process.exit(2);
}
const pool=new Pool({
    connectionString:connectionString||process.env.DATABASE_URL||undefined,
    host:connectionString||process.env.DATABASE_URL?undefined:process.env.DB_HOST,
    port:connectionString||process.env.DATABASE_URL?undefined:process.env.DB_PORT,
    user:connectionString||process.env.DATABASE_URL?undefined:process.env.DB_USER,
    password:connectionString||process.env.DATABASE_URL?undefined:process.env.DB_PASSWORD,
    database:connectionString||process.env.DATABASE_URL?undefined:process.env.DB_NAME,
    ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:undefined
});
const raiz=path.join(__dirname,'..');
const migra=fs.readFileSync(path.join(raiz,'database/migrations/003_fase1_cursos_eventos_calendario.sql'),'utf8');
const schema=fs.readFileSync(path.join(raiz,'database/schema.sql'),'utf8');
const base=`CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE perfil_usuario AS ENUM ('ALUNO','PROFESSOR','COORDENACAO','DIRECAO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE usuarios(id SERIAL PRIMARY KEY,nome VARCHAR(150) NOT NULL,email VARCHAR(150) NOT NULL UNIQUE,matricula VARCHAR(30) NOT NULL UNIQUE,senha VARCHAR(255),perfil perfil_usuario NOT NULL DEFAULT 'ALUNO',curso VARCHAR(100),turma VARCHAR(50),criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE eventos(id SERIAL PRIMARY KEY,titulo VARCHAR(150) NOT NULL,descricao TEXT,tipo VARCHAR(60) NOT NULL,data_evento TIMESTAMP NOT NULL,local VARCHAR(150),vagas_limite INTEGER NOT NULL DEFAULT 0,criado_por INTEGER NOT NULL REFERENCES usuarios(id),criado_em TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE inscricoes(id SERIAL PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuarios(id),evento_id INTEGER NOT NULL REFERENCES eventos(id),data_inscricao TIMESTAMP NOT NULL DEFAULT NOW(),CONSTRAINT uq_inscricao_usuario_evento UNIQUE(usuario_id,evento_id));`;
const existentes=`CREATE TABLE cursos(id SERIAL PRIMARY KEY,numero SMALLINT NOT NULL UNIQUE,nome VARCHAR(100) NOT NULL UNIQUE,ativo BOOLEAN NOT NULL DEFAULT TRUE);
INSERT INTO cursos(numero,nome) VALUES(1,'Eletrônica');
CREATE TABLE anos_letivos(ano SMALLINT PRIMARY KEY,inicio DATE NOT NULL,fim DATE NOT NULL);
CREATE TABLE turmas(id SERIAL PRIMARY KEY,curso_id INTEGER NOT NULL REFERENCES cursos(id),serie SMALLINT NOT NULL,subturma SMALLINT,ano_letivo SMALLINT NOT NULL REFERENCES anos_letivos(ano),codigo VARCHAR(5) NOT NULL CHECK(codigo ~ '^[1-8][1-3](-[1-9])?$'),CONSTRAINT uq_turma UNIQUE(curso_id,serie,subturma,ano_letivo),CONSTRAINT uq_turma_codigo UNIQUE(codigo,ano_letivo));
CREATE TABLE trimestres(id SERIAL PRIMARY KEY,ano SMALLINT NOT NULL REFERENCES anos_letivos(ano),numero SMALLINT NOT NULL,inicio DATE NOT NULL,fim DATE NOT NULL);
CREATE TABLE calendario_datas(id SERIAL PRIMARY KEY,titulo VARCHAR(150) NOT NULL,tipo VARCHAR(40) NOT NULL,data_inicio DATE NOT NULL,data_fim DATE,sem_aula BOOLEAN NOT NULL DEFAULT FALSE,curso_id INTEGER REFERENCES cursos(id),serie SMALLINT,descricao TEXT,criado_por INTEGER REFERENCES usuarios(id));
CREATE TABLE restricoes_inscricao(id SERIAL PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuarios(id),evento_id INTEGER REFERENCES eventos(id),motivo VARCHAR(150) NOT NULL,vigente_ate DATE,criado_por INTEGER REFERENCES usuarios(id),criado_em TIMESTAMP NOT NULL DEFAULT NOW(),revogado_em TIMESTAMP,revogado_por INTEGER REFERENCES usuarios(id));
ALTER TABLE usuarios ADD COLUMN curso_id INTEGER REFERENCES cursos(id);
ALTER TABLE usuarios ADD COLUMN turma_id INTEGER REFERENCES turmas(id);`;

async function run() {
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        const schemaBase=`soec_mig_${crypto.randomBytes(5).toString('hex')}`;
        await client.query(`CREATE SCHEMA ${schemaBase}`);
        await client.query(`SET LOCAL search_path TO ${schemaBase},public`);
        await client.query(base);
        await client.query(migra);
        await client.query(migra);
        const cols=await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1`,[schemaBase]);
        const found=new Set(cols.rows.map(c=>`${c.table_name}.${c.column_name}`));
        for(const col of ['turmas.codigo','usuarios.turma_id','eventos.status','eventos.valor_inscricao','inscricoes.status','inscricoes.pagamento_status','calendario_datas.data_inicio','restricoes_inscricao.motivo'])
            if(!found.has(col))throw new Error(`Coluna esperada não encontrada: ${col}`);

        const schemaExistente=`soec_existente_${crypto.randomBytes(5).toString('hex')}`;
        await client.query(`CREATE SCHEMA ${schemaExistente}`);
        await client.query(`SET LOCAL search_path TO ${schemaExistente},public`);
        await client.query(base);
        await client.query(existentes);
        await client.query(migra);
        await client.query(migra);
        const turmaAtivo=await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name='turmas' AND column_name='ativo'",[schemaExistente]);
        if(!turmaAtivo.rowCount)throw new Error('Migração não completou a tabela de turmas preexistente.');

        const schemaFresh=`soec_fresh_${crypto.randomBytes(5).toString('hex')}`;
        await client.query(`CREATE SCHEMA ${schemaFresh}`);
        await client.query(`SET LOCAL search_path TO ${schemaFresh},public`);
        await client.query(schema);
        await client.query(migra);
        await client.query(migra);
        const cursos=await client.query('SELECT numero,nome FROM cursos ORDER BY numero');
        if(cursos.rowCount!==8)throw new Error(`Esperados 8 cursos, encontrados ${cursos.rowCount}`);
        await client.query('ROLLBACK');
        console.log('OK: migração 003 aplicada duas vezes após base existente; schema novo completo e reexecução sem erro. Tudo foi revertido por ROLLBACK.');
    } catch(e) {
        await client.query('ROLLBACK').catch(()=>{});
        throw e;
    } finally { client.release(); await pool.end(); }
}
run().catch(e=>{console.error(`Falha no teste de migração: ${e.message}`);process.exitCode=1;});
