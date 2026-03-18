const KEY = 'fintrack-lite-transactions';
const seed = [
  { id: crypto.randomUUID(), title: 'Salary', amount: 55000, type: 'income', category: 'Salary', date: '2026-03-01' },
  { id: crypto.randomUUID(), title: 'Groceries', amount: 3200, type: 'expense', category: 'Food', date: '2026-03-04' },
  { id: crypto.randomUUID(), title: 'Fuel', amount: 1800, type: 'expense', category: 'Transport', date: '2026-03-05' }
];

let transactions = JSON.parse(localStorage.getItem(KEY) || 'null') || seed;
const summary = document.getElementById('summary');
const list = document.getElementById('list');
const form = document.getElementById('txnForm');
const chart = document.getElementById('chart');
const ctx = chart.getContext('2d');

function money(v) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(transactions));
}

function totals() {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function renderSummary() {
  const t = totals();
  const monthlyExpenses = transactions.filter((x) => x.type === 'expense').length;
  summary.innerHTML = `
    <article class="card"><h3>Balance</h3><strong>${money(t.balance)}</strong></article>
    <article class="card"><h3>Income</h3><strong>${money(t.income)}</strong></article>
    <article class="card"><h3>Expense</h3><strong>${money(t.expense)}</strong></article>
    <article class="card"><h3>Expense Entries</h3><strong>${monthlyExpenses}</strong></article>
  `;
}

function renderList() {
  list.innerHTML = transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((t) => `
      <article class="row">
        <div>
          <strong>${t.title}</strong><br />
          <small>${t.category} - ${t.date}</small>
        </div>
        <span class="amt ${t.type}">${t.type === 'expense' ? '-' : '+'}${money(t.amount)}</span>
      </article>
    `)
    .join('');
}

function renderChart() {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const grouped = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  const width = chart.width;
  const height = chart.height;
  ctx.clearRect(0, 0, width, height);

  if (!entries.length) return;

  const max = Math.max(...entries.map(([, v]) => v));
  const barWidth = Math.min(90, Math.floor(width / (entries.length * 1.5)));

  entries.forEach(([cat, value], i) => {
    const x = 40 + i * (barWidth + 30);
    const barHeight = Math.max(10, Math.round((value / max) * (height - 80)));
    const y = height - barHeight - 35;

    ctx.fillStyle = '#0f766e';
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#364152';
    ctx.font = '14px Outfit';
    ctx.fillText(cat, x, height - 10);
    ctx.fillText(String(value), x, y - 8);
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  transactions.push({
    id: crypto.randomUUID(),
    title: String(data.get('title')),
    amount: Number(data.get('amount')),
    type: String(data.get('type')),
    category: String(data.get('category')),
    date: String(data.get('date'))
  });
  form.reset();
  persist();
  render();
});

function render() {
  renderSummary();
  renderList();
  renderChart();
}

render();
persist();
