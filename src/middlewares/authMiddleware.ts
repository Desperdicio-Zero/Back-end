import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chave-super-secreta';

// Estende a tipagem padrão do Express para incluir o userId
export interface AuthRequest extends Request {
  userId?: number;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // O front-end envia o token no cabeçalho: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ detail: 'Token de autenticação não fornecido.' });
    return;
  }

  // Separa o "Bearer" do token em si
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ detail: 'Formato de token inválido.' });
    return;
  }

  const token = parts[1];

  try {
    // Verifica e decodifica o token usando a chave secreta
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    // Injeta o ID do usuário na requisição para que os controllers possam usar
    req.userId = decoded.userId;
    
    // Passa a bola para o controller da rota
    next();
  } catch (error) {
    res.status(401).json({ detail: 'Token expirado ou inválido.' });
    return;
  }
};  