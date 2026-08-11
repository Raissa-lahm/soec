// =====================================================================
// SOEC - Middleware de upload do PDF de horários
// Salvar em: /middleware/uploadHorarioMiddleware.js
// =====================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaDestino = path.join(__dirname, '..', 'public', 'uploads', 'horarios');

if (!fs.existsSync(pastaDestino)) {
  fs.mkdirSync(pastaDestino, { recursive: true });
}

function slugify(texto) {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaDestino),
  filename: (req, file, cb) => {
    const curso = req.body.curso;
    if (!curso) {
      return cb(new Error('Curso não informado.'));
    }
    cb(null, `${slugify(curso)}.pdf`);
  }
});

function filtroPdf(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Envie apenas arquivos em PDF.'));
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter: filtroPdf,
  limits: { fileSize: 10 * 1024 * 1024 }
});