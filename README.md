# SOEC

Sistema de Organização de Eventos do CIMOL, desenvolvido com Node.js, Express, EJS e PostgreSQL.

## Estrutura

- `src/controllers`, `src/models`, `src/routes` e `src/middlewares`: aplicação MVC.
- `views/`: páginas EJS.
- `database/schema.sql`: estrutura inicial para banco vazio/produção.
- `database/migrations/`: atualizações idempotentes para bancos existentes.
- `database/seed_dev.sql`: contas de teste, somente para desenvolvimento.

## Configuração e execução

Configure no `.env` `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ou `DATABASE_URL`) e um `SESSION_SECRET` longo e aleatório. Em produção, o servidor falha ao iniciar se `SESSION_SECRET` não estiver definido. Para bancos com SSL, configure `DB_SSL=true`.

```sh
npm install
npm start
```

## Primeiro acesso por perfil

- **Aluno:** a gestão cria a conta com a matrícula como senha provisória. No primeiro login, o aluno só acessa troca de senha e logout. A senha nova precisa ter ao menos 7 caracteres e ser diferente da matrícula.
- **Professor, Coordenação e Direção:** são criados sem senha e recebem código aleatório de ativação, válido por 48 horas e exibido uma vez à pessoa que cadastrou. O banco guarda somente o hash do código. `/primeiro-acesso` pede matrícula, e-mail, código e senha nova de ao menos 10 caracteres. Após cinco códigos errados, é necessário gerar outro código.
- A redefinição de aluno restaura a senha provisória da matrícula e obriga a troca. A redefinição de equipe invalida a senha e gera outro código. Nos dois casos, as sessões anteriores são encerradas.

Não há autocadastro público. A senha provisória de gestão criada pelo bootstrap é aleatória, aparece uma única vez no terminal e obriga troca no primeiro login.

## Hierarquia de gestão

- **Direção:** cria, edita, redefine acesso e exclui Alunos, Professores e Coordenação; também pode criar outra Direção.
- **Coordenação:** gerencia somente Alunos e Professores.
- **Aluno e Professor:** não acessam a gestão de usuários.

As regras são conferidas no servidor e os formulários mostram somente os perfis que a pessoa logada pode gerenciar. A última Direção ativa não pode ser excluída ou rebaixada. A gestão não pode redefinir nem excluir a própria conta.

## Entrega à escola

1. Crie um banco PostgreSQL vazio e execute `database/schema.sql`.
2. Configure as variáveis de conexão e `SESSION_SECRET` no `.env`.
3. Crie a conta inicial da Direção com `npm run criar-direcao` (ou `npm run criar-direcao -- --nome "Nome" --email email@escola --matricula 123`). Guarde a senha provisória exibida no terminal e entregue-a de forma segura à Direção.
4. A Direção deve trocar a senha no primeiro login.

Para um banco existente, execute em ordem os arquivos de database/migrations/ antes de atualizar a aplicacao. As migracoes podem ser executadas novamente sem duplicar colunas ou tabelas. A migracao 002_primeiro_acesso_seguro.sql configura o primeiro acesso; a 003_fase1_cursos_eventos_calendario.sql atualiza cursos, turmas, calendario e eventos, incluindo eventos.prazo_pagamento, necessaria ao codigo atual. A migracao 002 converte contas ALUNO sem senha para senha da matricula com troca obrigatoria; contas de gestao continuam sem senha e precisam de novo codigo pela tela de gestao.

`database/seed_dev.sql` contém contas fictícias com senha `123456`. **SOMENTE DESENVOLVIMENTO. NUNCA RODAR EM PRODUÇÃO.**

## Proteções e validação

O login e o primeiro acesso limitam tentativas por IP a 10 em 15 minutos; cookies são `httpOnly`, `sameSite=lax` e `secure` em produção; senhas usam bcrypt com 10 salt rounds; os códigos são comparados em tempo constante. A aplicação também envia cabeçalhos de segurança básicos.

Os formulários POST ainda precisam de proteção CSRF por token sincronizado. O rate limit atual é mantido em memória por processo; em implantação com múltiplas instâncias, deve ser substituído por um armazenamento compartilhado.

## Comandos úteis

```sh
npm run dev
npm start
npm run criar-direcao
```

## Cursos, turmas e alunos

O CIMOL possui oito cursos numerados: 1 Eletrônica, 2 Eletrotécnica, 3 Mecânica, 4 Móveis, 5 Design de Móveis, 6 Informática, 7 Meio Ambiente e 8 Química. As turmas cobrem as séries 1 a 3; o código é gerado no formato `[curso][série][-subturma]`, por exemplo `63-2` (Informática, 3ª série, subturma 2) ou `63` (turma única). A gestão administra o ano letivo, turmas e datas em `/admin/gestao-escolar`. O cadastro/importação de alunos exige uma turma ativa do ano vigente; os campos de texto antigos `usuarios.curso` e `usuarios.turma` permanecem preenchidos para compatibilidade.

Para mapear registros antigos, `npm run migrar-curso-turma` somente simula e lista os casos sem correspondência. Revise o relatório e aplique com `npm run migrar-curso-turma -- --apply`. O script só associa códigos inequívocos; revise manualmente os demais em `/admin/alunos-sem-turma`.

## Migrações

- Banco novo: execute `database/schema.sql`, que já inclui a estrutura completa da Fase 1 e não cria usuários de teste. Não é necessário rodar `003` depois dele.
- Banco existente: aplique as migrações pendentes em ordem. A migração `005_horarios_persistentes.sql` armazena PDFs de horários no PostgreSQL para que os uploads sobrevivam a reinícios e novos deploys.
- `database/seed_dev.sql` é exclusivamente para desenvolvimento e só deve ser executado depois do schema.

O teste transacional completo de schema/migração exige um PostgreSQL descartável separado do banco real: defina `SOEC_TEST_DATABASE_URL` e rode `npm run test:migracao`. O script cria schemas dentro de uma transação e termina com `ROLLBACK`.

## Eventos, inscrições e restrições

Eventos podem ser individuais, por equipe ou ambos; rascunho, aberto, encerrado ou cancelado; gratuitos ou pagos; internos ou externos; com transporte, limite de transporte, público por curso/série e dados exigidos. As inscrições congelam o valor no momento do pedido, entram como pendentes ou na lista de espera, e expiram ao vencer o prazo de pagamento. Cancelamento, expiração e promoção da lista de espera usam transação com bloqueio da linha do evento para proteger as vagas. Direção e Coordenação confirmam pagamentos e autorizações; a Direção também vê o indicador de restrição.

Somente a Direção pode criar, consultar e revogar restrições em `/admin/restricoes`. O campo de referência aceita apenas uma anotação curta (por exemplo, “Ata nº 12/2026”); não insira relatos ou dados pessoais. A referência não é registrada na auditoria nem exibida a alunos, professores ou Coordenação. Para o aluno, a causa é sempre apresentada com a mesma mensagem genérica; em convites e inclusão em equipe a mensagem também é genérica.

## CPF e privacidade

Configure `CPF_CRYPTO_KEY` apenas se houver evento que exija CPF. Gere 32 bytes com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, guarde o resultado fora do repositório e mantenha cópias de segurança controladas. Se a chave for perdida ou trocada, CPFs cifrados existentes não poderão ser recuperados. `CPF_HASH_KEY` é opcional e separa a chave de unicidade HMAC da chave de cifra. O CPF é validado, cifrado com AES-256-GCM e indexado por HMAC-SHA256; nunca aparece em log ou auditoria. Nas telas de inscrição aparece mascarado; a revelação explícita por Direção/Coordenação fica registrada como `VER_CPF`.

Política de retenção sugerida: coletar CPF somente quando necessário para o evento, limitar acesso à equipe responsável, remover ou anonimizar o CPF após o fim do evento e do período operacional para prestação de contas/contestação, e revisar os backups segundo a mesma política. A escola deve definir a finalidade, base legal, prazos e atendimento a solicitações dos titulares antes da implantação; a ANPD orienta que se coletem/processam apenas dados necessários ao objetivo [Guia de Segurança da Informação para Agentes de Tratamento de Pequeno Porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf).

## Calendário letivo

Direção e Coordenação cadastram anos, trimestres e datas gerais ou por curso/série em `/admin/gestao-escolar`. `/calendario` mostra uma grade mensal com eventos e datas letivas; também oferece visão de agenda. Ao criar/editar evento em data de feriado, recesso, prova final ou sem aula, ou fora de um ano letivo cadastrado, a aplicação apresenta um aviso e exige confirmação explícita. Datas do tipo PostgreSQL `DATE` são mantidas como `YYYY-MM-DD` no Node para evitar mudança de dia por fuso.

## Testes da Fase 1

```sh
npm test
# Em banco PostgreSQL descartável, nunca apontando para produção:
npm run test:migracao
npm start
```
