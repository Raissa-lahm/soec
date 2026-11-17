const EventoModel = require('../models/eventoModel');
const InscricaoModel = require('../models/inscricaoModel');
const EquipeModel = require('../models/equipeModel');
const CursoModel = require('../models/cursoModel');
const AuditoriaModel = require('../models/auditoriaModel');
const { verificarElegibilidade } = require('../utils/elegibilidade');
const cpfUtil = require('../utils/cpf');
const pool = require('../config/database');

const MODOS=['INDIVIDUAL','EQUIPE','AMBOS'];
const STATUS=['RASCUNHO','ABERTO','ENCERRADO','CANCELADO'];
const asBool=(value)=>value==='on'||value==='true'||value===true;
const dataHoraValida=(value)=>{
    if(!value)return true;
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(!match)return false;
    const d=new Date(value);
    return Number.isFinite(d.getTime())&&d.getFullYear()===Number(match[1])&&d.getMonth()+1===Number(match[2])&&d.getDate()===Number(match[3])&&d.getHours()===Number(match[4])&&d.getMinutes()===Number(match[5]);
};
function dataEvento(body) {
    const price=(value)=>{ if(value===undefined||value===''||value===null)return 0; const raw=String(value).trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(raw))return null;const n=Number(raw.replace(',','.'));return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null; };
    const valor=price(body.valor_inscricao), valorTrans=price(body.valor_transporte);
    const vagas=body.vagas_limite===''||body.vagas_limite===undefined?0:Number(body.vagas_limite);
    const vagasTrans=body.vagas_transporte===''||body.vagas_transporte===undefined?null:Number(body.vagas_transporte);
    const series=[].concat(body.series_permitidas||[]).map(Number);
    const cursosRaw=[].concat(body.curso_ids||[]).filter(Boolean).map(Number);
    const externo=asBool(body.externo), transporte=asBool(body.transporte_ofertado), obrigatorio=asBool(body.transporte_obrigatorio);
    const data={titulo:String(body.titulo||'').trim(),descricao:String(body.descricao||'').trim(),tipo:String(body.tipo||'').trim(),data_evento:body.data_evento,local:String(body.local||'').trim(),vagas_limite:vagas,
        modo_inscricao:body.modo_inscricao||'INDIVIDUAL',status:body.status||'ABERTO',invalidMode:!MODOS.includes(body.modo_inscricao||'INDIVIDUAL'),invalidStatus:!STATUS.includes(body.status||'ABERTO'),
        inscricao_inicio:body.inscricao_inicio||null,inscricao_fim:body.inscricao_fim||null,valor_inscricao:valor,prazo_pagamento:body.prazo_pagamento||null,
        externo,endereco:externo?String(body.endereco||'').trim()||null:null,ponto_encontro:externo?String(body.ponto_encontro||'').trim()||null:null,
        saida_em:externo?body.saida_em||null:null,retorno_em:externo?body.retorno_em||null:null,
        transporte_ofertado:transporte,transporte_obrigatorio:transporte&&obrigatorio,valor_transporte:transporte?valorTrans:0,vagas_transporte:transporte?vagasTrans:null,
        exige_cpf:asBool(body.exige_cpf),exige_contato_emergencia:asBool(body.exige_contato_emergencia),exige_autorizacao_responsavel:asBool(body.exige_autorizacao_responsavel),
        series_permitidas:series.length?series:null,curso_ids:cursosRaw,invalidCourseIds:cursosRaw.some(n=>!Number.isInteger(n))};
    return data;
}
function validarEvento(d) {
    if(!d.titulo||!d.tipo||!d.data_evento||!Number.isInteger(d.vagas_limite)||d.vagas_limite<0) return 'Preencha título, tipo, data e um limite de vagas válido.';
    if(d.invalidMode||d.invalidStatus)return 'Modo ou status do evento inválido.';
    if(!dataHoraValida(d.data_evento)||!dataHoraValida(d.inscricao_inicio)||!dataHoraValida(d.inscricao_fim)||!dataHoraValida(d.prazo_pagamento)||!dataHoraValida(d.saida_em)||!dataHoraValida(d.retorno_em))return 'Uma das datas ou horários informados é inválida.';
    if(d.invalidCourseIds||d.series_permitidas?.some(n=>![1,2,3].includes(n)))return 'Público-alvo inválido.';
    if(d.valor_inscricao===null||d.valor_transporte===null||d.vagas_transporte!==null&&(!Number.isInteger(d.vagas_transporte)||d.vagas_transporte<0)) return 'Valores e vagas precisam ser números válidos e não negativos.';
    if(d.inscricao_inicio&&d.inscricao_fim&&new Date(d.inscricao_fim)<new Date(d.inscricao_inicio))return 'O fim das inscrições deve ocorrer depois do início.';
    if(d.inscricao_fim&&new Date(d.inscricao_fim)>new Date(d.data_evento))return 'O fim das inscrições não pode ser posterior ao evento.';
    if(d.prazo_pagamento&&d.inscricao_fim&&new Date(d.prazo_pagamento)<new Date(d.inscricao_fim))return 'O prazo de pagamento não pode terminar antes das inscrições.';
    if(d.transporte_ofertado&&!d.externo)return 'O transporte só pode ser oferecido em evento externo.';
    if(d.transporte_obrigatorio&&!d.transporte_ofertado)return 'Transporte obrigatório exige transporte ofertado.';
    if(d.retorno_em&&d.saida_em&&new Date(d.retorno_em)<new Date(d.saida_em))return 'O retorno deve ocorrer após a saída.';
    if(d.externo&&!d.endereco)return 'Informe o endereço do evento externo.';
    return null;
}
async function opcoesForm(evento) { return { cursos:await CursoModel.listar(), modos:MODOS, statusDisponiveis:STATUS, evento }; }
async function conflitos(data) {
    const inicio=(data.saida_em||data.data_evento).slice(0,10), fim=(data.retorno_em||data.data_evento).slice(0,10);
    const r=await pool.query(`SELECT titulo,tipo FROM calendario_datas WHERE data_inicio <= $2::date AND COALESCE(data_fim,data_inicio)>=$1::date
        AND (sem_aula OR tipo IN ('FERIADO','RECESSO','PROVA_FINAL')) AND (curso_id IS NULL OR $3::int[] IS NULL OR curso_id=ANY($3::int[]))`,[inicio,fim,data.curso_ids.length?data.curso_ids:null]);
    const anos=await pool.query('SELECT 1 FROM anos_letivos WHERE inicio <= $1::date AND fim >= $2::date LIMIT 1',[inicio,fim]);
    if(!anos.rowCount) r.rows.push({titulo:'Fora de um ano letivo cadastrado',tipo:'ANO_LETIVO'});
    return r.rows;
}

const EventoController={
    async listar(req,res,next) {
        try {
            await InscricaoModel.expirarVencidas();
            const {pesquisa,tipo,data}=req.query;
            let eventos=await EventoModel.listar({pesquisa,tipo,data});
            if(!['DIRECAO','COORDENACAO'].includes(req.session.usuario.perfil))eventos=eventos.filter(e=>e.status!=='RASCUNHO');
            res.render('eventos/lista',{eventos,tiposDisponiveis:await EventoModel.listarTiposDistintos(),filtros:{pesquisa:pesquisa||'',tipo:tipo||'',data:data||''}});
        } catch(e){next(e);}
    },
    async detalhes(req,res,next) {
        try {
            await InscricaoModel.expirarVencidas(req.params.id);
            const evento=await EventoModel.buscarPorId(req.params.id);
            if(!evento||evento.status==='RASCUNHO'&&!['DIRECAO','COORDENACAO'].includes(req.session.usuario.perfil))return res.sendStatus(404);
            const usuario=req.session.usuario,jaInscrito=await InscricaoModel.jaInscrito(usuario.id,evento.id);
            const elegibilidade=await verificarElegibilidade(usuario,evento,{verificarInscricao:!jaInscrito,verificarVagas:false,validarDados:false});
            const equipes=await EquipeModel.listarPorEvento(evento.id);
            res.render('eventos/detalhes',{evento,jaInscrito,equipes,elegibilidade});
        } catch(e){next(e);}
    },
    async exibirFormCriar(req,res,next) { try{res.render('eventos/form',{...(await opcoesForm(null)),acao:'/eventos',erro:null});}catch(e){next(e);} },
    async exibirFormEditar(req,res,next) {
        try{const evento=await EventoModel.buscarPorId(req.params.id);if(!evento)return res.redirect('/eventos');res.render('eventos/form',{...(await opcoesForm(evento)),acao:`/eventos/${evento.id}?_method=PUT`,erro:null});}catch(e){next(e);}
    },
    async criar(req,res,next) { return EventoController._salvar(req,res,next,false); },
    async atualizar(req,res,next) { return EventoController._salvar(req,res,next,true); },
    async _salvar(req,res,next,editar) {
        try {
            const dados=dataEvento(req.body),erro=validarEvento(dados),id=req.params.id;
            if(erro)return res.status(400).render('eventos/form',{...(await opcoesForm(dados)),acao:editar?`/eventos/${id}?_method=PUT`:'/eventos',erro});
            const cursosAtivos=await CursoModel.listar();
            if(dados.curso_ids.some(cid=>!cursosAtivos.some(c=>c.id===cid)))return res.status(400).render('eventos/form',{...(await opcoesForm(dados)),acao:editar?`/eventos/${id}?_method=PUT`:'/eventos',erro:'O público-alvo contém curso inválido ou inativo.'});
            const avisos=await conflitos(dados);
            if(avisos.length&&req.body.confirmar_conflito!=='1')return res.status(409).render('eventos/form',{...(await opcoesForm(dados)),acao:editar?`/eventos/${id}?_method=PUT`:'/eventos',erro:'A data conflita com o calendário letivo. Revise os avisos e marque a confirmação para salvar.',avisos});
            if(editar)await EventoModel.atualizar(id,dados); else await EventoModel.criar({...dados,criado_por:req.session.usuario.id});
            await AuditoriaModel.registrar({usuarioId:req.session.usuario.id,alvoId:editar?Number(id):null,acao:editar?'EDITAR_EVENTO':'CRIAR_EVENTO',ip:req.ip});
            return res.redirect(editar?`/eventos/${id}`:'/eventos');
        }catch(e){next(e);}
    },
    async excluir(req,res,next){try{await EventoModel.excluir(req.params.id);return res.redirect('/eventos');}catch(e){next(e);}},
    async exibirInscricao(req,res,next) {
        try {
            await InscricaoModel.expirarVencidas(req.params.id);
            const evento=await EventoModel.buscarPorId(req.params.id);if(!evento)return res.redirect('/eventos');
            const elegibilidade=await verificarElegibilidade(req.session.usuario,evento,{verificarVagas:false,validarDados:false});
            const cpfSalvo=(await pool.query('SELECT cpf_hash IS NOT NULL AS tem FROM usuarios WHERE id=$1',[req.session.usuario.id])).rows[0]?.tem;
            let erro=null;
            if(evento.exige_cpf)try{cpfUtil.validarConfiguracao();}catch(_){erro='CPF_CRYPTO_KEY não está configurada corretamente. Avise a gestão antes de solicitar CPF.';}
            const transporte=await InscricaoModel.disponibilidadeTransporte(evento.id);
            if(evento.transporte_obrigatorio&&!transporte.disponivel)return res.render('eventos/inscrever',{evento,elegibilidade:{ok:false,mensagemPublica:'O transporte é obrigatório, mas não há vaga disponível.'},cpfSalvo,erro,cpfConfigurado:!erro,transporte});
            return res.render('eventos/inscrever',{evento,elegibilidade,cpfSalvo,erro,cpfConfigurado:!erro,transporte});
        }catch(e){next(e);}
    },
    async inscrever(req,res,next) {
        try {
            await InscricaoModel.expirarVencidas(req.params.id);
            const evento=await EventoModel.buscarPorId(req.params.id);if(!evento)return res.redirect('/eventos');
            const temCpf=Boolean((await pool.query('SELECT cpf_hash IS NOT NULL AS tem FROM usuarios WHERE id=$1',[req.session.usuario.id])).rows[0]?.tem);
            if(evento.exige_cpf)try{cpfUtil.validarConfiguracao();}catch(_){return res.status(503).render('eventos/inscrever',{evento,elegibilidade:{ok:true},cpfSalvo:temCpf,cpfConfigurado:false,erro:'CPF_CRYPTO_KEY não está configurada corretamente. Avise a gestão antes de solicitar CPF.'});}
            const cpfInput=evento.exige_cpf&&!temCpf?String(req.body.cpf||'').trim():'';let cpfCipher=null,cpfHash=null;
            if(cpfInput) {
                if(!cpfUtil.validarCpf(cpfInput))return res.status(400).render('eventos/inscrever',{evento,elegibilidade:{ok:true},cpfSalvo:temCpf,cpfConfigurado:true,erro:'O CPF informado é inválido.'});
                if(req.body.aceite_dados!=='on')return res.status(400).render('eventos/inscrever',{evento,elegibilidade:{ok:true},cpfSalvo:temCpf,cpfConfigurado:true,erro:'Aceite o uso dos dados para continuar.'});
                try{cpfCipher=cpfUtil.cifrar(cpfInput);cpfHash=cpfUtil.hash(cpfInput);}catch(_){return res.status(503).render('eventos/inscrever',{evento,elegibilidade:{ok:true},cpfSalvo:temCpf,cpfConfigurado:false,erro:'A proteção de CPF não está configurada no servidor. Avise a gestão.'});}
            }
            const contatoNome=String(req.body.contato_emergencia_nome||'').trim()||null,contatoTelefone=String(req.body.contato_emergencia_telefone||'').trim()||null;
            if(contatoNome?.length>150||contatoTelefone?.length>30)return res.status(400).render('eventos/inscrever',{evento,elegibilidade:{ok:true},cpfSalvo:temCpf,cpfConfigurado:true,erro:'Os dados do contato de emergência excedem o limite permitido.'});
            const r=await InscricaoModel.inscrever({usuario:req.session.usuario,eventoId:evento.id,usaTransporte:req.body.usa_transporte==='on',cpfCipher,cpfHash,contatoNome,contatoTelefone,aceiteDados:req.body.aceite_dados==='on'});
            return res.redirect('/minhas-inscricoes');
        }catch(e){
            const codigos={'RESTRICAO':'Você não está habilitado a se inscrever neste evento. Procure a Direção.','PUBLICO_ALVO':e.message,'VAGAS':'As vagas estão esgotadas; a inscrição foi para a lista de espera.','CPF':'Informe um CPF válido para continuar.','ACEITE_DADOS':'Aceite o uso dos dados para continuar.','TRANSPORTE_LOTADO':'As vagas de transporte estão esgotadas.','TRANSPORTE_OBRIGATORIO':'O transporte é obrigatório, mas não há vaga disponível.','EVENTO_FECHADO':e.message,'FORA_DA_JANELA':e.message,'JA_INSCRITO':e.message,'CONTATO_EMERGENCIA':e.message,'23505':'Não foi possível salvar este CPF; confira se já está associado a esta conta.'};
            if(e.code==='VAGAS')return res.redirect('/minhas-inscricoes');
            if(e.code){const evento=await EventoModel.buscarPorId(req.params.id);return res.status(400).render('eventos/inscrever',{evento,elegibilidade:{ok:e.code!=='RESTRICAO'&&e.code!=='PUBLICO_ALVO'},cpfSalvo:false,erro:codigos[e.code]||e.message});}
            next(e);
        }
    },
    async cancelarInscricao(req,res,next){try{await InscricaoModel.cancelar(req.session.usuario.id,req.params.id);return res.redirect('/minhas-inscricoes');}catch(e){next(e);}}
};
module.exports=EventoController;
