import jwt from 'jsonwebtoken'

export function signToken(user) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return jwt.sign(
    { sub: user.username, role: user.role, name: user.name || user.username },
    secret,
    { expiresIn: '7d' }
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: 'Login required' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      username: payload.sub,
      role: payload.role || 'admin',
      name: payload.name || payload.sub
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Session expired' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Login required' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed for this account' })
    }
    return next()
  }
}
