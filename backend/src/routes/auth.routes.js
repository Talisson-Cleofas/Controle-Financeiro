const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { register, login, me, updateSettings, inspectPartnerInvite, acceptPartnerInvite } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/partner-invite/inspect', inspectPartnerInvite);
router.post('/partner-invite/accept', acceptPartnerInvite);
router.get('/me', authMiddleware, me);
router.put('/me/settings', authMiddleware, updateSettings);

module.exports = router;
