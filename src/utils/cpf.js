'use strict';
const crypto = require('crypto');

function validarCpf(cpf) {
    const digits = String(cpf || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
    const calcula = (slice, peso) => {
        const soma = slice.split('').reduce((total, n, i) => total + Number(n) * (peso - i), 0);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return calcula(digits.slice(0, 9), 10) === Number(digits[9]) && calcula(digits.slice(0, 10), 11) === Number(digits[10]);
}

function chave() {
    const raw = process.env.CPF_CRYPTO_KEY || '';
    let bytes;
    try { bytes = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64'); } catch (_) { bytes = Buffer.alloc(0); }
    if (bytes.length !== 32) throw new Error('CPF_CRYPTO_KEY precisa conter exatamente 32 bytes (base64 ou 64 caracteres hex).');
    return bytes;
}
function validarConfiguracao() { chave(); return true; }
function cifrar(cpf) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
    const dados = Buffer.concat([cipher.update(String(cpf).replace(/\D/g, ''), 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${dados.toString('base64')}`;
}
function decifrar(valor) {
    const [iv, tag, dados] = String(valor || '').split('.').map(v => Buffer.from(v, 'base64'));
    if (!iv || !tag || !dados) throw new Error('CPF cifrado inválido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(dados), decipher.final()]).toString('utf8');
}
function hash(cpf) {
    const segredo = process.env.CPF_HASH_KEY || process.env.CPF_CRYPTO_KEY || '';
    if (!segredo) throw new Error('Defina CPF_HASH_KEY ou CPF_CRYPTO_KEY para proteger a unicidade de CPF.');
    return crypto.createHmac('sha256', segredo).update(String(cpf).replace(/\D/g, '')).digest('hex');
}
function mascarar(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '';
}

module.exports = { validarCpf, mascarar, cifrar, decifrar, hash, validarConfiguracao };
