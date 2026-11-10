// =========================================================================
// middlewares/authMiddleware.js
// Middleware responsavel por proteger rotas que exigem login.
// Ele verifica se existe um usuario guardado na sessao (req.session.usuario).
// Se nao existir, redireciona para a tela de login.
// =========================================================================

module.exports = function autenticado(req, res, next) {
    if (req.session && req.session.usuario) {
        // Deixa o usuario logado disponivel em todas as views automaticamente,
        // assim nao precisamos passar "usuario" manualmente em cada res.render
        res.locals.usuarioLogado = req.session.usuario;
        return next();
    }

    // Guarda a URL que o usuario tentou acessar, para redirecionar de volta
    // apos o login (funcionalidade de "voltar para onde estava")
    req.session.redirectTo = req.originalUrl;
    return res.redirect('/login');
};
