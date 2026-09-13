const app = require('./app');

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Pharmacy Management API running on port ${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
});
