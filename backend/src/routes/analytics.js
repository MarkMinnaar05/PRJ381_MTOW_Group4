const express = require('express');

const analyticsController =
    require('../controllers/AnalyticsController');

const router = express.Router();

// Main dashboard
router.get(
    '/dashboard',
    analyticsController.getDashboard
);

// Summary totals
router.get(
    '/overview',
    analyticsController.getOverview
);

// Mathematical operations
router.get(
    '/operations',
    analyticsController.getOperations
);

// Difficulty levels
router.get(
    '/difficulty',
    analyticsController.getDifficulty
);

// Progress over time
router.get(
    '/trend',
    analyticsController.getTrend
);

// Answer speeds
router.get(
    '/response-times',
    analyticsController.getResponseTimes
);

// Learner table
router.get(
    '/players',
    analyticsController.getPlayers
);

// Top learners
router.get(
    '/top-performers',
    analyticsController.getTopPerformers
);

// Recent games
router.get(
    '/recent-activity',
    analyticsController.getRecentActivity
);

// Automatic insights
router.get(
    '/insights',
    analyticsController.getInsights
);

// Teacher report
router.get(
    '/report',
    analyticsController.getReport
);

// Excel export
router.get(
    '/export.csv',
    analyticsController.exportCsv
);

// Storage status
router.get(
    '/status',
    analyticsController.getStatus
);

// One learner
router.get(
    '/players/:playerName',
    analyticsController.getPlayerDetail
);

// Load sample data
router.post(
    '/sample',
    analyticsController.loadSampleData
);

// Remove sample data
router.delete(
    '/sample',
    analyticsController.clearSampleData
);

module.exports = router;