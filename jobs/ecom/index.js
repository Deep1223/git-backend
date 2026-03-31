const { runBestsellerJob } = require('./bestsellerJob');
const { runTrendingJob } = require('./trendingJob');
const { runLowStockAlertJob } = require('./lowStockAlertJob');
const { runStorefrontAutoBuilderJob } = require('./storefrontAutoBuilderJob');

async function runAllEcomJobsOnce() {
    const [best, trend, low, home] = await Promise.all([
        runBestsellerJob(),
        runTrendingJob(),
        runLowStockAlertJob(),
        runStorefrontAutoBuilderJob(),
    ]);
    return { best, trend, low, home };
}

function startEcomJobs() {
    const hourly = Number(process.env.ECOM_JOB_INTERVAL_MS || 60 * 60 * 1000);
    runAllEcomJobsOnce().catch((error) => {
        console.error('[ECOM JOBS] initial run failed:', error.message);
    });
    setInterval(() => {
        runAllEcomJobsOnce().catch((error) => {
            console.error('[ECOM JOBS] recurring run failed:', error.message);
        });
    }, hourly);
}

module.exports = { startEcomJobs, runAllEcomJobsOnce };
