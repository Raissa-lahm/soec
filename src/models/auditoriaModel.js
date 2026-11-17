const pool = require('../config/database');

const AuditoriaModel = {
    async registrar({ usuarioId = null, alvoId = null, acao, detalhe = null, ip = null }) {
        await pool.query(
            `INSERT INTO log_auditoria (usuario_id,alvo_id,acao,detalhe,ip)
             VALUES ($1,$2,$3,$4,$5)`,
            [usuarioId,alvoId,acao,detalhe,ip]
        );
    }
};

module.exports = AuditoriaModel;
