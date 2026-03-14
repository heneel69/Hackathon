import express from 'express';
import cors from 'cors';
import { getDb } from './db.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import warehousesRouter from './routes/warehouses.js';
import alertsRouter from './routes/alerts.js';
import authRouter from './auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize DB before starting
async function start() {
  await getDb();

  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/warehouses', warehousesRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/auth', authRouter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`IMS API server running on http://localhost:${PORT}`);
    });
  }
}

start().catch(console.error);

export default app;
