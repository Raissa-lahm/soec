// =========================================================================
// controllers/homeController.js
// Controller da pagina inicial e do calendario institucional.
// =========================================================================

const EventoModel = require('../models/eventoModel');
const InscricaoModel = require('../models/inscricaoModel');
const ComunicadoModel = require('../models/comunicadoModel');
const CalendarioModel = require('../models/calendarioModel');
const UsuarioModel = require('../models/usuarioModel');
const TurmaModel = require('../models/turmaModel');
const CursoModel = require('../models/cursoModel');
const AnoLetivoModel = require('../models/anoLetivoModel');

function dateParts(value) { const [ano,mes,dia]=String(value).slice(0,10).split('-').map(Number); return {ano,mes,dia}; }
function keyDate(ano,mes,dia) { return `${ano}-${mes}-${dia}`; }

const HomeController = {

    // GET / -> pagina inicial: proximos eventos + ultimos comunicados
    async index(req, res, next) {
        try {
            await InscricaoModel.expirarVencidas();
            const eventos = await EventoModel.listar();
            const proximosEventos = eventos
                .filter(e => e.status === 'ABERTO' && new Date(e.data_evento) >= new Date())
                .slice(0, 5);

            const comunicados = (await ComunicadoModel.listar()).slice(0, 5);
            const todos=req.session.usuario.perfil!=='ALUNO';
            let cursoId=null,serie=null;
            if(req.session.usuario.perfil==='ALUNO') { const u=await UsuarioModel.buscarPorId(req.session.usuario.id);const t=u?.turma_id?await TurmaModel.buscarPorId(u.turma_id):null;cursoId=t?.curso_id||null;serie=t?.serie||null; }
            const [trimestre,marcos]=await Promise.all([CalendarioModel.trimestreAtual(),CalendarioModel.proximas(5,cursoId,serie,todos)]);

            res.render('home', { proximosEventos, comunicados,trimestre,marcos });
        } catch (erro) {
            next(erro);
        }
    },

    // GET /calendario -> grade mensal com navegacao entre meses
    async calendario(req, res, next) {
        try {
            const agora = new Date();
            const partesHoje = Object.fromEntries(
                new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: 'numeric'
                }).formatToParts(agora).map(parte => [parte.type, parte.value])
            );
            const mesHoje = Number(partesHoje.month);
            const anoHoje = Number(partesHoje.year);
            const diaHoje = Number(partesHoje.day);
            let mes = Number.parseInt(req.query.mes, 10);
            let ano = Number.parseInt(req.query.ano, 10);

            if (!Number.isInteger(mes) || mes < 1 || mes > 12) mes = mesHoje;
            if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) ano = anoHoje;

            const todos=req.session.usuario.perfil!=='ALUNO';
            let cursoId=req.query.curso_id?Number(req.query.curso_id):null;
            let serie=req.query.serie?Number(req.query.serie):null;
            if(!todos&&!cursoId&&req.session.usuario.perfil==='ALUNO') {
                const user=await UsuarioModel.buscarPorId(req.session.usuario.id);
                const turma=user?.turma_id?await TurmaModel.buscarPorId(user.turma_id):null;
                cursoId=turma?.curso_id||null;serie=turma?.serie||null;
            }
            const cursos=await CursoModel.listar();
            const primeiroDia = new Date(ano, mes - 1, 1);
            const ultimoDia = new Date(ano, mes, 0);
            const iso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const [eventos,datas,comunicados,trimestre,anoVigente]=await Promise.all([
                EventoModel.listarParaCalendario(),
                CalendarioModel.listar({inicio:iso(primeiroDia),fim:iso(ultimoDia),cursoId,serie,todas:todos}),
                ComunicadoModel.listarParaCalendario({inicio:iso(primeiroDia),fim:iso(ultimoDia)}),
                CalendarioModel.trimestreAtual(),AnoLetivoModel.vigente()
            ]);
            const eventosPorDia = new Map();
            eventos.forEach((evento) => {
                if (evento.ano !== ano || evento.mes !== mes) return;
                const chave = keyDate(evento.ano,evento.mes,evento.dia);
                if (!eventosPorDia.has(chave)) eventosPorDia.set(chave, []);
                eventosPorDia.get(chave).push(evento);
            });

            const datasPorDia = new Map();
            for(const data of datas) {
                const inicio=dateParts(data.data_inicio),fim=dateParts(data.data_fim||data.data_inicio);
                let cursor=new Date(Math.max(inicio.ano,ano),inicio.ano<ano?0:inicio.mes-1,inicio.ano<ano?1:inicio.dia);
                const limite=new Date(Math.min(fim.ano,ano),fim.ano>ano?11:fim.mes-1,fim.ano>ano?31:fim.dia);
                while(cursor<=limite) {
                    if(cursor.getFullYear()===ano&&cursor.getMonth()+1===mes) {
                        const key=keyDate(cursor.getFullYear(),cursor.getMonth()+1,cursor.getDate());
                        if(!datasPorDia.has(key))datasPorDia.set(key,[]);
                        datasPorDia.get(key).push(data);
                    }
                    cursor.setDate(cursor.getDate()+1);
                }
            }
            const comunicadosPorDia = new Map();
            const adicionarComunicado = (comunicado, data, prazo) => {
                if (!data) return;
                const p = dateParts(data);
                if (p.ano !== ano || p.mes !== mes) return;
                const chave = keyDate(p.ano, p.mes, p.dia);
                if (!comunicadosPorDia.has(chave)) comunicadosPorDia.set(chave, []);
                comunicadosPorDia.get(chave).push({
                    id: comunicado.id,
                    titulo: `${prazo ? 'Prazo final: ' : ''}${comunicado.titulo}`
                });
            };
            comunicados.forEach(c => {
                adicionarComunicado(c, c.data_evento, false);
                adicionarComunicado(c, c.prazo_final, true);
            });
            const offset = primeiroDia.getDay();
            const diasNoMes = new Date(ano, mes, 0).getDate();
            const totalCelulas = Math.ceil((offset + diasNoMes) / 7) * 7;
            const semanas = [];

            for (let inicio = 0; inicio < totalCelulas; inicio += 7) {
                const semana = [];
                for (let coluna = 0; coluna < 7; coluna++) {
                    const data = new Date(ano, mes - 1, inicio + coluna - offset + 1);
                    const estaNoMes = data.getMonth() === mes - 1;
                    const chave = keyDate(data.getFullYear(),data.getMonth()+1,data.getDate());
                    semana.push({
                        dia: data.getDate(),
                        estaNoMes,
                        ehHoje: data.getFullYear() === anoHoje &&
                            data.getMonth() + 1 === mesHoje && data.getDate() === diaHoje,
                        eventos: estaNoMes ? (eventosPorDia.get(chave) || []) : [],
                        datas: estaNoMes ? (datasPorDia.get(chave) || []) : [],
                        comunicados: estaNoMes ? (comunicadosPorDia.get(chave) || []) : []
                    });
                }
                semanas.push(semana);
            }

            const anterior = new Date(ano, mes - 2, 1);
            const proximo = new Date(ano, mes, 1);
            const agendaItens=[
                ...datas.map(d=>({tipo:'DATA',titulo:d.titulo,data:d.data_inicio,subtitulo:d.tipo.replaceAll('_',' '),semAula:d.sem_aula})),
                ...eventos.filter(e=>e.ano===ano&&e.mes===mes).map(e=>({tipo:'EVENTO',titulo:e.titulo,data:`${e.ano}-${String(e.mes).padStart(2,'0')}-${String(e.dia).padStart(2,'0')}`,subtitulo:e.horario,url:`/eventos/${e.id}`})),
                ...comunicados.flatMap(c=>[
                    c.data_evento ? {tipo:'COMUNICADO',titulo:c.titulo,data:c.data_evento,subtitulo:'Comunicado',url:'/comunicados'} : null,
                    c.prazo_final ? {tipo:'PRAZO',titulo:c.titulo,data:c.prazo_final,subtitulo:'Prazo final',url:'/comunicados'} : null
                ].filter(Boolean))
            ].sort((a,b)=>a.data.localeCompare(b.data));

            res.render('calendario', {
                semanas,
                mesNome: primeiroDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
                mesAnterior: { mes: anterior.getMonth() + 1, ano: anterior.getFullYear() },
                mesProximo: { mes: proximo.getMonth() + 1, ano: proximo.getFullYear() },
                temEventos: eventosPorDia.size > 0 || datasPorDia.size > 0 || comunicadosPorDia.size > 0,
                datasAgenda: datas,
                agendaItens,
                trimestre,
                cursos,
                filtroCurso:cursoId,
                filtroSerie:serie,
                modoAgenda:req.query.visao==='agenda',
                anoLetivo:anoVigente.ano,
                mesAtual:{mes,ano}
            });
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = HomeController;
