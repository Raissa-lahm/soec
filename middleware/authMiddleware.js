// =====================================================================
// SOEC - Middlewares de Autenticação e Autorização
// Salvar em: /middlewares/auth.js
//
// Middlewares são funções que rodam ANTES do controller, interceptando
// a requisição para validar login e permissões. Se a validação falhar,
// a requisição é redirecionada e o controller nunca chega a ser executado.
// =====================================================================

// Garante que o usuário está logado (possui sessão ativa).
// Usado em todas as rotas que exigem login.
function isAuthenticated(req, res, next) {
  if (req.session && req.session.usuario) {
    return next(); // usuário logado, segue para o controller
  }
  return res.redirect('/login');
}

// Garante que o usuário logado tem um dos perfis permitidos.
// Uso: hasRole('COORDENACAO', 'DIRECAO')
// Deve ser usado SEMPRE depois de isAuthenticated na cadeia de middlewares.
function hasRole(...perfisPermitidos) {
  return (req, res, next) => {
    const usuario = req.session.usuario;

    if (!usuario) {
      return res.redirect('/login');
    }

    if (!perfisPermitidos.includes(usuario.perfil)) {
      // Usuário logado, mas sem permissão para este recurso
      return res.status(403).render('erro', {
        titulo: 'Acesso negado',
        mensagem: 'Você não tem permissão para acessar esta página.',
        usuario
      });
    }

    return next();
  };
}

// Middleware "global" que injeta o usuário logado (ou null) em todas as views,
// para que header.ejs, por exemplo, saiba mostrar nome/perfil sem repetir código
// em cada controller.
function injetarUsuarioNasViews(req, res, next) {
  res.locals.usuarioLogado = req.session.usuario || null;
  next();
}

module.exports = { isAuthenticated, hasRole, injetarUsuarioNasViews };