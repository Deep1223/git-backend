const { runBestsellerJob } = require('./bestsellerJob');
const { runTrendingJob } = require('./trendingJob');
const { runLowStockAlertJob } = require('./lowStockAlertJob');
const { runStorefrontAutoBuilderJob } = require('./storefrontAutoBuilderJob');
const { runOrderAutomationJob } = require('./orderAutomationJob');
const Settings = require('../../modal/settings');

function sanitizeJobIntervalMs(value) {
    const fallback = 60 * 60 * 1000;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 60 * 1000) return fallback;
    return Math.floor(n);
}

async function getEcomJobIntervalMs() {
    try {
        const settings = await Settings.findOne().sort({ _id: 1 }).select('ecom_job_interval_ms').lean();
        return sanitizeJobIntervalMs(settings?.ecom_job_interval_ms);
    } catch (_error) {
        return sanitizeJobIntervalMs(process.env.ECOM_JOB_INTERVAL_MS);
    }
}

async function runAllEcomJobsOnce() {
    const [best, trend, low, home, orders] = await Promise.all([
        runBestsellerJob(),
        runTrendingJob(),
        runLowStockAlertJob(),
        runStorefrontAutoBuilderJob(),
        runOrderAutomationJob(),
    ]);
    return { best, trend, low, home, orders };
}

function startEcomJobs() {
    const scheduleNext = async () => {
        const delay = await getEcomJobIntervalMs();
        setTimeout(async () => {
            await runCycle();
        }, delay);
    };

    const runCycle = async () => {
        runAllEcomJobsOnce().catch((error) => {
            console.error('[ECOM JOBS] run failed:', error.message);
        }).finally(() => {
            scheduleNext().catch((error) => {
                console.error('[ECOM JOBS] reschedule failed:', error.message);
            });
        });
    };

    runCycle();
}

module.exports = { startEcomJobs, runAllEcomJobsOnce };
