import { useState } from 'react'
import { signUpEmail, signInEmail, signInGoogle } from '../lib/supabase'

export default function AuthPage() {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handle = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (tab === 'signin') {
        const { error } = await signInEmail(email, password)
        if (error) throw error
      } else {
        const { error } = await signUpEmail(email, password)
        if (error) throw error
        setSuccess('Check your email to confirm your account!')
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInGoogle()
    if (error) setError(error.message)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">PROPVAULT</div>
        <div className="auth-tagline">TRACK YOUR FUNDED EMPIRE</div>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => setTab('signin')}>Sign In</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
        </div>
        <div className="auth-input-group">
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="trader@email.com" onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <div className="auth-input-group">
          <label className="auth-label">Password</label>
          <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        {error && <div className="auth-error">{error}</div>}
        {success && <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 10, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{success}</div>}
        <button className="btn-primary" onClick={handle} disabled={loading}>
          {loading ? '...' : tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
        <div className="auth-divider">or</div>
        <button className="btn-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
