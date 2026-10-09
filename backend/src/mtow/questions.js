const OPERAND_MIN = [1, 1, 2, 5, 10];
const NUMBER_MAX = [10, 20, 50, 100, 100];
const RECENT = 8;

function solve(a, b, operation) {
    return operation === '+' ? a + b : a - b;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

class QuestionGenerator {
    constructor() {
        this.nextId = 1;
        this.turn = 0;
        this.recent = [];
    }

    next(difficulty) {
        const level = Math.max(1, Math.min(5, difficulty)) - 1;
        const min = OPERAND_MIN[level];
        const max = NUMBER_MAX[level];
        const operation = this.turn++ % 2 === 0 ? '+' : '-';

        let a, b, key;
        for (let attempt = 0; attempt < 30; attempt++) {
            if (operation === '+') {
                a = randomInt(min, max - min);
                b = randomInt(min, max - a);
            } else {
                a = randomInt(min + 1, max);
                b = randomInt(min, a - 1);
            }
            key = `${a}${operation}${b}`;
            if (!this.recent.includes(key)) break;
        }
        this.recent.push(key);
        if (this.recent.length > RECENT) this.recent.shift();

        return { operandA: a, operandB: b, operation, questionId: this.nextId++ };
    }
}

module.exports = { QuestionGenerator, solve };
