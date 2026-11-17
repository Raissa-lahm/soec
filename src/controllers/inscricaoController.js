const InscricaoModel = require('../models/inscricaoModel');
const EventoModel = require('../models/eventoModel');
const AuditoriaModel = require('../models/auditoriaModel');
const cpfUtil = require('../utils/cpf');

const InscricaoController={
    async minhasInscricoes(req,res,next) {
        try { await InscricaoModel.expirarVencidas(); const inscricoes=await InscricaoModel.listarPorUsuario(req.session.usuario.id); res.render('inscricoes/minhas',{inscricoes}); }
        catch(e){next(e);}
    },
    async gerenciarPorEvento(req,res,next) {
        try {
            const evento=await EventoModel.buscarPorId(req.params.id);if(!evento)return res.redirect('/eventos');
            const [inscricoes,totais]=await Promise.all([InscricaoModel.listarPorEvento(evento.id),InscricaoModel.totais(evento.id)]);
            for(const i of inscricoes) {
                if(i.cpf_cifrado) { try { i.cpf_mascarado=cpfUtil.mascarar(cpfUtil.decifrar(i.cpf_cifrado)); } catch (_) { i.cpf_mascarado='CPF salvo'; } }
                delete i.cpf_cifrado;
                if(req.session.usuario.perfil==='DIRECAO')i.restrito=await InscricaoModel.restrictionStatus(i.usuario_id,evento.id);
            }
            res.render('inscricoes/gerenciar',{evento,inscricoes,totais,perfilLogado:req.session.usuario.perfil});
        }catch(e){next(e);}
    },
    async confirmarPagamento(req,res,next) {
        try { const forma=String(req.body.forma||'');if(!['PIX','DINHEIRO','SECRETARIA','OUTRO'].includes(forma))return res.status(400).send('Forma de pagamento inválida.');
            await InscricaoModel.atualizarPagamento(req.params.id,{forma,usuarioId:req.session.usuario.id});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'CONFIRMAR_PAGAMENTO',detalhe:`inscricao_id=${req.params.id}`,ip:req.ip});return res.redirect('back'); }
        catch(e){next(e);}
    },
    async isentar(req,res,next) {
        try { const motivo=String(req.body.motivo||'').trim();if(!motivo||motivo.length>150)return res.status(400).send('Informe uma justificativa curta para a isenção.');
            await InscricaoModel.atualizarPagamento(req.params.id,{usuarioId:req.session.usuario.id,isencao:true,motivo});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'ISENTAR',detalhe:`inscricao_id=${req.params.id}`,ip:req.ip});return res.redirect('back'); }
        catch(e){next(e);}
    },
    async confirmarAutorizacao(req,res,next) {
        try { await InscricaoModel.confirmarAutorizacao(req.params.id,req.session.usuario.id);await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'CONFIRMAR_AUTORIZACAO',detalhe:`inscricao_id=${req.params.id}`,ip:req.ip});return res.redirect('back'); }
        catch(e){next(e);}
    },
    async cancelarGestao(req,res,next) {
        try { await InscricaoModel.excluirPorId(req.params.id);await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,acao:'CANCELAR_INSCRICAO_GESTAO',detalhe:`inscricao_id=${req.params.id}`,ip:req.ip});return res.redirect('back'); }
        catch(e){next(e);}
    },
    async excluir(req,res,next) { return InscricaoController.cancelarGestao(req,res,next); },
    async revelarCpf(req,res,next) {
        try {
            const dado=await InscricaoModel.cpfCifradoPorInscricao(req.params.id);if(!dado?.cpf_cifrado)return res.status(404).send('CPF não cadastrado.');
            const cpf=cpfUtil.decifrar(dado.cpf_cifrado);
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:dado.usuario_id,acao:'VER_CPF',ip:req.ip});
            res.set('Cache-Control','no-store, private');
            return res.render('inscricoes/cpfRevelado',{cpf,eventoId:req.body.evento_id||req.query.evento_id||dado.evento_id});
        }catch(e){next(e);}
    }
};
module.exports=InscricaoController;
