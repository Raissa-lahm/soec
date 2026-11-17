const pool = require('../config/database');
const RestricaoModel = require('../models/restricaoModel');
const AuditoriaModel = require('../models/auditoriaModel');

const RestricaoController={
    async listar(req,res,next) {
        try {
            const historico=req.query.historico==='1';
            const [restricoes,eventos]=await Promise.all([RestricaoModel.listar({historico}),pool.query('SELECT id,titulo FROM eventos ORDER BY data_evento DESC')]);
            const sucesso=req.session.mensagemRestricao||null;delete req.session.mensagemRestricao;
            res.render('admin/restricoes',{restricoes,eventos:eventos.rows,historico,erro:null,sucesso});
        } catch(e) { next(e); }
    },
    async criar(req,res,next) {
        try {
            const matriculas=String(req.body.matriculas||'').split(/[\r\n,;\t ]+/).filter(Boolean);
            const eventoId=req.body.escopo==='TODOS'?null:Number(req.body.evento_id)||null;
            const motivo=String(req.body.motivo||'').trim();
            const vigenteAte=req.body.vigente_ate||null;
            if(!matriculas.length||!motivo||motivo.length>150||(req.body.escopo==='EVENTO'&&!eventoId)) return res.status(400).send('Informe matrículas, referência curta e escopo válido.');
            const result=await RestricaoModel.criarLote({matriculas,eventoId,motivo,vigenteAte,criadoPor:req.session.usuario.id,cancelar:req.body.cancelar==='on'});
            if(!result.length) {
                const [restricoes,eventos]=await Promise.all([RestricaoModel.listar(),pool.query('SELECT id,titulo FROM eventos ORDER BY data_evento DESC')]);
                return res.status(400).render('admin/restricoes',{restricoes,eventos:eventos.rows,historico:false,erro:'Nenhuma matrícula informada corresponde a um aluno.',sucesso:null});
            }
            for(const r of result) await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:r.usuario_id,acao:'RESTRICAO_CRIADA',detalhe:`restricao_id=${r.id};evento_id=${r.evento_id??'todos'}`,ip:req.ip});
            req.session.mensagemRestricao=`${result.length} restrição(ões) criada(s).`;
            return res.redirect('/admin/restricoes');
        } catch(e) { next(e); }
    },
    async revogar(req,res,next) {
        try {
            const r=await RestricaoModel.revogar(req.params.id,req.session.usuario.id);
            if(r) await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:r.usuario_id,acao:'RESTRICAO_REVOGADA',detalhe:`restricao_id=${r.id};evento_id=${r.evento_id??'todos'}`,ip:req.ip});
            return res.redirect('/admin/restricoes');
        } catch(e) { next(e); }
    }
};
module.exports=RestricaoController;
