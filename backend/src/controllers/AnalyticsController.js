const {
    renderReportHtml
} = require('../services/ReportRenderer');

// Create filters from the URL
function createFilters(query = {}) {
    const filters = {};

    if (query.includeSample !== undefined) {
        filters.includeSample =
            query.includeSample !== 'false';
    }

    if (query.onlySample !== undefined) {
        filters.onlySample =
            query.onlySample === 'true';
    }

    if (query.player) {
        filters.playerName = String(query.player);
    }

    if (query.from) {
        filters.from = checkDate(
            query.from,
            'from'
        );
    }

    if (query.to) {
        filters.to = checkDate(
            query.to,
            'to',
            true
        );
    }

    if (query.days) {
        filters.days = query.days;
    }

    if (query.limit) {
        filters.limit = query.limit;
    }

    return filters;
}

// Check whether a date is valid
function checkDate(value, name, endOfDay = false) {
    let dateValue = value;

    if (
        endOfDay &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        dateValue =
            `${value}T23:59:59.999+02:00`;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        const error = new Error(
            `Invalid ${name} date. Use YYYY-MM-DD.`
        );

        error.status = 400;
        throw error;
    }

    return date.toISOString();
}

// Handle controller errors
function handle(action) {
    return async function (request, response) {
        try {
            await action(request, response);
        } catch (error) {
            const status = error.status || 500;

            console.error(
                '[Analytics]',
                error.message
            );

            response.status(status).json({
                success: false,
                message:
                    status === 500
                        ? 'Analytics request failed'
                        : error.message
            });
        }
    };
}

// Return all dashboard information
exports.getDashboard = handle(
    async (request, response) => {
        const filters =
            createFilters(request.query);

        const dashboard =
            await request.analytics.getDashboard(filters);

        response.json({
            success: true,
            ...dashboard
        });
    }
);

// Return the main totals
exports.getOverview = handle(
    async (request, response) => {
        const overview =
            await request.analytics.getOverview(
                createFilters(request.query)
            );

        response.json({
            success: true,
            overview
        });
    }
);

// Return results for each operation
exports.getOperations = handle(
    async (request, response) => {
        const operations =
            await request.analytics.getOperationBreakdown(
                createFilters(request.query)
            );

        response.json({
            success: true,
            operations
        });
    }
);

// Return results for each difficulty
exports.getDifficulty = handle(
    async (request, response) => {
        const difficulty =
            await request.analytics.getDifficultyBreakdown(
                createFilters(request.query)
            );

        response.json({
            success: true,
            difficulty
        });
    }
);

// Return progress over time
exports.getTrend = handle(
    async (request, response) => {
        const trend =
            await request.analytics.getTrend(
                createFilters(request.query)
            );

        response.json({
            success: true,
            trend
        });
    }
);

// Return response-time groups
exports.getResponseTimes = handle(
    async (request, response) => {
        const responseTimes =
            await request.analytics.getResponseTimeDistribution(
                createFilters(request.query)
            );

        response.json({
            success: true,
            responseTimes
        });
    }
);

// Return the learner table
exports.getPlayers = handle(
    async (request, response) => {
        const players =
            await request.analytics.getPlayerStats(
                createFilters(request.query)
            );

        response.json({
            success: true,
            players
        });
    }
);

// Return one learner
exports.getPlayerDetail = handle(
    async (request, response) => {
        const player =
            await request.analytics.getPlayerDetail(
                request.params.playerName,
                createFilters(request.query)
            );

        if (!player) {
            return response.status(404).json({
                success: false,
                message:
                    'No analytics found for this learner'
            });
        }

        response.json({
            success: true,
            player
        });
    }
);

// Return the strongest learners
exports.getTopPerformers = handle(
    async (request, response) => {
        const topPerformers =
            await request.analytics.getTopPerformers(
                createFilters(request.query)
            );

        response.json({
            success: true,
            topPerformers
        });
    }
);

// Return recent game activity
exports.getRecentActivity = handle(
    async (request, response) => {
        const recentActivity =
            await request.analytics.getRecentActivity(
                createFilters(request.query)
            );

        response.json({
            success: true,
            recentActivity
        });
    }
);

// Return automatic insights
exports.getInsights = handle(
    async (request, response) => {
        const insights =
            await request.analytics.getInsights(
                createFilters(request.query)
            );

        response.json({
            success: true,
            insights
        });
    }
);

// Return the teacher report
exports.getReport = handle(
    async (request, response) => {
        const report =
            await request.analytics.buildReport(
                createFilters(request.query)
            );

        if (request.query.format === 'html') {
            return response
                .type('html')
                .send(renderReportHtml(report));
        }

        response.json({
            success: true,
            report
        });
    }
);

// Download answer data for Excel
exports.exportCsv = handle(
    async (request, response) => {
        const csv =
            await request.analytics.exportCsv(
                createFilters(request.query)
            );

        const date =
            new Date().toISOString().slice(0, 10);

        response.setHeader(
            'Content-Disposition',
            `attachment; filename="analytics-${date}.csv"`
        );

        response
            .type('text/csv')
            .send('\uFEFF' + csv);
    }
);

// Return storage information
exports.getStatus = handle(
    async (request, response) => {
        response.json({
            success: true,
            status: await request.analytics.getStatus()
        });
    }
);

// Load sample dashboard data
exports.loadSampleData = handle(
    async (request, response) => {
        const counts =
            await request.analytics.loadSample();

        response.status(201).json({
            success: true,
            message: 'Sample data loaded',
            counts
        });
    }
);

// Remove only sample data
exports.clearSampleData = handle(
    async (request, response) => {
        await request.analytics.clearSample();

        response.json({
            success: true,
            message: 'Sample data removed'
        });
    }
);

// Exported for controller tests
exports.createFilters = createFilters;