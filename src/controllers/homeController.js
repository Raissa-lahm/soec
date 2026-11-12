// =========================================================================
// controllers/homeController.js
// Controller da pagina inicial e do calendario institucional.
// =========================================================================

const EventoModel = require('../models/eventoModel');
const ComunicadoModel = require('../models/comunicadoModel');

const HomeController = {

    // GET / -> pagina inicial: proximos eventos + ultimos comunicados
    async index(req, res, next) {
        try {
            const eventos = await EventoModel.listar();
            const proximosEventos = eventos
                .filter(e => new Date(e.data_evento) >= new Date())
                .slice(0, 5);

            const comunicados = (await ComunicadoModel.listar()).slice(0, 5);

            res.render('home', { proximosEventos, comunicados });
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

            const eventos = await EventoModel.listarParaCalendario();
            const eventosPorDia = new Map();
            eventos.forEach((evento) => {
                if (evento.ano !== ano || evento.mes !== mes) return;
                const chave = `${evento.ano}-${evento.mes}-${evento.dia}`;
                if (!eventosPorDia.has(chave)) eventosPorDia.set(chave, []);
                eventosPorDia.get(chave).push(evento);
            });

            const primeiroDia = new Date(ano, mes - 1, 1);
            const offset = primeiroDia.getDay();
            const diasNoMes = new Date(ano, mes, 0).getDate();
            const totalCelulas = Math.ceil((offset + diasNoMes) / 7) * 7;
            const semanas = [];

            for (let inicio = 0; inicio < totalCelulas; inicio += 7) {
                const semana = [];
                for (let coluna = 0; coluna < 7; coluna++) {
                    const data = new Date(ano, mes - 1, inicio + coluna - offset + 1);
                    const estaNoMes = data.getMonth() === mes - 1;
                    const chave = `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`;
                    semana.push({
                        dia: data.getDate(),
                        estaNoMes,
                        ehHoje: data.getFullYear() === anoHoje &&
                            data.getMonth() + 1 === mesHoje && data.getDate() === diaHoje,
                        eventos: estaNoMes ? (eventosPorDia.get(chave) || []) : []
                    });
                }
                semanas.push(semana);
            }

            const anterior = new Date(ano, mes - 2, 1);
            const proximo = new Date(ano, mes, 1);

            res.render('calendario', {
                semanas,
                mesNome: primeiroDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
                mesAnterior: { mes: anterior.getMonth() + 1, ano: anterior.getFullYear() },
                mesProximo: { mes: proximo.getMonth() + 1, ano: proximo.getFullYear() },
                temEventos: eventosPorDia.size > 0
            });
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = HomeController;
