
// middlewares/uploadUsuariosMiddleware.js
// Recebe a planilha (CSV) de usuarios na importacao em massa.
// O arquivo fica so na memoria (req.file.buffer): nao precisa gravar nada
// em disco, ele e lido e descartado. Usa o multer, que ja esta no projeto.


const multer = require('multer');

module.exports = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // 2 MB e de sobra para uma planilha de usuarios
});