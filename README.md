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

Para um banco existente, execute `database/migrations/002_primeiro_acesso_seguro.sql` antes de atualizar a aplicação. Pode ser executada novamente sem duplicar colunas ou tabelas. Ela migra contas ALUNO sem senha para senha da matrícula com troca obrigatória; contas de gestão continuam sem senha e precisam de novo código pela tela de gestão.

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
