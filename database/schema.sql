-- =========================================================================
-- SOEC - Sistema de Organizacao de Eventos do CIMOL
-- Script de criacao do banco de dados (PostgreSQL)
--
-- Como usar:
--   1. Crie o banco:  CREATE DATABASE soec_cimol;
--   2. Conecte-se a ele (psql -d soec_cimol OU via pgAdmin > Query Tool)
--   3. Execute este arquivo inteiro
-- =========================================================================

-- Extensao usada para gerar UUID caso deseje trocar os IDs numericos no futuro
-- (nao obrigatoria para este projeto, mas deixamos disponivel)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- ENUM de perfil de usuario
-- Usar ENUM garante que so sejam aceitos os 4 perfis do sistema
-- -------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regtype('perfil_usuario') IS NULL THEN
        CREATE TYPE perfil_usuario AS ENUM ('ALUNO', 'PROFESSOR', 'COORDENACAO', 'DIRECAO');
    END IF;
END$$;

-- -------------------------------------------------------------------------
-- Tabela: usuarios
-- Armazena todos os usuarios do sistema (alunos, professores, coordenacao, direcao)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id           SERIAL PRIMARY KEY,
    nome         VARCHAR(150)      NOT NULL,
    email        VARCHAR(150)      NOT NULL UNIQUE,
    matricula    VARCHAR(30)       NOT NULL UNIQUE,
    senha        VARCHAR(255),              -- hash bcrypt, nunca texto puro. NULL = conta ainda nao ativada (primeiro acesso)
    perfil       perfil_usuario    NOT NULL DEFAULT 'ALUNO',
    curso        VARCHAR(100),
    turma        VARCHAR(50),
    codigo_ativacao_hash VARCHAR(64),       -- hash do codigo de primeiro acesso (nunca o codigo em si)
    codigo_expira_em     TIMESTAMP,         -- validade do codigo
    tentativas_ativacao  INTEGER NOT NULL DEFAULT 0, -- erros de codigo; ao atingir o limite o codigo e bloqueado
    deve_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE,
    senha_alterada_em TIMESTAMP,
    tentativas_login INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMP,
    criado_em    TIMESTAMP         NOT NULL DEFAULT NOW()
);

-- Matrículas que podem criar senha no primeiro acesso. No protótipo contém
-- somente exemplos; depois será ligada ao cadastro oficial da escola.
CREATE TABLE IF NOT EXISTS matriculas_autorizadas (
    matricula VARCHAR(30) PRIMARY KEY,
    nome VARCHAR(150) NOT NULL
);

-- -------------------------------------------------------------------------
-- Tabela: eventos
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
    id            SERIAL PRIMARY KEY,
    titulo        VARCHAR(150)  NOT NULL,
    descricao     TEXT,
    tipo          VARCHAR(60)   NOT NULL, -- ex: ESPORTIVO, CULTURAL, ACADEMICO, PALESTRA...
    data_evento   TIMESTAMP     NOT NULL,
    local         VARCHAR(150),
    vagas_limite  INTEGER       NOT NULL DEFAULT 0, -- 0 = sem limite
    criado_por    INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    criado_em     TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Tabela: comunicados
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunicados (
    id              SERIAL PRIMARY KEY,
    titulo          VARCHAR(150) NOT NULL,
    descricao       TEXT,
    data_evento     DATE,
    prazo_final     DATE,
    data_publicacao TIMESTAMP    NOT NULL DEFAULT NOW(),
    criado_por      INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT ck_comunicados_prazo_final CHECK (data_evento IS NULL OR prazo_final IS NULL OR prazo_final >= data_evento)
);

-- -------------------------------------------------------------------------
-- Tabela: regulamentos
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regulamentos (
    id          SERIAL PRIMARY KEY,
    titulo      VARCHAR(150) NOT NULL,
    descricao   TEXT,
    arquivo_url VARCHAR(255), -- link/caminho para o PDF do regulamento
    criado_por  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    criado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- Tabela: inscricoes
-- Relaciona usuario <-> evento (N:N), com data de inscricao
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscricoes (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento_id      INTEGER   NOT NULL REFERENCES eventos(id)  ON DELETE CASCADE,
    data_inscricao TIMESTAMP NOT NULL DEFAULT NOW(),
    -- um usuario nao pode se inscrever duas vezes no mesmo evento
    CONSTRAINT uq_inscricao_usuario_evento UNIQUE (usuario_id, evento_id)
);

-- -------------------------------------------------------------------------
-- Tabela: equipes
-- Cada equipe pertence a um evento (ex: equipe de futsal do evento X)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipes (
    id         SERIAL PRIMARY KEY,
    nome       VARCHAR(150) NOT NULL,
    modalidade VARCHAR(100),
    evento_id  INTEGER      NOT NULL REFERENCES eventos(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- Tabela: equipe_membros
-- Relaciona equipe <-> usuario (N:N)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipe_membros (
    id         SERIAL PRIMARY KEY,
    equipe_id  INTEGER NOT NULL REFERENCES equipes(id)  ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT uq_equipe_membro UNIQUE (equipe_id, usuario_id)
);

-- -------------------------------------------------------------------------
-- Tabela de sessao (usada pelo connect-pg-simple para guardar sessoes
-- autenticadas diretamente no PostgreSQL, em vez de em memoria)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR NOT NULL COLLATE "default",
    "sess"   JSON     NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- -------------------------------------------------------------------------
-- Indices auxiliares para melhorar performance das consultas mais comuns
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_eventos_data        ON eventos (data_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo         ON eventos (tipo);
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento    ON inscricoes (evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_usuario   ON inscricoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_equipe_membros_eq    ON equipe_membros (equipe_id);

CREATE TABLE IF NOT EXISTS horarios (
  id SERIAL PRIMARY KEY,
  curso VARCHAR(100) UNIQUE NOT NULL,
  arquivo_url VARCHAR(255),
  arquivo_nome_original VARCHAR(255),
  arquivo_conteudo BYTEA,
  atualizado_em TIMESTAMP,
  atualizado_por INTEGER REFERENCES usuarios(id)
);
INSERT INTO horarios (curso) VALUES
  ('Eletrônica'), ('Eletrotécnica'), ('Mecânica'), ('Móveis'),
  ('Design de Móveis'), ('Informática'), ('Meio Ambiente'), ('Química')
ON CONFLICT (curso) DO NOTHING;
CREATE TABLE IF NOT EXISTS log_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    alvo_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(60) NOT NULL,
    detalhe TEXT,
    ip VARCHAR(60),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_criado ON log_auditoria (criado_em);

-- Fase 1: cursos, turmas, eventos avançados e calendário letivo.
-- Cursos, turmas, elegibilidade, inscrições avançadas e calendário letivo.
-- Pode ser aplicada após 002_primeiro_acesso_seguro.sql e executada novamente.

CREATE TABLE IF NOT EXISTS cursos (
    id SERIAL PRIMARY KEY,
    numero SMALLINT NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO cursos (numero, nome) VALUES
    (1, 'Eletrônica'), (2, 'Eletrotécnica'), (3, 'Mecânica'), (4, 'Móveis'),
    (5, 'Design de Móveis'), (6, 'Informática'), (7, 'Meio Ambiente'), (8, 'Química')
ON CONFLICT (numero) DO NOTHING;

CREATE TABLE IF NOT EXISTS anos_letivos (
    ano SMALLINT PRIMARY KEY,
    inicio DATE NOT NULL,
    fim DATE NOT NULL,
    CONSTRAINT ck_anos_letivos_periodo CHECK (fim >= inicio)
);
CREATE TABLE IF NOT EXISTS turmas (
    id SERIAL PRIMARY KEY,
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    serie SMALLINT NOT NULL,
    subturma SMALLINT,
    ano_letivo SMALLINT NOT NULL REFERENCES anos_letivos(ano),
    codigo VARCHAR(5) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_turmas_serie CHECK (serie BETWEEN 1 AND 3),
    CONSTRAINT ck_turmas_subturma CHECK (subturma IS NULL OR subturma BETWEEN 1 AND 9),
    CONSTRAINT ck_turmas_codigo CHECK (codigo ~ '^[1-8][1-3](-[1-9])?$'),
    CONSTRAINT uq_turma UNIQUE (curso_id, serie, subturma, ano_letivo),
    CONSTRAINT uq_turma_codigo UNIQUE (codigo, ano_letivo)
);
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_turmas_ano_curso ON turmas (ano_letivo, curso_id, serie);
-- Garante unicidade também para turma única (subturma NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_turma_normalizada ON turmas (curso_id, serie, COALESCE(subturma,0), ano_letivo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_turma_codigo ON turmas (codigo, ano_letivo);

CREATE TABLE IF NOT EXISTS trimestres (
    id SERIAL PRIMARY KEY,
    ano SMALLINT NOT NULL REFERENCES anos_letivos(ano) ON DELETE CASCADE,
    numero SMALLINT NOT NULL,
    inicio DATE NOT NULL,
    fim DATE NOT NULL,
    CONSTRAINT ck_trimestres_numero CHECK (numero BETWEEN 1 AND 3),
    CONSTRAINT ck_trimestres_periodo CHECK (fim >= inicio),
    CONSTRAINT uq_trimestre_ano_numero UNIQUE (ano, numero)
);
CREATE TABLE IF NOT EXISTS calendario_datas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    sem_aula BOOLEAN NOT NULL DEFAULT FALSE,
    curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL,
    serie SMALLINT,
    descricao TEXT,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT ck_calendario_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio),
    CONSTRAINT ck_calendario_serie CHECK (serie IS NULL OR serie BETWEEN 1 AND 3)
);
CREATE INDEX IF NOT EXISTS idx_calendario_periodo ON calendario_datas (data_inicio, data_fim);

CREATE TABLE IF NOT EXISTS restricoes_inscricao (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE,
    motivo VARCHAR(150) NOT NULL,
    vigente_ate DATE,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    revogado_em TIMESTAMP,
    revogado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_restricoes_inscricao_alvo ON restricoes_inscricao (usuario_id, evento_id, revogado_em, vigente_ate);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_cifrado TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_consentimento_em TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_cpf_hash ON usuarios (cpf_hash) WHERE cpf_hash IS NOT NULL;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS modo_inscricao VARCHAR(10) NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'ABERTO';
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS inscricao_inicio TIMESTAMP;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS inscricao_fim TIMESTAMP;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS valor_inscricao NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS prazo_pagamento TIMESTAMP;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS externo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS endereco VARCHAR(255);
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS ponto_encontro VARCHAR(150);
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS saida_em TIMESTAMP;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS retorno_em TIMESTAMP;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS transporte_ofertado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS transporte_obrigatorio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS valor_transporte NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS vagas_transporte INTEGER;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS exige_cpf BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS exige_contato_emergencia BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS exige_autorizacao_responsavel BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS series_permitidas SMALLINT[];
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_modo_inscricao') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_modo_inscricao CHECK (modo_inscricao IN ('INDIVIDUAL','EQUIPE','AMBOS'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_status') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_status CHECK (status IN ('RASCUNHO','ABERTO','ENCERRADO','CANCELADO'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_inscricao_periodo') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_inscricao_periodo CHECK (inscricao_fim IS NULL OR inscricao_inicio IS NULL OR inscricao_fim >= inscricao_inicio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_valores') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_valores CHECK (valor_inscricao >= 0 AND valor_transporte >= 0 AND (vagas_transporte IS NULL OR vagas_transporte >= 0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_externo_transporte') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_externo_transporte CHECK (NOT transporte_ofertado OR externo);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_transporte_obrigatorio') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_transporte_obrigatorio CHECK (NOT transporte_obrigatorio OR transporte_ofertado);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_vagas_limite') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_vagas_limite CHECK (vagas_limite IS NULL OR vagas_limite >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_saida_retorno') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_saida_retorno CHECK (retorno_em IS NULL OR saida_em IS NULL OR retorno_em >= saida_em);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_eventos_series') THEN
        ALTER TABLE eventos ADD CONSTRAINT ck_eventos_series CHECK (series_permitidas IS NULL OR series_permitidas <@ ARRAY[1,2,3]::SMALLINT[]);
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS evento_cursos (
    evento_id INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    curso_id INTEGER NOT NULL REFERENCES cursos(id),
    PRIMARY KEY (evento_id, curso_id)
);

ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA';
ALTER TABLE inscricoes ALTER COLUMN status SET DEFAULT 'PENDENTE';
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS usa_transporte BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS pagamento_status VARCHAR(10) NOT NULL DEFAULT 'ISENTO';
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS pagamento_forma VARCHAR(20);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS pago_em TIMESTAMP;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS pagamento_confirmado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS comprovante_url VARCHAR(255);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS isencao_motivo VARCHAR(150);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS autorizacao_recebida BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS autorizacao_confirmada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS contato_emergencia_nome VARCHAR(150);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS contato_emergencia_telefone VARCHAR(30);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS aceite_dados_em TIMESTAMP;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS observacao_gestao TEXT;
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP NOT NULL DEFAULT NOW();
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_inscricoes_status') THEN
        ALTER TABLE inscricoes ADD CONSTRAINT ck_inscricoes_status CHECK (status IN ('PENDENTE','CONFIRMADA','LISTA_ESPERA','CANCELADA','EXPIRADA'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_inscricoes_pagamento_status') THEN
        ALTER TABLE inscricoes ADD CONSTRAINT ck_inscricoes_pagamento_status CHECK (pagamento_status IN ('ISENTO','PENDENTE','PAGO'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_inscricoes_pagamento_forma') THEN
        ALTER TABLE inscricoes ADD CONSTRAINT ck_inscricoes_pagamento_forma CHECK (pagamento_forma IS NULL OR pagamento_forma IN ('PIX','DINHEIRO','SECRETARIA','OUTRO'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_inscricoes_valor_total') THEN
        ALTER TABLE inscricoes ADD CONSTRAINT ck_inscricoes_valor_total CHECK (valor_total >= 0);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_inscricoes_evento_status ON inscricoes (evento_id, status, data_inscricao);

-- Reforça a estrutura quando as tabelas já existirem parcialmente.
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS numero SMALLINT;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS nome VARCHAR(100);
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE anos_letivos ADD COLUMN IF NOT EXISTS ano SMALLINT;
ALTER TABLE anos_letivos ADD COLUMN IF NOT EXISTS inicio DATE;
ALTER TABLE anos_letivos ADD COLUMN IF NOT EXISTS fim DATE;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS curso_id INTEGER REFERENCES cursos(id);
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS serie SMALLINT;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS subturma SMALLINT;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS ano_letivo SMALLINT REFERENCES anos_letivos(ano);
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS codigo VARCHAR(5);
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE trimestres ADD COLUMN IF NOT EXISTS ano SMALLINT REFERENCES anos_letivos(ano);
ALTER TABLE trimestres ADD COLUMN IF NOT EXISTS numero SMALLINT;
ALTER TABLE trimestres ADD COLUMN IF NOT EXISTS inicio DATE;
ALTER TABLE trimestres ADD COLUMN IF NOT EXISTS fim DATE;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS titulo VARCHAR(150);
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS tipo VARCHAR(40);
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS data_fim DATE;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS sem_aula BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS serie SMALLINT;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE calendario_datas ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS evento_id INTEGER REFERENCES eventos(id) ON DELETE CASCADE;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS motivo VARCHAR(150);
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS vigente_ate DATE;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS revogado_em TIMESTAMP;
ALTER TABLE restricoes_inscricao ADD COLUMN IF NOT EXISTS revogado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_trimestres_ano ON trimestres(ano,numero);
CREATE INDEX IF NOT EXISTS idx_restricoes_vigentes ON restricoes_inscricao(usuario_id,evento_id,revogado_em,vigente_ate);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_cursos_numero','cursos_numero_check')) THEN
        ALTER TABLE cursos ADD CONSTRAINT ck_cursos_numero CHECK (numero BETWEEN 1 AND 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='cursos'::regclass AND contype='u'
        AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='cursos'::regclass AND attname='numero')]) THEN
        ALTER TABLE cursos ADD CONSTRAINT uq_cursos_numero UNIQUE (numero);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='cursos'::regclass AND contype='u'
        AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='cursos'::regclass AND attname='nome')]) THEN
        ALTER TABLE cursos ADD CONSTRAINT uq_cursos_nome UNIQUE (nome);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_turmas_serie','turmas_serie_check')) THEN
        ALTER TABLE turmas ADD CONSTRAINT ck_turmas_serie CHECK (serie BETWEEN 1 AND 3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_turmas_subturma','turmas_subturma_check')) THEN
        ALTER TABLE turmas ADD CONSTRAINT ck_turmas_subturma CHECK (subturma IS NULL OR subturma BETWEEN 1 AND 9);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_turmas_codigo','turmas_codigo_check')) THEN
        ALTER TABLE turmas ADD CONSTRAINT ck_turmas_codigo CHECK (codigo ~ '^[1-8][1-3](-[1-9])?$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_anos_letivos_periodo') THEN
        ALTER TABLE anos_letivos ADD CONSTRAINT ck_anos_letivos_periodo CHECK (fim >= inicio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_trimestres_numero','trimestres_numero_check')) THEN
        ALTER TABLE trimestres ADD CONSTRAINT ck_trimestres_numero CHECK (numero BETWEEN 1 AND 3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ck_trimestres_periodo','trimestres_check')) THEN
        ALTER TABLE trimestres ADD CONSTRAINT ck_trimestres_periodo CHECK (fim >= inicio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='trimestres'::regclass AND contype='u'
        AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='trimestres'::regclass AND attname='ano'),
                         (SELECT attnum FROM pg_attribute WHERE attrelid='trimestres'::regclass AND attname='numero')]) THEN
        ALTER TABLE trimestres ADD CONSTRAINT uq_trimestre_ano_numero UNIQUE (ano,numero);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_calendario_periodo') THEN
        ALTER TABLE calendario_datas ADD CONSTRAINT ck_calendario_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_calendario_serie') THEN
        ALTER TABLE calendario_datas ADD CONSTRAINT ck_calendario_serie CHECK (serie IS NULL OR serie BETWEEN 1 AND 3);
    END IF;
END $$;
