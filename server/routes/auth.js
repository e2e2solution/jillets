import { Router } from 'express'
import { signToken, requireAuth } from '../middleware/auth.js'
import { asyncHandler, httpError } from '../utils/http.js'
import { ensureUsers, verifyUser } from '../utils/users.js'

const router = Router()

router.post('/login', asyncHandler(async (req, res) => {
  await ensureUsers()
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  const user = await verifyUser(username, password)
  if (!user) throw httpError(401, 'Invalid username or password')
  res.json({
    token: signToken(user),
    username: user.username,
    role: user.role,
    name: user.name
  })
}))

router.get('/me', requireAuth, (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
    name: req.user.name
  })
})

export default router
