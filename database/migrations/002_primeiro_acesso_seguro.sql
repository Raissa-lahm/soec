-- Migração idempotente para o fluxo de primeiro acesso seguro.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_alterada_em TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_ativacao_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_expira_em TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_ativacao INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ALTER COLUMN senha DROP NOT NULL;

UPDATE usuarios
   SET senha = crypt(matricula, gen_salt('bf', 10)),
       deve_trocar_senha = TRUE,
       codigo_ativacao_hash = NULL,
       codigo_expira_em = NULL,
       tentativas_ativacao = 0
 WHERE senha IS NULL AND perfil = 'ALUNO';

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
