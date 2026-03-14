import express from 'express';
import cors from 'cors';
import { getDb } from './db.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import warehousesRouter from './routes/warehouses.js';
import alertsRouter from './routes/alerts.js';
import receiptsRouter from './routes/receipts.js';
import deliveriesRouter from './routes/deliveries.js';
import transfersRouter from './routes/transfers.js';
import adjustmentsRouter from './routes/adjustments.js';
import ledgerRouter from './routes/ledger.js';
import authRouter from './auth.js';
import dashboardRouter from './routes/dashboard.js';

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
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/deliveries', deliveriesRouter);
  app.use('/api/transfers', transfersRouter);
  app.use('/api/adjustments', adjustmentsRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);

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
