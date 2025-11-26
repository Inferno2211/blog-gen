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
        const command = `pm2 logs orbitpbn-test-backend --lines ${lines} --nostream`;
        const { stdout, stderr } = await execPromise(command);

        // Return logs
        return res.status(200).json({
            success: true,
            logs: stdout || stderr,
            lines: lines
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

