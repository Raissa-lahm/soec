# SOEC

Sistema de Organizacao de Eventos do CIMOL.

## Estrutura do projeto

```text
soec/
|-- database/          # Estrutura e scripts do banco de dados
|   |-- migracao_primeiro_acesso.sql # Suporte ao primeiro acesso e codigos de ativacao
|   |-- schema.sql       # Estrutura principal do banco de dados
|-- public/            # Arquivos estaticos e uploads servidos pelo Express
|-- src/
|   |-- config/        # Configuracoes de banco de dados e sessao
|   |-- controllers/   # Regras de entrada e resposta das requisicoes
|   |-- middlewares/   # Autenticacao, permissoes, uploads e erros
|   |-- models/        # Acesso e operacoes sobre os dados
|   |-- routes/        # Definicao e encaminhamento das rotas
|   |-- utils/         # Funcoes auxiliares, como geracao de codigos de ativacao
|   `-- app.js         # Configuracao do Express e montagem da aplicacao
|-- views/             # Templates EJS organizados por funcionalidade
|   |-- admin/         # Telas administrativas, importacao e codigos gerados
|   |-- cadastro.ejs   # Formulario de cadastro publico
|   |-- primeiroAcesso.ejs # Ativacao da conta e criacao de senha
|-- app.js             # Compatibilidade para quem importa a aplicacao pela raiz
`-- server.js          # Inicializacao do servidor HTTP
```

O codigo da aplicacao fica em `src/`, separado por responsabilidade. As views,
arquivos publicos e scripts do banco permanecem fora de `src/` porque sao
recursos consumidos ou servidos diretamente pela aplicacao. `server.js` inicia
o servidor; `src/app.js` configura e exporta a aplicacao Express.

## Executar

```sh
npm start
```

Para desenvolvimento com reinicializacao automatica:

```sh
npm run dev
```
