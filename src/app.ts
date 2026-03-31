import express from 'express';
import cors from 'cors';
import authRoutes from './controllers/authController';
import inventoryRoutes from './controllers/inventoryController';
import recipeRoutes from './controllers/recipeController';

const app = express();

app.use(cors());
app.use(express.json()); // Para JSON (a maioria das requisições)
app.use(express.urlencoded({ extended: true })); // Importante para o seu login form-urlencoded

// Rotas
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/generate-recipe', recipeRoutes);
// Dica: Crie rotas para /history e /categories seguindo a mesma lógica

export default app;