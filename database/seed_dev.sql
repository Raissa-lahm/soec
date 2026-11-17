-- SOMENTE DESENVOLVIMENTO. NUNCA RODAR EM PRODUÇÃO.
-- Contas fictícias para testes locais. Senha destas contas: 123456.
INSERT INTO usuarios (nome,email,matricula,senha,perfil,curso,turma,deve_trocar_senha)
VALUES
 ('Admin Direcao','direcao@cimol.edu.br','0001','$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq','DIRECAO',NULL,NULL,FALSE),
 ('Coordenador Geral','coordenacao@cimol.edu.br','0002','$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq','COORDENACAO',NULL,NULL,FALSE),
 ('Professor Exemplo','professor@cimol.edu.br','0003','$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq','PROFESSOR','Técnico em Informática',NULL,FALSE),
 ('Aluno Exemplo','aluno@cimol.edu.br','2024001','$2b$10$YDJjJ6dMKDPuXIgAwenkFOMSUj3.Xwn2ZDb2gsu/xaje4xPsmONGq','ALUNO','Técnico em Informática','3A',FALSE)
ON CONFLICT (matricula) DO NOTHING;
