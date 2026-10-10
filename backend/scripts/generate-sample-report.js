const fs = require('fs');
const path = require('path');

const analyticsService =
    require('../src/services/AnalyticsService');

const {
    generateSampleData
} = require('../src/services/SampleDataGenerator');

const {
    renderReportHtml
} = require('../src/services/ReportRenderer');

// Load sample analytics data
generateSampleData(analyticsService.store);

// Calculate the report
const report = analyticsService.buildReport({
    onlySample: true
});

// Create the HTML
const html = renderReportHtml(report);

const reportFolder = path.join(
    __dirname,
    '..',
    'reports'
);

const reportPath = path.join(
    reportFolder,
    'sample-teacher-report.html'
);

fs.mkdirSync(reportFolder, {
    recursive: true
});

fs.writeFileSync(
    reportPath,
    html,
    'utf8'
);

console.log(
    `Report created: ${reportPath}`
);