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

    // Tela de codigos de ativacao: o botao "Baixar CSV" gera o arquivo no
    // proprio navegador a partir do texto guardado no atributo data-csv
    // (nada e enviado ao servidor e o codigo nao fica salvo em lugar nenhum)
    const botaoCsv = document.getElementById('baixar-codigos');
    if (botaoCsv) {
        botaoCsv.addEventListener('click', (evento) => {
            evento.preventDefault();
            // \uFEFF no inicio faz o Excel abrir o CSV com os acentos corretos
            const arquivo = new Blob(['\uFEFF' + botaoCsv.dataset.csv], { type: 'text/csv;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(arquivo);
            link.download = 'codigos-ativacao-soec.csv';
            link.click();
            URL.revokeObjectURL(link.href);
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