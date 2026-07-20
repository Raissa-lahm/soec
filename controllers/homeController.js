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

    // GET /calendario -> lista de eventos organizados por data, estilo agenda
    async calendario(req, res, next) {
        try {
            const eventos = await EventoModel.listarParaCalendario();

            // Agrupa os eventos por mes/ano para facilitar a exibicao em "agenda"
            const eventosPorMes = {};
            eventos.forEach((evento) => {
                const data = new Date(evento.data_evento);
                const chave = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                if (!eventosPorMes[chave]) eventosPorMes[chave] = [];
                eventosPorMes[chave].push(evento);
            });

            res.render('calendario', { eventosPorMes });
        } catch (erro) {
            next(erro);
        }
    }
};

module.exports = HomeController;
