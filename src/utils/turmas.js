'use strict';

const CODIGO_TURMA = /^([1-8])([1-3])(?:-([1-9]))?$/;

function parseCodigoTurma(codigo) {
    const match = String(codigo || '').trim().match(CODIGO_TURMA);
    if (!match) return null;
    return { cursoNumero: Number(match[1]), serie: Number(match[2]), subturma: match[3] ? Number(match[3]) : null };
}

function gerarCodigoTurma(cursoNumero, serie, subturma = null) {
    const curso = Number(cursoNumero);
    const ano = Number(serie);
    const grupo = subturma === '' || subturma === null || subturma === undefined ? null : Number(subturma);
    if (!Number.isInteger(curso) || curso < 1 || curso > 8 || !Number.isInteger(ano) || ano < 1 || ano > 3 ||
        (grupo !== null && (!Number.isInteger(grupo) || grupo < 1 || grupo > 9))) return null;
    return `${curso}${ano}${grupo === null ? '' : `-${grupo}`}`;
}

module.exports = { parseCodigoTurma, gerarCodigoTurma };
