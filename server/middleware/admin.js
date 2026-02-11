/**
 * 管理员校验中间件：仅允许 ADMIN_EMAILS 环境变量中配置的邮箱通过
 * 格式：ADMIN_EMAILS=admin@xjtlu.edu.cn,other@xjtlu.edu.cn（逗号分隔，忽略空格）
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function adminMiddleware(req, res, next) {
  if (!req.user?.email) {
    return res.status(401).json({ error: '未登录' });
  }
  const email = String(req.user.email).toLowerCase();
  if (ADMIN_EMAILS.length === 0) {
    return res.status(403).json({ error: '未配置管理员邮箱，请在 ADMIN_EMAILS 中设置' });
  }
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: '无权限访问管理后台' });
  }
  next();
}

export function isAdmin(email) {
  if (!email || ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}
