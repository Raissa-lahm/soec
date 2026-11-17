const PERFIS = ['ALUNO', 'PROFESSOR', 'COORDENACAO', 'DIRECAO'];
const PODE_CRIAR = {
    DIRECAO: ['ALUNO', 'PROFESSOR', 'COORDENACAO', 'DIRECAO'],
    COORDENACAO: ['ALUNO', 'PROFESSOR'],
    PROFESSOR: [],
    ALUNO: []
};

function podeGerenciar(perfilLogado, perfilAlvo) {
    return Boolean(PODE_CRIAR[perfilLogado]?.includes(perfilAlvo));
}

function perfisGerenciaveis(perfilLogado) {
    return [...(PODE_CRIAR[perfilLogado] || [])];
}

function podeGerenciarCalendario(perfilLogado) {
    return perfilLogado === 'DIRECAO' || perfilLogado === 'COORDENACAO';
}

function podeGerenciarRestricoes(perfilLogado) {
    return perfilLogado === 'DIRECAO';
}

module.exports = { PERFIS, PODE_CRIAR, podeGerenciar, perfisGerenciaveis, podeGerenciarCalendario, podeGerenciarRestricoes };
