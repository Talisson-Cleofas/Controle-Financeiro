function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso exclusivo para administradores.' });
  }
  next();
}

module.exports = requireAdmin;
