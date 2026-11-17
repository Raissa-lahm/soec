const AnoLetivoModel = require('../models/anoLetivoModel');
const CursoModel = require('../models/cursoModel');
const TurmaModel = require('../models/turmaModel');
const CalendarioModel = require('../models/calendarioModel');
const UsuarioModel = require('../models/usuarioModel');
const AuditoriaModel = require('../models/auditoriaModel');
const { gerarCodigoTurma } = require('../utils/turmas');

const TIPOS_DATA = ['FERIADO','RECESSO','PROVA_FINAL','RECUPERACAO','CONSELHO','REUNIAO_PAIS','SEM_AULA','OUTRO'];
const dataISOValida=(v)=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(new Date(`${v}T00:00:00Z`).getTime());
const EscolarController = {
    async inicio(req,res,next) {
        try {
            const vigente=await AnoLetivoModel.vigente();
            const [anos,cursos,turmas,trimestres,datas,semTurma]=await Promise.all([
                AnoLetivoModel.listar(),CursoModel.listar(),TurmaModel.listar(vigente.ano),CalendarioModel.trimestres(vigente.ano),CalendarioModel.todos(),TurmaModel.alunosSemTurma(vigente.ano)
            ]);
            res.render('admin/gestaoEscolar',{vigente,anos,cursos,turmas,trimestres,datas,semTurma,tiposData:TIPOS_DATA,erro:null});
        } catch(e) { next(e); }
    },
    async salvarAno(req,res,next) {
        try {
            const ano=Number(req.body.ano), inicio=req.body.inicio, fim=req.body.fim;
            if(!Number.isInteger(ano)||!dataISOValida(inicio)||!dataISOValida(fim)||fim<inicio) return res.status(400).send('Ano letivo ou período inválido.');
            await AnoLetivoModel.salvar({ano,inicio,fim});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'EDITAR_CALENDARIO',detalhe:`Salvar ano letivo ${ano}`,ip:req.ip});
            return res.redirect('/admin/gestao-escolar');
        } catch(e) { next(e); }
    },
    async excluirAno(req,res,next) {
        try { await AnoLetivoModel.excluir(Number(req.params.ano)); await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'EDITAR_CALENDARIO',detalhe:`Excluir ano letivo ${req.params.ano}`,ip:req.ip}); return res.redirect('/admin/gestao-escolar'); }
        catch(e) { if(e.code==='23503')return res.status(409).send('Não é possível remover um ano letivo que ainda possui turmas ou trimestres vinculados.'); next(e); }
    },
    async salvarTrimestre(req,res,next) {
        try {
            const ano=Number(req.body.ano),numero=Number(req.body.numero),{inicio,fim}=req.body;
            if(!Number.isInteger(ano)||![1,2,3].includes(numero)||!dataISOValida(inicio)||!dataISOValida(fim)||fim<inicio) return res.status(400).send('Período de trimestre inválido.');
            await CalendarioModel.salvarTrimestre({ano,numero,inicio,fim});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'EDITAR_CALENDARIO',detalhe:`Trimestre ${ano}/${numero}`,ip:req.ip});
            return res.redirect('/admin/gestao-escolar');
        } catch(e) { next(e); }
    },
    async excluirTrimestre(req,res,next) {
        try { await CalendarioModel.excluirTrimestre(req.params.id); await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:Number(req.params.id),acao:'EDITAR_CALENDARIO',detalhe:'Excluir trimestre',ip:req.ip}); return res.redirect('/admin/gestao-escolar'); }
        catch(e) { next(e); }
    },
    async salvarTurma(req,res,next) {
        try {
            const id=Number(req.params.id)||null, cursoId=Number(req.body.curso_id), serie=Number(req.body.serie), ano=Number(req.body.ano_letivo);
            const curso=await CursoModel.listar();
            const escolhido=curso.find(c=>c.id===cursoId);
            const subturma=req.body.subturma===''?null:Number(req.body.subturma);
            const codigo=escolhido&&gerarCodigoTurma(escolhido.numero,serie,subturma);
            if(!codigo) return res.status(400).send('Curso, série ou subturma inválidos.');
            await TurmaModel.salvar({id,cursoId,serie,subturma,ano,codigo});
            return res.redirect('/admin/gestao-escolar');
        } catch(e) { if(e.code==='23505') return res.status(409).send('Já existe uma turma com esse curso, série, subturma e ano.'); next(e); }
    },
    async desativarTurma(req,res,next) {
        try { await TurmaModel.desativar(req.params.id); return res.redirect('/admin/gestao-escolar'); }
        catch(e) { next(e); }
    },
    async salvarData(req,res,next) {
        try {
            const {titulo,tipo,data_inicio,data_fim,curso_id,serie,descricao}=req.body;
            if(!titulo?.trim()||!TIPOS_DATA.includes(tipo)||!dataISOValida(data_inicio)||(data_fim&&(!dataISOValida(data_fim)||data_fim<data_inicio))|| (serie&&!['1','2','3'].includes(serie))) return res.status(400).send('Dados de calendário inválidos.');
            const id=await CalendarioModel.salvarData({id:Number(req.params.id)||null,titulo:titulo.trim(),tipo,dataInicio:data_inicio,dataFim:data_fim,semAula:req.body.sem_aula==='on',cursoId:curso_id,serie,descricao,criadoPor:req.session.usuario.id});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:id.id,acao:'EDITAR_CALENDARIO',detalhe:`${req.params.id?'Atualizar':'Criar'} data: ${tipo}`,ip:req.ip});
            return res.redirect('/admin/gestao-escolar');
        } catch(e) { next(e); }
    },
    async excluirData(req,res,next) {
        try { await CalendarioModel.excluirData(req.params.id); await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:Number(req.params.id),acao:'EDITAR_CALENDARIO',detalhe:'Excluir data',ip:req.ip}); return res.redirect('/admin/gestao-escolar'); }
        catch(e) { next(e); }
    },
    async copiarDatas(req,res,next) {
        try { const origem=Number(req.body.ano_origem),destino=Number(req.body.ano_destino); if(!origem||!destino||origem===destino) return res.status(400).send('Informe anos diferentes.'); await CalendarioModel.copiarDatas(origem,destino); await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'EDITAR_CALENDARIO',detalhe:`Copiar datas ${origem} para ${destino}`,ip:req.ip}); return res.redirect('/admin/gestao-escolar'); }
        catch(e) { next(e); }
    },
    async listarSemTurma(req,res,next) {
        try { const ano=await AnoLetivoModel.vigente();const [alunos,turmas]=await Promise.all([TurmaModel.alunosSemTurma(ano.ano),TurmaModel.listar(ano.ano)]); res.render('admin/alunosSemTurma',{alunos,turmas:turmas.filter(t=>t.ativo)}); }
        catch(e) { next(e); }
    },
    async corrigirTurma(req,res,next) {
        try {
            const id=Number(req.params.id),turma=await TurmaModel.buscarPorId(req.body.turma_id);
            const aluno=await UsuarioModel.buscarPorId(id);
            if(!aluno||aluno.perfil!=='ALUNO'||!turma||!turma.ativo) return res.status(400).send('Aluno ou turma inválidos.');
            await TurmaModel.mapearAluno({id,cursoId:turma.curso_id,turmaId:turma.id,cursoNome:turma.curso_nome,turmaCodigo:turma.codigo});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:id,acao:'EDITAR_USUARIO',detalhe:'Vínculo de turma corrigido',ip:req.ip});
            return res.redirect('/admin/alunos-sem-turma');
        } catch(e) { next(e); }
    }
};
module.exports=EscolarController;
