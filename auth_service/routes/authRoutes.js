const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/refresh-token', authController.refreshAccessToken);

module.exports = router;