// =========================================================================
// public/js/main.js
// Pequenas interacoes do lado do cliente:
//  - confirmacao antes de excluir registros
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
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
