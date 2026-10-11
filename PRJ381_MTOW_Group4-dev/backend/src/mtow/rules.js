module.exports = {
    matchDurationSeconds: 60,
    startsInSeconds: 4,             
    questionTimeLimitSeconds: 15,   
    nextQuestionDelaySeconds: 0.5,  
    readyTimeoutSeconds: 8,         

    ropeStep: 0.1,                  
    winThreshold: 1,
    streakForBonus: 3,
    streakMultiplier: 1.5,

    pointsPerCorrect: 10,
    maxSpeedBonus: 5,               
    levelThresholds: [100, 250, 500, 1000, 2000, 4000, 8000], 

    startDifficulty: 1,
    adaptiveWindow: 5,
    raiseAccuracy: 0.8,
    lowerAccuracy: 0.5,
    fastResponseMs: 6000,

    cpuNickname: 'Robo',
    cpuAvatarId: 'cpu',
    historyLimit: 50
};
