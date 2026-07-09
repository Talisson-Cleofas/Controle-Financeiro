function errorHandler(error, req, res, next) {
  console.error('❌ Erro:', error);

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ message: messages[0] || 'Erro de validação.', errors: messages });
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Já existe um cadastro com esses dados.' });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Identificador inválido.' });
  }

  return res.status(error.status || 500).json({
    message: error.message || 'Erro interno do servidor.'
  });
}

module.exports = errorHandler;
