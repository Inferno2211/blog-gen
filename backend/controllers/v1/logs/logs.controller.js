const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Get worker logs using PM2
 */
const getLogs = async (req, res) => {
    try {
        // Check NODE_ENV
        const nodeEnv = process.env.NODE_ENV;

        // If production or not present, throw error
        if (!nodeEnv || nodeEnv === 'production') {
            return res.status(403).json({
                success: false,
                message: 'Logs endpoint is only available in development environment'
            });
        }

        // Get lines parameter, default to 50
        const lines = parseInt(req.query.lines) || 50;

        // Validate lines parameter
        if (lines < 1 || lines > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Lines parameter must be between 1 and 1000'
            });
        }

        // Execute PM2 logs command
        const backendCommand = `pm2 logs orbitpbn-test-backend --lines ${lines} --nostream`;
        const workerCommand = `pm2 logs orbitpbn-test-worker --lines ${lines} --nostream`;
        
        const [backendResult, workerResult] = await Promise.all([
            execPromise(backendCommand).catch(err => ({ stdout: '', stderr: err.message })),
            execPromise(workerCommand).catch(err => ({ stdout: '', stderr: err.message }))
        ]);
        
        const backendLogs = backendResult.stdout || backendResult.stderr || '';
        const workerLogs = workerResult.stdout || workerResult.stderr || '';
        
        const rawLogs = `=== Backend Logs ===\n${backendLogs}\n\n=== Worker Logs ===\n${workerLogs}`;
        return res.status(200).json({
            success: true,
            logs: rawLogs.split("\n"),
            lines
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch logs',
            error: error.message
        });
    }
};

module.exports = {
    getLogs
};

