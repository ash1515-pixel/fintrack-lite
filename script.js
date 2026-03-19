const TXN_KEY = 'fintrack-lite-transactions-v3';
const BUDGET_KEY = 'fintrack-lite-budgets-v2';

const seed = [
  { id: crypto.randomUUID(), title: 'Salary', amount: 55000, type: 'income', category: 'Salary', date: '2026-03-01' },
  { id: crypto.randomUUID(), title: 'Groceries', amount: 3200, type: 'expense', category: 'Food', date: '2026-03-04' },
  { id: crypto.randomUUID(), title: 'Fuel', amount: 1800, type: 'expense', category: 'Transport', date: '2026-03-05' }
];

let transactions = JSON.parse(localStorage.getItem(TXN_KEY) || 'null') || seed;
let budgets = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}');

const refs = {
  summary: document.getElementById('summary'),
  list: document.getElementById('list'),
  txnForm: document.getElementById('txnForm'),
  budgetForm: document.getElementById('budgetForm'),
  budgetList: document.getElementById('budgetList'),
  aiInsights: document.getElementById('aiInsights'),
  aiInsightsBtn: document.getElementById('aiInsightsBtn'),
  smartBudgetBtn: document.getElementById('smartBudgetBtn'),
  monthFilter: document.getElementById('monthFilter'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  chart: document.getElementById('chart')
};

const ctx = refs.chart.getContext('2d');

function persist() {
  localStorage.setItem(TXN_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function money(v) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(v);
}

function monthOf(dateString) {
  return dateString.slice(0, 7);
}

function visibleTransactions() {
  const month = refs.monthFilter.value;
  if (!month) return transactions;
  return transactions.filter((t) => monthOf(t.date) === month);
}

function totals(list) {
  const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate = income ? Math.round(((income - expense) / income) * 100) : 0;
  return { income, expense, balance: income - expense, savingsRate };
}

function renderSummary(list) {
  const t = totals(list);
  refs.summary.innerHTML = `
    <article class="card"><h3>Balance</h3><strong>${money(t.balance)}</strong></article>
    <article class="card"><h3>Income</h3><strong>${money(t.income)}</strong></article>
    <article class="card"><h3>Expense</h3><strong>${money(t.expense)}</strong></article>
    <article class="card"><h3>Savings Rate</h3><strong>${t.savingsRate}%</strong></article>
    <article class="card"><h3>Entries</h3><strong>${list.length}</strong></article>
  `;
}

function renderList(list) {
  refs.list.innerHTML = list
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((t) => `
      <article class="row">
        <div>
          <strong>${t.title}</strong><br />
          <small>${t.category} - ${t.date}</small>
        </div>
        <div class="meta-actions">
          <span class="amt ${t.type}">${t.type === 'expense' ? '-' : '+'}${money(t.amount)}</span>
          <button class="delete" data-id="${t.id}" type="button">Delete</button>
        </div>
      </article>
    `)
    .join('');
}

function expenseByCategory(list) {
  return list
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
}

function renderBudgetList(categoryTotals) {
  const categories = Object.keys(budgets);
  if (!categories.length) {
    refs.budgetList.innerHTML = '<p>No budgets set yet.</p>';
    return;
  }

  refs.budgetList.innerHTML = categories
    .map((category) => {
      const budget = Number(budgets[category] || 0);
      const used = Number(categoryTotals[category] || 0);
      const pct = budget ? Math.min(100, Math.round((used / budget) * 100)) : 0;
      return `
        <article class="budget-item">
          <strong>${category}</strong>
          <div>${money(used)} / ${money(budget)}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
        </article>
      `;
    })
    .join('');
}

function renderChart(categoryTotals) {
  const entries = Object.entries(categoryTotals);
  const width = refs.chart.width;
  const height = refs.chart.height;
  ctx.clearRect(0, 0, width, height);
  if (!entries.length) return;

  const max = Math.max(...entries.map(([, val]) => val));
  const barWidth = Math.min(90, Math.floor(width / (entries.length * 1.4)));

  entries.forEach(([category, value], i) => {
    const x = 30 + i * (barWidth + 24);
    const barHeight = Math.max(12, Math.round((value / max) * (height - 80)));
    const y = height - barHeight - 32;

    ctx.fillStyle = '#0f766e';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#374151';
    ctx.font = '13px Outfit';
    ctx.fillText(category, x, height - 12);
    ctx.fillText(String(value), x, y - 6);
  });
}

function generateAIInsights() {
  const list = visibleTransactions();
  const t = totals(list);
  const categories = expenseByCategory(list);
  const topCategoryEntry = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? topCategoryEntry[0] : 'N/A';
  const topValue = topCategoryEntry ? topCategoryEntry[1] : 0;

  const tips = [];
  tips.push(`Cashflow check: Savings rate is ${t.savingsRate}% for selected month.`);
  tips.push(`Highest expense bucket: ${topCategory} (${money(topValue)}).`);

  if (t.savingsRate < 25) tips.push('Action: Try cutting 10-15% from non-essential expenses this month.');
  if (t.expense > t.income) tips.push('Risk: Expenses are higher than income. Freeze low-priority spending now.');

  const budgetWarnings = Object.keys(budgets)
    .map((cat) => {
      const used = categories[cat] || 0;
      const budget = Number(budgets[cat] || 0);
      if (!budget) return null;
      const pct = Math.round((used / budget) * 100);
      return pct >= 100 ? `${cat} is at ${pct}% of budget` : null;
    })
    .filter(Boolean);

  if (budgetWarnings.length) tips.push(`Budget alert: ${budgetWarnings.join(', ')}.`);
  tips.push('AI next step: Review top 3 expenses and set reminder to log transactions daily.');

  refs.aiInsights.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join('');
}

function applySmartBudget() {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const grouped = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  Object.entries(grouped).forEach(([category, amount]) => {
    budgets[category] = Math.round(amount * 1.1);
  });

  persist();
  render();
  refs.aiInsights.innerHTML = '<li>AI Smart Budget applied: each category budget set to 110% of observed expense trend.</li>';
}

function exportCsv() {
  const header = 'title,amount,type,category,date';
  const rows = transactions.map((t) => [t.title, t.amount, t.type, t.category, t.date].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fintrack-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function render() {
  const list = visibleTransactions();
  const categories = expenseByCategory(list);
  renderSummary(list);
  renderList(list);
  renderBudgetList(categories);
  renderChart(categories);
}

refs.txnForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(refs.txnForm);
  transactions.push({
    id: crypto.randomUUID(),
    title: String(data.get('title')),
    amount: Number(data.get('amount')),
    type: String(data.get('type')),
    category: String(data.get('category')),
    date: String(data.get('date'))
  });
  refs.txnForm.reset();
  persist();
  render();
  generateAIInsights();
});

refs.budgetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(refs.budgetForm);
  budgets[String(data.get('category'))] = Number(data.get('amount'));
  refs.budgetForm.reset();
  persist();
  render();
});

refs.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button.delete');
  if (!btn) return;
  const id = btn.dataset.id;
  transactions = transactions.filter((t) => t.id !== id);
  persist();
  render();
  generateAIInsights();
});

refs.monthFilter.addEventListener('change', () => {
  render();
  generateAIInsights();
});
refs.exportCsvBtn.addEventListener('click', exportCsv);
refs.aiInsightsBtn.addEventListener('click', generateAIInsights);
refs.smartBudgetBtn.addEventListener('click', applySmartBudget);

if (transactions[0]) refs.monthFilter.value = monthOf(transactions[0].date);
render();
generateAIInsights();
persist();
