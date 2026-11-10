// =========================================================================
// middlewares/permissaoMiddleware.js
// Middleware "fabrica" (factory) que gera um middleware de autorizacao
// permitindo apenas os perfis informados.
//
// Uso nas rotas:
//   router.post('/eventos', autenticado, somentePerfis('COORDENACAO', 'DIRECAO'), controller.criar)
//
// Regra de negocio do projeto:
//   - COORDENACAO e DIRECAO possuem exatamente as mesmas permissoes de gestao
//   - ALUNO e PROFESSOR tem apenas acesso de visualizacao/inscricao
// =========================================================================

function somentePerfis(...perfisPermitidos) {
    return (req, res, next) => {
        const usuario = req.session.usuario;

        if (!usuario) {
            // Se por algum motivo chegou aqui sem sessao, manda pro login
            return res.redirect('/login');
        }

        if (!perfisPermitidos.includes(usuario.perfil)) {
            // Usuario esta logado, mas nao tem permissao para essa acao
            return res.status(403).render('error', {
                titulo: 'Acesso negado',
                mensagem: 'Voce nao tem permissao para acessar esta area do sistema.',
                usuarioLogado: usuario
            });
        }

        return next();
    };
}

// Middleware pronto para as areas de gestao (coordenacao + direcao)
const somenteGestao = somentePerfis('COORDENACAO', 'DIRECAO');

module.exports = { somentePerfis, somenteGestao };
