import { createApp } from './app';

const PORT = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Lab Equipment Checkout API listening on http://localhost:${PORT}`);
  console.log('Health: GET /health — pass X-User-Id header for /api/*');
});
