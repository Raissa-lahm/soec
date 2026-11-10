# SOEC

Sistema de Organizacao de Eventos do CIMOL.

## Estrutura do projeto

```text
soec/
|-- database/          # Estrutura e scripts do banco de dados
|-- public/            # Arquivos estaticos e uploads servidos pelo Express
|-- src/
|   |-- config/        # Configuracoes de banco de dados e sessao
|   |-- controllers/   # Regras de entrada e resposta das requisicoes
|   |-- middlewares/   # Autenticacao, permissoes, uploads e erros
|   |-- models/        # Acesso e operacoes sobre os dados
|   |-- routes/        # Definicao e encaminhamento das rotas
|   `-- app.js         # Configuracao do Express e montagem da aplicacao
|-- views/             # Templates EJS organizados por funcionalidade
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
