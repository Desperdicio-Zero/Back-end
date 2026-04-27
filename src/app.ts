import express from 'express';
import cors from 'cors';
import authRoutes from './controllers/authController';
import catalogRoutes from './controllers/catalogController';
import inventoryRoutes from './controllers/inventoryController';
import recipeRoutes from './controllers/recipeController';
import categoriesRoutes from './controllers/categoriesController';

const app = express();

app.use(cors());
app.use(express.json()); // Para JSON (a maioria das requisições)
app.use(express.urlencoded({ extended: true })); // Importante para o seu login form-urlencoded

// Rotas
app.use('/auth', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/generate-recipe', recipeRoutes);
app.use('/categories', categoriesRoutes);
// Dica: Crie rotas para /history seguindo a mesma lógica

export default app;