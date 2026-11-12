ALTER TABLE usuarios ALTER COLUMN senha DROP NOT NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_ativacao_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_expira_em TIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_ativacao INTEGER NOT NULL DEFAULT 0;

-- Lista fictícia de matrículas permitidas no protótipo. No futuro, deve ser
-- substituída pela consulta ao cadastro oficial de matrículas da escola.
CREATE TABLE IF NOT EXISTS matriculas_autorizadas (
    matricula VARCHAR(30) PRIMARY KEY,
    nome VARCHAR(150) NOT NULL
);

INSERT INTO matriculas_autorizadas (matricula, nome) VALUES
    ('5000184', 'Raissa de Oliveira Lahm'),
    ('6735227', 'Sofia Rodrigues Santos'),
    ('6704944', 'Rafael Bazotti'),
    ('5081504', 'Nicolas Cavallari')
ON CONFLICT (matricula) DO NOTHING;

INSERT INTO usuarios (nome, email, matricula, senha, perfil)
VALUES
    ('Raissa de Oliveira Lahm', 'raissa.lahm@example.invalid', '5000184', NULL, 'ALUNO'),
    ('Sofia Rodrigues Santos', 'sofia.santos@example.invalid', '6735227', NULL, 'ALUNO'),
    ('Rafael Bazotti', 'rafael.bazotti@example.invalid', '6704944', NULL, 'ALUNO'),
    ('Nicolas Cavallari', 'nicolas.cavallari@example.invalid', '5081504', NULL, 'ALUNO')
ON CONFLICT (matricula) DO NOTHING;
