import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'xjtlu-quiz-helper-secret';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: '未登录或 token 无效' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}
