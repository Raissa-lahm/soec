// =========================================================================
// public/js/main.js
// Pequenas interacoes do lado do cliente:
//  - confirmacao antes de excluir registros
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const botaoMenu = document.querySelector('.menu-mobile-toggle');
    const menu = document.querySelector('#nav-principal');

    if (botaoMenu && menu) {
        botaoMenu.addEventListener('click', () => {
            const aberto = botaoMenu.getAttribute('aria-expanded') === 'true';
            botaoMenu.setAttribute('aria-expanded', String(!aberto));
            botaoMenu.setAttribute('aria-label', aberto ? 'Abrir menu' : 'Fechar menu');
            menu.classList.toggle('menu-aberto', !aberto);
        });
    }

    // Qualquer formulario com a classe "form-confirmar-exclusao" pede
    // confirmacao antes de enviar (usado nos botoes de excluir do sistema)
    document.querySelectorAll('.form-confirmar-exclusao').forEach((form) => {
        form.addEventListener('submit', (evento) => {
            const mensagem = form.dataset.mensagem || 'Tem certeza que deseja excluir este item?';
            if (!confirm(mensagem)) {
                evento.preventDefault();
            }
        });
    });
});
