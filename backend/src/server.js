require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] College Result Management System API running on port ${PORT}`);
  });
};

start();

process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});
