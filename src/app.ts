import express from 'express';
import cors from 'cors';
import authRoutes from './controllers/authController';
import catalogRoutes from './controllers/catalogController';
import inventoryRoutes from './controllers/inventoryController';
import recipeRoutes from './controllers/recipeController';
import categoryRoutes from './controllers/categoryController';
import historyRoutes from './controllers/historyController';
import receiptRoutes from './controllers/receiptController';
import deviceRoutes from './controllers/deviceController';
import categoriesRoutes from './controllers/categoriesController';

const app = express();

app.use(cors());
// Aumentar limite de tamanho para suportar imagens em base64 de cupons fiscais
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rotas
app.use('/auth', authRoutes); 
app.use('/inventory', inventoryRoutes);
app.use('/generate-recipe', recipeRoutes);
app.use('/categories', categoryRoutes);
app.use('/history', historyRoutes);
app.use('/catalog', catalogRoutes);
app.use('/receipt', receiptRoutes);
app.use('/devices', deviceRoutes);
app.use('/categories', categoriesRoutes);

// Endpoint de Health-check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Dica: Crie rotas para /history seguindo a mesma lógica

export default app;