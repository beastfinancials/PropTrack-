import { useState, useEffect, useCallback } from 'react'
import { signOut, getAccounts, upsertAccount, deleteAccount, getTransactions, addTransaction, deleteTransaction } from '../lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import Confetti from 'react-confetti'

const STATUS_OPTIONS = ['evaluation','funded','payout_ready','passed','blown','inactive']
const STATUS_LABELS = { evaluation:'In Evaluation', funded:'Funded', payout_ready:'Payout Ready 💸', passed:'Passed ✓', blown:'Blown ✗', inactive:'Inactive' }
const FIRMS = ['My Funded Futures','Topstep','Take Profit Trader','Apex','Bulenox','MFFU','FTMO','Phidias','Other']

const CELEBRATION_CONFIG = {
  funded: { emoji: '🚀', title: 'YOU GOT FUNDED!', sub: 'Account is live. Time to print.' },
  payout_ready: { emoji: '💸', title: 'PAYOUT READY!', sub: 'Go get that bag. You earned it.' },
  passed: { emoji: '🏆', title: 'CHALLENGE PASSED!', sub: 'Another one in the books.' },
}

export default function Dashboard({ session }) {
  const [view, setView] = useState('overview')
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [form, setForm] = useState({})
  const [txForm, setTxForm] = useState({ type: 'spent', firm: '', amount: '', note: '' })

  const userId = session.user.id
  const userEmail = session.user.email

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [accs, txs] = await Promise.all([getAccounts(userId), getTransactions(userId)])
      setAccounts(accs || [])
      setTransactions(txs || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const triggerCelebration = (status) => {
    const cfg = CELEBRATION_CONFIG[status]
    if (!cfg) return
    setCelebration(cfg)
    setConfetti(true)
    setTimeout(() => setConfetti(false), 4000)
  }

  const openAdd = () => {
    setForm({ firm: 'My Funded Futures', plan: '', size: '', status: 'evaluation', notes: '', days_complete: 0, days_required: '', profit: '', eval_cost: '' })
    setEditingAccount(null)
    setShowAccountModal(true)
  }

  const openEdit = (acc) => {
    setForm({ ...acc })
    setEditingAccount(acc)
    setShowAccountModal(true)
  }

  const submitAccount = async () => {
    if (!form.firm) return
    const prev = editingAccount
    const payload = {
      ...form,
      id: editingAccount?.id || undefined,
      user_id: userId,
      size: form.size ? Number(form.size) : null,
      days_complete: Number(form.days_complete) || 0,
      days_required: form.days_required ? Number(form.days_required) : null,
      profit: form.profit ? Number(form.profit) : null,
      eval_cost: form.eval_cost ? Number(form.eval_cost) : null,
    }
    const saved = await upsertAccount(payload)
    if (saved) {
      // Auto-log eval cost as transaction if new account with cost
      if (!editingAccount && payload.eval_cost) {
        await addTransaction({ user_id: userId, type: 'spent', firm: payload.firm, amount: payload.eval_cost, note: `${payload.plan} eval fee` })
      }
      if (prev && prev.status !== form.status) triggerCelebration(form.status)
      if (!prev) triggerCelebration(form.status)
    }
    setShowAccountModal(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return
    await deleteAccount(id)
    load()
  }

  const incrementDay = async (acc) => {
    const newDays = (acc.days_complete || 0) + 1
    const required = acc.days_required
    let newStatus = acc.status
    if (required && newDays >= required && acc.status === 'evaluation') {
      newStatus = 'funded'
      triggerCelebration('funded')
    } else if (required && newDays >= required && acc.status === 'funded') {
      newStatus = 'payout_ready'
      triggerCelebration('payout_ready')
    }
    await upsertAccount({ ...acc, days_complete: newDays, status: newStatus })
    load()
  }

  const markStatus = async (acc, status) => {
    await upsertAccount({ ...acc, status })
    triggerCelebration(status)
    load()
  }

  const submitTx = async () => {
    if (!txForm.amount || !txForm.firm) return
    await addTransaction({ user_id: userId, type: txForm.type, firm: txForm.firm, amount: Number(txForm.amount), note: txForm.note })
    setShowTxModal(false)
    setTxForm({ type: 'spent', firm: '', amount: '', note: '' })
    load()
  }

  // Stats
  const totalSpent = transactions.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0)
  const totalEarned = transactions.filter(t => t.type === 'earned').reduce((s, t) => s + t.amount, 0)
  const roi = totalSpent > 0 ? (((totalEarned - totalSpent) / totalSpent) * 100).toFixed(1) : 0
  const fundedCapital = accounts.filter(a => ['funded','payout_ready'].includes(a.status)).reduce((s, a) => s + (a.size || 0), 0)
  const activeEvals = accounts.filter(a => a.status === 'evaluation').length

  // Chart data - last 8 transactions as running balance
  const chartData = (() => {
    let running = 0
    return [...transactions].reverse().slice(-12).map(t => {
      running += t.type === 'earned' ? t.amount : -t.amount
      return { date: format(new Date(t.created_at), 'MMM d'), balance: running }
    })
  })()

  const pieData = [
    { name: 'Spent', value: totalSpent, color: '#f97316' },
    { name: 'Earned', value: totalEarned, color: '#10b981' },
  ].filter(d => d.value > 0)

  const grouped = {
    payout_ready: accounts.filter(a => a.status === 'payout_ready'),
    funded: accounts.filter(a => a.status === 'funded'),
    evaluation: accounts.filter(a => a.status === 'evaluation'),
    other: accounts.filter(a => ['passed','blown','inactive'].includes(a.status)),
  }

  const nav = [
    { key: 'overview', icon: '◈', label: 'Overview' },
    { key: 'accounts', icon: '⬡', label: 'Accounts' },
    { key: 'finance', icon: '◎', label: 'Finance' },
  ]

  return (
    <div className="dashboard">
      {confetti && <Confetti recycle={false} numberOfPieces={300} colors={['#8b5cf6','#2dd4bf','#f97316','#ec4899','#fbbf24']} />}

      {/* Celebration Modal */}
      {celebration && (
        <div className="celebration-overlay" onClick={() => setCelebration(null)}>
          <div className="celebration-card" onClick={e => e.stopPropagation()}>
            <div className="celebration-emoji">{celebration.emoji}</div>
            <div className="celebration-title">{celebration.title}</div>
            <div className="celebration-sub">{celebration.sub}</div>
            <button className="btn-close-celeb" onClick={() => setCelebration(null)}>LET'S GO 🔥</button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">PROPVAULT</div>
        <nav className="sidebar-nav">
          {nav.map(n => (
            <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => setView(n.key)}>
              <span className="nav-icon">{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-email">{userEmail}</div>
          <button className="btn-signout" onClick={signOut}>SIGN OUT →</button>
        </div>
      </div>

      {/* Main */}
      <div className="main-content">
        {loading ? (
          <div className="empty-state"><div className="empty-icon">⟳</div><div className="empty-text">Loading...</div></div>
        ) : view === 'overview' ? (
          <OverviewView accounts={accounts} transactions={transactions} stats={{ totalSpent, totalEarned, roi, fundedCapital, activeEvals }} chartData={chartData} pieData={pieData} grouped={grouped} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} openAdd={openAdd} />
        ) : view === 'accounts' ? (
          <AccountsView accounts={accounts} grouped={grouped} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} openAdd={openAdd} />
        ) : (
          <FinanceView transactions={transactions} stats={{ totalSpent, totalEarned, roi }} chartData={chartData} pieData={pieData} setShowTxModal={setShowTxModal} deleteTransaction={async (id) => { await deleteTransaction(id); load() }} />
        )}
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingAccount ? 'Edit Account' : '+ New Account'}</div>
            {[
              { key: 'firm', label: 'Firm', type: 'select', options: FIRMS },
              { key: 'plan', label: 'Plan / Label', type: 'text', placeholder: 'e.g. Pro 150K' },
              { key: 'size', label: 'Account Size ($)', type: 'number', placeholder: '150000' },
              { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, labels: STATUS_LABELS },
              { key: 'days_complete', label: 'Profitable Days Complete', type: 'number', placeholder: '0' },
              { key: 'days_required', label: 'Days Required (blank = N/A)', type: 'number', placeholder: '5' },
              { key: 'profit', label: 'Current P&L ($)', type: 'number', placeholder: '0' },
              { key: 'eval_cost', label: 'Eval Cost / Monthly Fee ($)', type: 'number', placeholder: '229' },
              { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Any notes...' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="form-select" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    {f.options.map(o => <option key={o} value={o}>{f.labels ? f.labels[o] : o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" type={f.type} value={form[f.key] || ''} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAccountModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitAccount}>{editingAccount ? 'SAVE CHANGES' : 'ADD ACCOUNT'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Log Transaction</div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value }))}>
                <option value="spent">Spent (eval fee, subscription)</option>
                <option value="earned">Earned (payout)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Firm</label>
              <select className="form-select" value={txForm.firm} onChange={e => setTxForm(p => ({ ...p, firm: e.target.value }))}>
                <option value="">Select firm...</option>
                {FIRMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Amount ($)</label>
              <input className="form-input" type="number" value={txForm.amount} placeholder="0"
                onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input className="form-input" type="text" value={txForm.note} placeholder="e.g. Monthly sub, Payout #3"
                onChange={e => setTxForm(p => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowTxModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitTx}>LOG IT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function AccountCard({ acc, incrementDay, markStatus, openEdit, handleDelete }) {
  const progress = acc.days_required ? Math.min((acc.days_complete || 0) / acc.days_required * 100, 100) : null
  const daysLeft = acc.days_required ? Math.max(acc.days_required - (acc.days_complete || 0), 0) : null

  return (
    <div className={`account-card status-${acc.status}`}>
      <div className="acc-header">
        <div>
          <div className="acc-firm">{acc.firm}</div>
          <div className="acc-plan">{acc.plan}</div>
        </div>
        <span className={`status-badge badge-${acc.status}`}>{STATUS_LABELS[acc.status]}</span>
      </div>
      {acc.size && <div className="acc-size">${Number(acc.size).toLocaleString()}</div>}
      {acc.profit > 0 && <div className="acc-profit">P&L: +${Number(acc.profit).toLocaleString()}</div>}
      {acc.notes && <div className="acc-notes">{acc.notes}</div>}
      {progress !== null && (
        <>
          <div className="progress-row">
            <span>Day {acc.days_complete || 0} of {acc.days_required}</span>
            <span>{daysLeft > 0 ? `${daysLeft} to go` : '✓ Complete'}</span>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill ${progress >= 100 ? 'fill-done' : acc.status === 'funded' ? 'fill-funded' : 'fill-eval'}`}
              style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
      <div className="acc-actions">
        {(acc.status === 'evaluation' || acc.status === 'funded') && (
          <button className="btn-sm btn-day" onClick={() => incrementDay(acc)}>+ Day</button>
        )}
        {acc.status === 'funded' && (
          <button className="btn-sm btn-payout" onClick={() => markStatus(acc, 'payout_ready')}>Mark Payout Ready</button>
        )}
        {acc.status === 'payout_ready' && (
          <button className="btn-sm btn-day" onClick={() => markStatus(acc, 'funded')}>Payout Requested</button>
        )}
        <button className="btn-sm btn-edit" onClick={() => openEdit(acc)}>Edit</button>
        <button className="btn-sm btn-delete" onClick={() => handleDelete(acc.id)}>✕</button>
      </div>
    </div>
  )
}

function OverviewView({ accounts, stats, chartData, pieData, grouped, incrementDay, markStatus, openEdit, handleDelete, openAdd }) {
  const { totalSpent, totalEarned, roi, fundedCapital, activeEvals } = stats
  const roiNum = parseFloat(roi)

  return (
    <>
      <div className="page-title">Overview</div>
      <div className="page-sub">Your prop trading empire at a glance</div>

      <div className="stats-grid">
        <StatCard label="Funded Capital" value={fundedCapital ? `$${fundedCapital.toLocaleString()}` : '—'} color="teal" sub={`${accounts.filter(a=>['funded','payout_ready'].includes(a.status)).length} live accounts`} />
        <StatCard label="Active Evals" value={activeEvals} color="coral" sub="in progress" />
        <StatCard label="Total Earned" value={totalEarned ? `$${totalEarned.toLocaleString()}` : '$0'} color="green" sub="from payouts" />
        <StatCard label="ROI" value={totalSpent > 0 ? `${roiNum > 0 ? '+' : ''}${roi}%` : '—'} color={roiNum >= 0 ? 'green' : 'purple'} sub={`$${totalSpent.toLocaleString()} invested`} />
      </div>

      <div className="two-col">
        {/* P&L Chart */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Running Balance</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: '#0e1521', border: '1px solid #1e2d45', borderRadius: 8, fontFamily: 'DM Mono' }} formatter={v => [`$${v}`, 'Balance']} />
                <Area type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={2} fill="url(#grad1)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding: 40 }}><div className="empty-text">Log transactions to see your chart</div></div>}
        </div>

        {/* Pie */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="section-title" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>Investment vs Returns</div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0e1521', border: '1px solid #1e2d45', borderRadius: 8 }} formatter={v => `$${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    {d.name}: ${d.value.toLocaleString()}
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty-state" style={{ padding: 40 }}><div className="empty-text">No financial data yet</div></div>}
        </div>
      </div>

      {/* Urgent accounts - payout ready and close to payout */}
      {grouped.payout_ready.length > 0 && (
        <>
          <div className="group-label">💸 Payout Ready</div>
          <div className="accounts-grid" style={{ marginBottom: 20 }}>
            {grouped.payout_ready.map(acc => <AccountCard key={acc.id} acc={acc} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} />)}
          </div>
        </>
      )}
      {grouped.funded.length > 0 && (
        <>
          <div className="group-label">✅ Funded</div>
          <div className="accounts-grid" style={{ marginBottom: 20 }}>
            {grouped.funded.map(acc => <AccountCard key={acc.id} acc={acc} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} />)}
          </div>
        </>
      )}

      <div className="section-header" style={{ marginTop: 8 }}>
        <div className="group-label" style={{ margin: 0 }}>🔄 Active Evals</div>
        <button className="btn-add" onClick={openAdd}>+ Add Account</button>
      </div>
      {grouped.evaluation.length > 0 ? (
        <div className="accounts-grid">
          {grouped.evaluation.map(acc => <AccountCard key={acc.id} acc={acc} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} />)}
        </div>
      ) : (
        <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">No active evaluations. Add one above.</div></div>
      )}
    </>
  )
}

function AccountsView({ accounts, grouped, incrementDay, markStatus, openEdit, handleDelete, openAdd }) {
  return (
    <>
      <div className="section-header">
        <div><div className="page-title">Accounts</div><div className="page-sub">All {accounts.length} accounts</div></div>
        <button className="btn-add" onClick={openAdd}>+ Add Account</button>
      </div>
      {[
        { key: 'payout_ready', label: '💸 Payout Ready' },
        { key: 'funded', label: '✅ Funded' },
        { key: 'evaluation', label: '🔄 In Evaluation' },
        { key: 'other', label: '📁 Archive' },
      ].map(s => grouped[s.key]?.length > 0 && (
        <div key={s.key}>
          <div className="group-label">{s.label}</div>
          <div className="accounts-grid" style={{ marginBottom: 24 }}>
            {grouped[s.key].map(acc => <AccountCard key={acc.id} acc={acc} incrementDay={incrementDay} markStatus={markStatus} openEdit={openEdit} handleDelete={handleDelete} />)}
          </div>
        </div>
      ))}
      {accounts.length === 0 && <div className="empty-state"><div className="empty-icon">🏦</div><div className="empty-text">No accounts yet. Add your first one.</div></div>}
    </>
  )
}

function FinanceView({ transactions, stats, chartData, pieData, setShowTxModal, deleteTransaction }) {
  const { totalSpent, totalEarned, roi } = stats
  const net = totalEarned - totalSpent
  const roiNum = parseFloat(roi)

  return (
    <>
      <div className="section-header">
        <div><div className="page-title">Finance</div><div className="page-sub">Track your investment vs returns</div></div>
        <button className="btn-add" onClick={() => setShowTxModal(true)}>+ Log Transaction</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        <StatCard label="Total Invested" value={`$${totalSpent.toLocaleString()}`} color="coral" sub="eval fees + subs" />
        <StatCard label="Total Earned" value={`$${totalEarned.toLocaleString()}`} color="green" sub="payouts received" />
        <StatCard label="Net P&L" value={`${net >= 0 ? '+' : ''}$${net.toLocaleString()}`} color={net >= 0 ? 'teal' : 'purple'} sub={`${roiNum > 0 ? '+' : ''}${roi}% ROI`} />
      </div>

      <div className="two-col" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 20 }}>Running Balance</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6080', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: '#0e1521', border: '1px solid #1e2d45', borderRadius: 8 }} formatter={v => [`$${v}`, 'Balance']} />
                <Area type="monotone" dataKey="balance" stroke="#2dd4bf" strokeWidth={2} fill="url(#grad2)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding: 40 }}><div className="empty-text">Log transactions to see chart</div></div>}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="section-title" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>Breakdown</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0e1521', border: '1px solid #1e2d45', borderRadius: 8 }} formatter={v => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><div className="empty-text">No data yet</div></div>}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>Transaction History</div>
        {transactions.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No transactions yet. Log your first eval fee or payout.</div></div>
        ) : transactions.map(tx => (
          <div className="tx-row" key={tx.id}>
            <div className="tx-left">
              <div className="tx-firm">{tx.firm} {tx.note && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {tx.note}</span>}</div>
              <div className="tx-date">{format(new Date(tx.created_at), 'MMM d, yyyy')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={`tx-amount ${tx.type}`}>{tx.type === 'spent' ? '-' : '+'}${Number(tx.amount).toLocaleString()}</div>
              <button onClick={() => deleteTransaction(tx.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
