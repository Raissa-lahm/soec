// =========================================================================
// middlewares/errorMiddleware.js
// Middleware global de tratamento de erros do Express.
// Deve ser o ULTIMO middleware registrado em app.js (depois de todas as
// rotas), pois o Express so chama middlewares com 4 parametros (err, req,
// res, next) quando algo da errado (erro lancado ou passado por next(err)).
// =========================================================================

module.exports = function errorHandler(err, req, res, next) {
    console.error('[SOEC] Erro capturado:', err);

    const status = err.status || 500;

    res.status(status).render('error', {
        titulo: status === 404 ? 'Pagina nao encontrada' : 'Erro no sistema',
        mensagem: status === 404
            ? 'A pagina que voce tentou acessar nao existe.'
            : 'Ocorreu um erro inesperado. Tente novamente em instantes.',
        usuarioLogado: (req.session && req.session.usuario) || null
    });
};

// Middleware auxiliar para capturar rotas nao encontradas (404)
// Deve ser registrado depois de todas as rotas e antes do errorHandler
module.exports.naoEncontrado = function naoEncontrado(req, res, next) {
    const erro = new Error('Rota nao encontrada');
    erro.status = 404;
    next(erro);
};
