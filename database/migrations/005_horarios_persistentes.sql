-- Store uploaded schedule PDFs in PostgreSQL so they survive service restarts.
ALTER TABLE horarios
    ADD COLUMN IF NOT EXISTS arquivo_conteudo BYTEA;
