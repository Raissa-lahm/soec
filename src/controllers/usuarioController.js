const bcrypt = require('bcrypt');
const UsuarioModel = require('../models/usuarioModel');
const AuditoriaModel = require('../models/auditoriaModel');
const { podeGerenciar, perfisGerenciaveis } = require('../utils/permissoes');
const { VALIDADE_HORAS, gerarCodigo, formatarCodigo, hashCodigo } = require('../utils/ativacao');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

function semAcento(texto) { return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function lerPlanilha(texto) {
    const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!linhas.length) return [];
    const sep = [';', '\t', ','].reduce((a,b) => linhas[0].split(b).length > linhas[0].split(a).length ? b : a);
    return linhas.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '').trim()));
}
function montarCsvCodigos(items) {
    const cell = v => `"${String(v || '').replace(/"/g, '""')}"`;
    return ['Nome;Matricula;Codigo de ativacao', ...items.map(c => [c.nome,c.matricula,c.codigo].map(cell).join(';'))].join('\r\n');
}
function renderCodigos(res, titulo, criados, ignorados = [], quantidadeCriados = criados.length) {
    return res.render('admin/codigosGerados', { titulo, criados, ignorados, csv: montarCsvCodigos(criados), quantidadeCriados });
}

const UsuarioController = {
    async dashboard(req,res,next) {
        try {
            const u = await UsuarioModel.listarTodos();
            res.render('admin/dashboard', { totais: { alunos:u.filter(x=>x.perfil==='ALUNO').length, professores:u.filter(x=>x.perfil==='PROFESSOR').length, coordenacao:u.filter(x=>x.perfil==='COORDENACAO').length, direcao:u.filter(x=>x.perfil==='DIRECAO').length } });
        } catch(e) { next(e); }
    },
    async listar(req,res,next) {
        try {
            const todos = await UsuarioModel.listarTodos();
            const visiveis = todos.filter(u => podeGerenciar(req.session.usuario.perfil, u.perfil));
            const perfil = String(req.query.perfil || '');
            res.render('admin/usuarios', { usuarios: perfil ? visiveis.filter(u=>u.perfil===perfil) : visiveis, filtroPerfil: perfil, perfis: perfisGerenciaveis(req.session.usuario.perfil), perfilLogado: req.session.usuario.perfil });
        } catch(e) { next(e); }
    },
    exibirFormCriar(req,res) {
        res.render('admin/usuarioForm', { usuario:null, acao:'/admin/usuarios', perfis:perfisGerenciaveis(req.session.usuario.perfil) });
    },
    async exibirFormEditar(req,res,next) {
        try {
            const usuario = await UsuarioModel.buscarPorId(req.params.id);
            if (!usuario || !podeGerenciar(req.session.usuario.perfil, usuario.perfil)) return res.sendStatus(403);
            res.render('admin/usuarioForm', { usuario, acao:`/admin/usuarios/${usuario.id}?_method=PUT`, perfis:perfisGerenciaveis(req.session.usuario.perfil) });
        } catch(e) { next(e); }
    },
    async criar(req,res,next) {
        try {
            const nome=String(req.body.nome||'').trim(), email=String(req.body.email||'').trim().toLowerCase(), matricula=String(req.body.matricula||'').trim();
            const perfil=String(req.body.perfil||'').toUpperCase(), curso=String(req.body.curso||'').trim(), turma=String(req.body.turma||'').trim();
            const perfis=perfisGerenciaveis(req.session.usuario.perfil);
            const renderErro = (erro) => res.status(400).render('admin/usuarioForm',{ usuario:req.body, acao:'/admin/usuarios', perfis, erro });
            if (!nome || !email || !matricula || !perfis.includes(perfil)) return renderErro('Dados obrigatórios inválidos ou perfil não permitido.');
            if (!EMAIL_REGEX.test(email)) return renderErro('E-mail inválido.');
            if (await UsuarioModel.buscarPorEmail(email) || await UsuarioModel.buscarPorMatricula(matricula)) return renderErro('Já existe usuário com este e-mail ou matrícula.');
            if (perfil === 'ALUNO') {
                await UsuarioModel.criar({ nome,email,matricula,senhaHash:await bcrypt.hash(matricula,SALT_ROUNDS),perfil,curso,turma,deveTrocarSenha:true });
                await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, acao:'CRIAR_USUARIO', detalhe:`Perfil ${perfil}`, ip:req.ip });
                return res.redirect('/admin/usuarios');
            }
            const codigo=gerarCodigo();
            await UsuarioModel.criarPendente({ nome,email,matricula,perfil,curso,turma,codigoHash:hashCodigo(codigo,matricula),validadeHoras:VALIDADE_HORAS });
            await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, acao:'CRIAR_USUARIO', detalhe:`Perfil ${perfil}`, ip:req.ip });
            return renderCodigos(res,'Código de primeiro acesso', [{nome,matricula,codigo:formatarCodigo(codigo)}]);
        } catch(e) { next(e); }
    },
    async atualizar(req,res,next) {
        try {
            const existente=await UsuarioModel.buscarPorId(req.params.id);
            if (!existente || !podeGerenciar(req.session.usuario.perfil,existente.perfil)) return res.sendStatus(403);
            const perfil=String(req.body.perfil||'').toUpperCase();
            const perfis=perfisGerenciaveis(req.session.usuario.perfil);
            if (!perfis.includes(perfil)) return res.status(403).send('Perfil não permitido.');
            if (existente.perfil==='DIRECAO' && perfil!=='DIRECAO' && await UsuarioModel.contarDirecoesAtivas() <= 1) return res.status(400).send('Não é possível rebaixar a última Direção ativa.');
            await UsuarioModel.atualizar(req.params.id,{nome:String(req.body.nome||'').trim(),email:String(req.body.email||'').trim().toLowerCase(),matricula:String(req.body.matricula||'').trim(),perfil,curso:req.body.curso,turma:req.body.turma});
            await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, alvoId:Number(req.params.id), acao:'EDITAR_USUARIO', detalhe:`Perfil ${perfil}`, ip:req.ip });
            if (existente.perfil !== perfil && perfil === 'ALUNO') {
                await UsuarioModel.redefinirAluno(req.params.id, await bcrypt.hash(String(req.body.matricula).trim(), SALT_ROUNDS));
                await UsuarioModel.encerrarSessoes(req.params.id);
            } else if (existente.perfil !== perfil && perfil !== 'ALUNO') {
                const codigo = gerarCodigo();
                await UsuarioModel.redefinirParaPrimeiroAcesso(req.params.id, hashCodigo(codigo, String(req.body.matricula).trim()), VALIDADE_HORAS);
                await UsuarioModel.encerrarSessoes(req.params.id);
                return renderCodigos(res, 'Código de primeiro acesso', [{nome:String(req.body.nome).trim(),matricula:String(req.body.matricula).trim(),codigo:formatarCodigo(codigo)}]);
            } else if (existente.perfil !== perfil) {
                await UsuarioModel.encerrarSessoes(req.params.id);
            }
            return res.redirect('/admin/usuarios');
        } catch(e) { next(e); }
    },
    exibirImportacao(req,res) { res.render('admin/importarUsuarios',{erro:null,perfis:perfisGerenciaveis(req.session.usuario.perfil)}); },
    async importar(req,res,next) {
        try {
            let texto=req.body.dados||'';
            if(req.file) { texto=req.file.buffer.toString('utf8'); if(texto.includes('\uFFFD')) texto=req.file.buffer.toString('latin1'); }
            let linhas=lerPlanilha(texto);
            if(linhas.length && semAcento(linhas[0][0]).toLowerCase()==='nome') linhas=linhas.slice(1);
            const podeCriar=perfisGerenciaveis(req.session.usuario.perfil), criados=[], ignorados=[], vistosM=new Set(), vistosE=new Set();
            let quantidadeCriados = 0;
            for(const [i,c] of linhas.entries()) {
                const [nome,m0,e0,p0,curso,turma]=c; const matricula=String(m0||'').trim(),email=String(e0||'').trim().toLowerCase();
                const perfil=semAcento(p0||'ALUNO').toUpperCase(); let motivo=null;
                if(!nome||!matricula||!email) motivo='Faltam nome, matrícula ou e-mail.';
                else if(!EMAIL_REGEX.test(email)) motivo='E-mail inválido.';
                else if(!podeCriar.includes(perfil)) motivo=`Perfil ${perfil} não permitido para seu usuário.`;
                else if(vistosM.has(matricula)||vistosE.has(email)) motivo='Matrícula ou e-mail repetido na planilha.';
                else if(await UsuarioModel.buscarPorMatricula(matricula)||await UsuarioModel.buscarPorEmail(email)) motivo='Já existe usuário com esta matrícula ou e-mail.';
                if(motivo) { ignorados.push({nome:nome||`linha ${i+1}`,matricula:matricula||'-',motivo}); continue; }
                vistosM.add(matricula); vistosE.add(email);
                if(perfil==='ALUNO') {
                    await UsuarioModel.criar({nome,email,matricula,senhaHash:await bcrypt.hash(matricula,SALT_ROUNDS),perfil,curso,turma,deveTrocarSenha:true});
                    await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, acao:'CRIAR_USUARIO', detalhe:`Perfil ${perfil}`, ip:req.ip });
                    quantidadeCriados += 1;
                } else {
                    const codigo=gerarCodigo();
                    await UsuarioModel.criarPendente({nome,email,matricula,perfil,curso,turma,codigoHash:hashCodigo(codigo,matricula),validadeHoras:VALIDADE_HORAS});
                    await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, acao:'CRIAR_USUARIO', detalhe:`Perfil ${perfil}`, ip:req.ip });
                    criados.push({nome,matricula,codigo:formatarCodigo(codigo)});
                    quantidadeCriados += 1;
                }
            }
            return renderCodigos(res,'Resultado da importação',criados,ignorados,quantidadeCriados);
        } catch(e) { next(e); }
    },
    async redefinirAcesso(req,res,next) {
        try {
            const id=Number(req.params.id), logado=req.session.usuario;
            if(id===logado.id) return res.status(400).send('Não é possível redefinir o próprio acesso enquanto estiver logado.');
            const alvo=await UsuarioModel.buscarPorId(id);
            if(!alvo||!podeGerenciar(logado.perfil,alvo.perfil)) return res.sendStatus(403);
            if(alvo.perfil==='ALUNO') {
                await UsuarioModel.redefinirAluno(id,await bcrypt.hash(alvo.matricula,SALT_ROUNDS));
                await UsuarioModel.encerrarSessoes(id);
                await AuditoriaModel.registrar({ usuarioId:logado.id, alvoId:id, acao:'REDEFINIR_SENHA', detalhe:'Primeiro acesso de aluno', ip:req.ip });
                return res.redirect('/admin/usuarios');
            }
            const codigo=gerarCodigo();
            await UsuarioModel.redefinirParaPrimeiroAcesso(id,hashCodigo(codigo,alvo.matricula),VALIDADE_HORAS);
            await UsuarioModel.encerrarSessoes(id);
            await AuditoriaModel.registrar({ usuarioId:logado.id, alvoId:id, acao:'REDEFINIR_SENHA', detalhe:'Novo código de ativação', ip:req.ip });
            return renderCodigos(res,'Novo código de ativação',[{nome:alvo.nome,matricula:alvo.matricula,codigo:formatarCodigo(codigo)}]);
        } catch(e) { next(e); }
    },
    async excluir(req,res,next) {
        try {
            const id=Number(req.params.id), alvo=await UsuarioModel.buscarPorId(id);
            if(id===req.session.usuario.id) return res.status(400).send('Não é possível excluir o próprio usuário.');
            if(!alvo||!podeGerenciar(req.session.usuario.perfil,alvo.perfil)) return res.sendStatus(403);
            if(alvo.perfil==='DIRECAO' && await UsuarioModel.contarDirecoesAtivas() <= 1) return res.status(400).send('Não é possível excluir a última Direção ativa.');
            await AuditoriaModel.registrar({ usuarioId:req.session.usuario.id, alvoId:id, acao:'EXCLUIR_USUARIO', detalhe:`Perfil ${alvo.perfil}`, ip:req.ip });
            await UsuarioModel.excluir(id); return res.redirect('/admin/usuarios');
        } catch(e) { next(e); }
    }
};
module.exports=UsuarioController;
