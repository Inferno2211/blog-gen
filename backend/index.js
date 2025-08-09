const express = require('express');
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
const { errorHandler } = require('./services/errors');

app.use(express.json());
dotenv.config({ silent: true });

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

const appRoutes = require('./routes/index.js');
app.use('/api', appRoutes);

app.get('/', (req, res) => {
    res.send('API is live, check /docs for documentation');
});

// Central error handler (must be after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
