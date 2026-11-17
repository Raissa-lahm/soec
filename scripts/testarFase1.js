const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const ejs=require('ejs');
const {parseCodigoTurma,gerarCodigoTurma}=require('../src/utils/turmas');
const cpf=require('../src/utils/cpf');

function testarTurmas() {
    for(const codigo of ['63','63-2','11','83-1'])assert.ok(parseCodigoTurma(codigo),`${codigo} deveria ser válido`);
    for(const codigo of ['93','6','63-0','ab','64','11-10'])assert.equal(parseCodigoTurma(codigo),null,`${codigo} deveria ser inválido`);
    assert.deepEqual(parseCodigoTurma('63-2'),{cursoNumero:6,serie:3,subturma:2});
    assert.equal(gerarCodigoTurma(6,3,2),'63-2');
    assert.equal(gerarCodigoTurma(6,3,null),'63');
    assert.equal(gerarCodigoTurma(9,3,null),null);
}
function testarCpf() {
    process.env.CPF_CRYPTO_KEY=Buffer.alloc(32,7).toString('base64');
    assert.equal(cpf.validarCpf('529.982.247-25'),true);
    assert.equal(cpf.validarCpf('111.111.111-11'),false);
    assert.equal(cpf.validarCpf('52998224724'),false);
    assert.equal(cpf.mascarar('52998224725'),'***.982.247-**');
    const cifrado=cpf.cifrar('52998224725');
    assert.notEqual(cifrado,'52998224725');
    assert.equal(cpf.decifrar(cifrado),'52998224725');
    assert.equal(cpf.hash('52998224725').length,64);
}
function testarViews() {
    const raiz=path.join(__dirname,'..','views'),arquivos=[];
    const percorrer=dir=>fs.readdirSync(dir,{withFileTypes:true}).forEach(item=>item.isDirectory()?percorrer(path.join(dir,item.name)):item.name.endsWith('.ejs')&&arquivos.push(path.join(dir,item.name)));
    percorrer(raiz);
    for(const arquivo of arquivos)ejs.compile(fs.readFileSync(arquivo,'utf8'),{filename:arquivo});
    return arquivos.length;
}

try {
    testarTurmas();
    testarCpf();
    const templates=testarViews();
    console.log('OK: 10 verificações de código de turma, validação/cifra de CPF e templates EJS compilados.');
    console.log(`Templates compilados: ${templates}`);
} catch(e) {
    console.error(`Falha: ${e.message}`);
    process.exitCode=1;
}
