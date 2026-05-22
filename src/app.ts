import express from 'express';
import cors from 'cors';
import authRoutes from './controllers/authController';
import catalogRoutes from './controllers/catalogController';
import inventoryRoutes from './controllers/inventoryController';
import recipeRoutes from './controllers/recipeController';
import historyRoutes from './controllers/historyController';
import receiptRoutes from './controllers/receiptController';
import deviceRoutes from './controllers/deviceController';
import categoriesRoutes from './controllers/categoriesController';
import donationRoutes from './controllers/donationController';
import { httpLogger } from './middlewares/httpLogger';
import { rootLogger } from './lib/logger';

const app = express();

// Logging de requisições HTTP — deve ser o primeiro middleware
app.use(httpLogger);

app.use(cors());
// Aumentar limite de tamanho para suportar imagens em base64 de cupons fiscais
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rotas
app.use('/auth', authRoutes); 
app.use('/inventory', inventoryRoutes);
app.use('/generate-recipe', recipeRoutes);
app.use('/history', historyRoutes);
app.use('/catalog', catalogRoutes);
app.use('/receipt', receiptRoutes);
app.use('/devices', deviceRoutes);
app.use('/categories', categoriesRoutes);
app.use('/donation', donationRoutes);

// Endpoint de Health-check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Log das rotas registradas
rootLogger.info('Rotas registradas', {
  rotas: [
    'POST /auth/register', 'POST /auth/login', 'GET /auth/me', 'PUT /auth/me',
    'GET|POST /inventory/', 'GET|PATCH|DELETE /inventory/:id',
    'GET /categories/', 'POST /generate-recipe',
    'GET|POST /history/', 'GET /catalog/search', 'GET /catalog/:ean',
    'POST /receipt/scan', 'POST /devices/register', 'GET /health',
    'POST /donation/check', 'POST /donation/suggest'
  ],
});

export default app;