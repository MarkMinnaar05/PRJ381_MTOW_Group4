// src/routes/api.js
const express = require('express');
const router = express.Router();

const sessionController = require('../controllers/SessionController');
const questionController = require('../controllers/QuestionController');
const answerController = require('../controllers/AnswerController');

console.log('Session Controller:', sessionController);
console.log('Question Controller:', questionController);
console.log('Answer Controller:', answerController);

router.post('/session/start', sessionController.startSession);
router.get('/session/status/:sessionId', sessionController.getSessionStatus);
router.delete('/session/end/:sessionId', sessionController.endSession);

router.get('/question/next/:sessionId', questionController.getNextQuestion);
router.get('/question/batch/:sessionId', questionController.getBatchQuestions);

router.post('/answer/submit', answerController.submitAnswer);

router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;