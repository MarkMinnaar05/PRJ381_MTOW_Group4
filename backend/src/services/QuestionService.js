
const Question = require('../models/Questions');

class QuestionService {
    constructor() {
        this.questionCache = new Map();
        this.maxCacheSize = 100;
    }

    getQuestion(difficulty = 1, operations = ['+', '-', '×', '÷'], useCache = true) {
        if (useCache) {
            const cacheKey = this.getCacheKey(difficulty, operations);
            if (this.questionCache.has(cacheKey)) {
                const cached = this.questionCache.get(cacheKey);
                if (cached.length > 0) {
                    return cached.pop();
                }
            }
        }
        
    
        const question = Question.generate(difficulty, operations);
        
        if (useCache) {
            const cacheKey = this.getCacheKey(difficulty, operations);
            if (!this.questionCache.has(cacheKey)) {
                this.questionCache.set(cacheKey, []);
            }
            this.questionCache.get(cacheKey).push(question);
        }
        
        return question;
    }

    getBatchQuestions(count = 5, difficulty = 1, operations = ['+', '-', '×', '÷']) {
        const questions = [];
        for (let i = 0; i < count; i++) {
            questions.push(this.getQuestion(difficulty, operations, false));
        }
        return questions;
    }

    getCacheKey(difficulty, operations) {
        return `${difficulty}_${operations.sort().join('')}`;
    }

    clearCache() {
        this.questionCache.clear();
    }

    preCacheQuestions(difficulty = 1, count = 10) {
        const questions = this.getBatchQuestions(count, difficulty);
        const cacheKey = this.getCacheKey(difficulty, ['+', '-', '×', '÷']);
        this.questionCache.set(cacheKey, questions);
    }
}

module.exports = new QuestionService();