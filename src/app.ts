import express from 'express';
import cors from 'cors';
import authRoutes from './controllers/authController';
import inventoryRoutes from './controllers/inventoryController';
import recipeRoutes from './controllers/recipeController';
import categoryRoutes from './controllers/categoryController';
import historyRoutes from './controllers/historyController'

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/generate-recipe', recipeRoutes);
app.use('/categories', categoryRoutes);
app.use('/history', historyRoutes)

// Endpoint de Health-check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;