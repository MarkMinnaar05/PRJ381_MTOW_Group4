

class Question {
    constructor(operand1, operand2, operation, difficulty) {
        this.id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.operand1 = operand1;
        this.operand2 = operand2;
        this.operation = operation;
        this.difficulty = difficulty;
        this.answer = this.calculateAnswer();
        this.text = this.formatQuestion();
    }

    calculateAnswer() {
        switch (this.operation) {
            case '+': return this.operand1 + this.operand2;
            case '-': return this.operand1 - this.operand2;
            case '×': return this.operand1 * this.operand2;
            case '÷': return this.operand1 / this.operand2;
            default: return 0;
        }
    }

    formatQuestion() {
        return `${this.operand1} ${this.operation} ${this.operand2}`;
    }

    
    static generate(difficulty = 1, operations = ['+', '-', '×', '÷']) {
        
        const MAX_OPERAND = 12;

        const operation = operations[Math.floor(Math.random() * operations.length)];
        
        let operand1, operand2;

        switch (operation) {
            case '+':
                operand1 = Question.randomInt(1, MAX_OPERAND);
                operand2 = Question.randomInt(1, MAX_OPERAND);
                break;
            case '-':
                operand1 = Question.randomInt(1, MAX_OPERAND);
                operand2 = Question.randomInt(1, operand1); 
                break;
            case '×':
                operand1 = Question.randomInt(1, MAX_OPERAND);
                operand2 = Question.randomInt(1, MAX_OPERAND);
                break;
            case '÷': {
              
                operand2 = Question.randomInt(1, MAX_OPERAND);
                const maxQuotient = Math.floor(MAX_OPERAND / operand2);
                const quotient = Question.randomInt(1, maxQuotient);
                operand1 = operand2 * quotient;
                break;
            }
            default:
                operand1 = Question.randomInt(1, MAX_OPERAND);
                operand2 = Question.randomInt(1, MAX_OPERAND);
        }

        return new Question(operand1, operand2, operation, difficulty);
    }

    static generateBatch(count = 5, difficulty = 1, operations = ['+', '-', '×', '÷']) {
        const questions = [];
        for (let i = 0; i < count; i++) {
            questions.push(Question.generate(difficulty, operations));
        }
        return questions;
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    toJSON() {
        return {
            id: this.id,
            text: this.text,
            answer: this.answer,
            difficulty: this.difficulty,
            operation: this.operation,
            operand1: this.operand1,
            operand2: this.operand2
        };
    }
}

module.exports = Question;