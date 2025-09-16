const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
const { errorHandler } = require('./services/errors');
const StartupService = require('./services/StartupService');

// Load environment variables first
dotenv.config({ silent: true });

// CORS configuration
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

// Apply JSON parsing middleware to all routes EXCEPT webhooks
app.use('/api/v1/purchase/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const appRoutes = require('./routes/index.js');
app.use('/api', appRoutes);

app.get('/', (req, res) => {
    res.send('API is live, check /docs for documentation');
});

// Central error handler (must be after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize startup service and start server
async function startServer() {
    try {
        const startupService = new StartupService();
        await startupService.initialize();
        
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Visit http://localhost:${PORT} to access the API`);
        });

    } catch (error) {
        console.error('Failed to start server:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}


startServer();
