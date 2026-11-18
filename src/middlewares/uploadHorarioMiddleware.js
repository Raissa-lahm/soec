
// SOEC - Middleware de upload do PDF de horários
// Salvar em: /src/middlewares/uploadHorarioMiddleware.js


const multer = require('multer');

function filtroPdf(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Envie apenas arquivos em PDF.'));
  }
  cb(null, true);
}

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroPdf,
  limits: { fileSize: 10 * 1024 * 1024 }
});
