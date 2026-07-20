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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario') THEN
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
    senha        VARCHAR(255)      NOT NULL, -- hash bcrypt, nunca texto puro
    perfil       perfil_usuario    NOT NULL DEFAULT 'ALUNO',
    curso        VARCHAR(100),
    turma        VARCHAR(50),
    criado_em    TIMESTAMP         NOT NULL DEFAULT NOW()
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
    data_publicacao TIMESTAMP    NOT NULL DEFAULT NOW(),
    criado_por      INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
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

-- =========================================================================
-- DADOS INICIAIS (SEED) - opcional, util para testar o sistema
-- Senha de todos os usuarios abaixo: "123456" (ja em hash bcrypt)
-- Hash gerado com bcrypt, 10 salt rounds, para a senha "123456"
-- =========================================================================
INSERT INTO usuarios (nome, email, matricula, senha, perfil, curso, turma)
VALUES
 ('Admin Direcao', 'direcao@cimol.edu.br', '0001', '$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq', 'DIRECAO', NULL, NULL),
 ('Coordenador Geral', 'coordenacao@cimol.edu.br', '0002', '$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq', 'COORDENACAO', NULL, NULL),
 ('Professor Exemplo', 'professor@cimol.edu.br', '0003', '$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq', 'PROFESSOR', 'Tecnico em Informatica', NULL),
 ('Aluno Exemplo', 'aluno@cimol.edu.br', '2024001', '$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq', 'ALUNO', 'Tecnico em Informatica', '3A')
ON CONFLICT (matricula) DO NOTHING;
