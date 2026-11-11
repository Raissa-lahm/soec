// =========================================================================
// utils/ativacao.js
// Funcoes de apoio ao PRIMEIRO ACESSO: gerar o codigo de ativacao, guardar
// so o hash dele no banco e conferir o codigo digitado pelo usuario.
//
// Por que um codigo? A matricula sozinha nao prova quem a pessoa e (um
// colega poderia digitar a matricula de outro). A escola entrega o codigo
// de forma individual, e so quem tem o codigo consegue criar a senha.
// =========================================================================

const crypto = require('crypto');

// Sem 0/O e 1/I para ninguem confundir letras com numeros ao digitar
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_CODIGO = 8;

// Quantos dias o codigo vale e quantos erros sao tolerados antes de bloquear
const VALIDADE_DIAS = 30;
const MAX_TENTATIVAS = 5;

// Gera um codigo aleatorio seguro (crypto.randomInt, nao Math.random)
function gerarCodigo() {
    let codigo = '';
    for (let i = 0; i < TAMANHO_CODIGO; i++) {
        codigo += ALFABETO[crypto.randomInt(ALFABETO.length)];
    }
    return codigo;
}

// Deixa o codigo legivel para imprimir: ABCD-EFGH
function formatarCodigo(codigo) {
    return codigo.slice(0, 4) + '-' + codigo.slice(4);
}

// Aceita minusculas, espacos e hifen na digitacao
function normalizarCodigo(codigo) {
    return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Hash SHA-256 com a matricula como "sal". Como o codigo e aleatorio e o
// numero de tentativas e limitado, nao precisa de bcrypt (que seria lento
// para gerar centenas de codigos de uma vez na importacao).
function hashCodigo(codigo, matricula) {
    return crypto
        .createHash('sha256')
        .update(`${matricula}:${normalizarCodigo(codigo)}`)
        .digest('hex');
}

// Comparacao em tempo constante (evita ataque de temporizacao)
function conferirCodigo(codigo, matricula, hashSalvo) {
    if (!hashSalvo) return false;
    const a = Buffer.from(hashCodigo(codigo, matricula));
    const b = Buffer.from(hashSalvo);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
    VALIDADE_DIAS,
    MAX_TENTATIVAS,
    gerarCodigo,
    formatarCodigo,
    normalizarCodigo,
    hashCodigo,
    conferirCodigo
};