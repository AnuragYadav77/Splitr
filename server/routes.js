import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, {});

async function initDB() {
  await db.read();
  db.data ||= {
    user: null,
    sections: [],
    bills: [],
    transactions: [],
    savings: { balance: 0, goal: null, history: [] },
    settings: { month: null, year: null },
    overrides: 0
  };
  await db.write();
}

await initDB();

export const router = Router();

// ── Helper ──────────────────────────────────────────────────────────────────
function getDB() { return db.data; }

function getCurrentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// ── POST /setup ──────────────────────────────────────────────────────────────
router.post('/setup', async (req, res) => {
  try {
    await db.read();
    const { name, income, pin, sections, bills } = req.body;
    const { month, year } = getCurrentMonth();

    db.data.user = { name, income, pin };
    db.data.sections = sections.map(s => ({
      id: uuidv4(),
      name: s.name,
      emoji: s.emoji,
      budget: s.budget,
      spent: 0,
      createdAt: new Date().toISOString()
    }));
    db.data.bills = (bills || []).map(b => ({
      id: uuidv4(),
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      paid: false
    }));
    db.data.transactions = [];
    db.data.savings = { balance: 0, goal: null, history: [] };
    db.data.settings = { month, year };
    db.data.overrides = 0;

    await db.write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /dashboard ───────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    await db.read();
    const d = db.data;
    const recent = [...(d.transactions || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    res.json({
      user: d.user,
      sections: d.sections,
      bills: d.bills,
      savings: d.savings,
      recentTransactions: recent,
      settings: d.settings
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /pay ────────────────────────────────────────────────────────────────
router.post('/pay', async (req, res) => {
  try {
    await db.read();
    const { merchant, amount, sectionId, isOverride } = req.body;
    const section = db.data.sections.find(s => s.id === sectionId);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    const remaining = section.budget - section.spent;
    if (!isOverride && amount > remaining) {
      return res.status(400).json({ error: 'Insufficient section budget', shortBy: amount - remaining });
    }

    section.spent += amount;
    if (isOverride) db.data.overrides = (db.data.overrides || 0) + 1;

    const tx = {
      id: uuidv4(),
      merchant,
      amount,
      sectionId,
      sectionName: section.name,
      sectionEmoji: section.emoji,
      isOverride: !!isOverride,
      type: 'payment',
      createdAt: new Date().toISOString()
    };
    db.data.transactions.push(tx);

    await db.write();
    res.json({ success: true, transaction: tx, section });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /sections ────────────────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.sections);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /sections ────────────────────────────────────────────────────────────
router.post('/sections', async (req, res) => {
  try {
    await db.read();
    const { name, emoji, budget } = req.body;
    const section = { id: uuidv4(), name, emoji, budget, spent: 0, createdAt: new Date().toISOString() };
    db.data.sections.push(section);
    await db.write();
    res.json(section);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /sections/:id ──────────────────────────────────────────────────────
router.delete('/sections/:id', async (req, res) => {
  try {
    await db.read();
    const idx = db.data.sections.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Section not found' });

    const section = db.data.sections[idx];
    const remaining = section.budget - section.spent;
    if (remaining > 0) {
      db.data.savings.balance += remaining;
      db.data.savings.history.push({
        id: uuidv4(),
        type: 'sweep',
        amount: remaining,
        note: `Section "${section.name}" deleted`,
        createdAt: new Date().toISOString()
      });
    }

    db.data.sections.splice(idx, 1);
    await db.write();
    res.json({ success: true, swept: remaining });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /sections/:id/topup ────────────────────────────────────────────────
router.patch('/sections/:id/topup', async (req, res) => {
  try {
    await db.read();
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    const section = db.data.sections.find(s => s.id === req.params.id);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    section.budget += Number(amount);

    const tx = {
      id: uuidv4(),
      merchant: 'Budget Top-up',
      amount: Number(amount),
      sectionId: section.id,
      sectionName: section.name,
      sectionEmoji: section.emoji,
      isOverride: false,
      type: 'topup',
      createdAt: new Date().toISOString()
    };
    db.data.transactions.push(tx);

    await db.write();
    res.json({ success: true, section, transaction: tx });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /section/:id ──────────────────────────────────────────────────────────
router.get('/section/:id', async (req, res) => {
  try {
    await db.read();
    const section = db.data.sections.find(s => s.id === req.params.id);
    if (!section) return res.status(404).json({ error: 'Not found' });
    const txns = db.data.transactions
      .filter(t => t.sectionId === req.params.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ section, transactions: txns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /savings ──────────────────────────────────────────────────────────────
router.get('/savings', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.savings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /savings/withdraw ────────────────────────────────────────────────────
router.post('/savings/withdraw', async (req, res) => {
  try {
    await db.read();
    const { amount, reason } = req.body;
    if (amount > db.data.savings.balance) {
      return res.status(400).json({ error: 'Insufficient savings' });
    }
    db.data.savings.balance -= amount;
    db.data.savings.history.push({
      id: uuidv4(),
      type: 'withdrawal',
      amount,
      note: reason,
      createdAt: new Date().toISOString()
    });
    await db.write();
    res.json({ success: true, newBalance: db.data.savings.balance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /savings/goal ────────────────────────────────────────────────────────
router.post('/savings/goal', async (req, res) => {
  try {
    await db.read();
    const { name, target } = req.body;
    db.data.savings.goal = name && target ? { name, target } : null;
    await db.write();
    res.json({ success: true, goal: db.data.savings.goal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /bills ────────────────────────────────────────────────────────────────
router.get('/bills', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.bills);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /bills/:id/pay ───────────────────────────────────────────────────────
router.post('/bills/:id/pay', async (req, res) => {
  try {
    await db.read();
    const bill = db.data.bills.find(b => b.id === req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    bill.paid = true;
    await db.write();
    res.json({ success: true, bill });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /month-end ────────────────────────────────────────────────────────────
router.post('/month-end', async (req, res) => {
  try {
    await db.read();
    const { sections: newBudgets } = req.body;
    const { month, year } = getCurrentMonth();

    // Calculate total savings from this month
    let swept = 0;
    for (const section of db.data.sections) {
      const remaining = section.budget - section.spent;
      if (remaining > 0) swept += remaining;
    }

    // Update savings
    db.data.savings.balance += swept;
    if (swept > 0) {
      db.data.savings.history.push({
        id: uuidv4(),
        type: 'month-sweep',
        amount: swept,
        note: `Month-end sweep`,
        month: db.data.settings.month,
        year: db.data.settings.year,
        createdAt: new Date().toISOString()
      });
    }

    // Reset sections with new budgets
    for (const section of db.data.sections) {
      const newBudget = newBudgets?.find(nb => nb.id === section.id);
      section.budget = newBudget ? newBudget.budget : section.budget;
      section.spent = 0;
    }

    // Add any new sections
    if (newBudgets) {
      for (const nb of newBudgets) {
        if (nb.isNew) {
          db.data.sections.push({
            id: uuidv4(),
            name: nb.name,
            emoji: nb.emoji,
            budget: nb.budget,
            spent: 0,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // Reset bills
    db.data.bills = db.data.bills.map(b => ({ ...b, paid: false }));

    db.data.transactions = [];
    db.data.settings = { month, year };
    db.data.overrides = 0;

    await db.write();
    res.json({ success: true, swept, newBalance: db.data.savings.balance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /settings ─────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    await db.read();
    res.json({ user: db.data.user, settings: db.data.settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /settings ────────────────────────────────────────────────────────────
router.post('/settings', async (req, res) => {
  try {
    await db.read();
    const { name, newPin, currentPin } = req.body;
    if (name) db.data.user.name = name;
    if (newPin) {
      if (currentPin !== db.data.user.pin) {
        return res.status(400).json({ error: 'Incorrect current PIN' });
      }
      db.data.user.pin = newPin;
    }
    await db.write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /demo ────────────────────────────────────────────────────────────────
router.post('/demo', async (req, res) => {
  try {
    await db.read();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Simulated date: 19th of current month
    const sim = (day, hour = 10, min = 0) => {
      const d = new Date(currentYear, currentMonth - 1, day, hour, min);
      return d.toISOString();
    };

    const sections = [
      { id: uuidv4(), name: 'Food', emoji: '🍔', budget: 6000, spent: 3800, createdAt: sim(1) },
      { id: uuidv4(), name: 'Shopping', emoji: '🛍️', budget: 5000, spent: 4750, createdAt: sim(1) },
      { id: uuidv4(), name: 'Transport', emoji: '🚗', budget: 3000, spent: 1200, createdAt: sim(1) },
      { id: uuidv4(), name: 'Entertainment', emoji: '🎬', budget: 2500, spent: 2500, createdAt: sim(1) },
      { id: uuidv4(), name: 'Health', emoji: '💊', budget: 2000, spent: 300, createdAt: sim(1) },
    ];

    const bills = [
      { id: uuidv4(), name: 'Rent', amount: 12000, dueDay: 1, paid: true },
      { id: uuidv4(), name: 'Netflix', amount: 199, dueDay: 5, paid: true },
      { id: uuidv4(), name: 'Electricity', amount: 800, dueDay: 21, paid: false }
    ];

    const [food, shopping, transport, entertainment, health] = sections;
    const transactions = [
      { id: uuidv4(), merchant: 'Swiggy', amount: 450, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(19, 13, 20) },
      { id: uuidv4(), merchant: 'Zomato', amount: 320, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(18, 20, 10) },
      { id: uuidv4(), merchant: 'BigBasket', amount: 1200, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(15, 11, 5) },
      { id: uuidv4(), merchant: 'DMart', amount: 800, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(10, 16, 0) },
      { id: uuidv4(), merchant: 'Swiggy', amount: 530, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(7, 21, 30) },
      { id: uuidv4(), merchant: 'Zomato', amount: 500, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(3, 13, 0) },
      { id: uuidv4(), merchant: 'Myntra', amount: 1999, sectionId: shopping.id, sectionName: shopping.name, sectionEmoji: shopping.emoji, type: 'payment', createdAt: sim(17, 15, 0) },
      { id: uuidv4(), merchant: 'Myntra', amount: 1500, sectionId: shopping.id, sectionName: shopping.name, sectionEmoji: shopping.emoji, type: 'payment', createdAt: sim(12, 11, 30) },
      { id: uuidv4(), merchant: 'DMart', amount: 1251, sectionId: shopping.id, sectionName: shopping.name, sectionEmoji: shopping.emoji, type: 'payment', createdAt: sim(5, 17, 0) },
      { id: uuidv4(), merchant: 'Uber', amount: 450, sectionId: transport.id, sectionName: transport.name, sectionEmoji: transport.emoji, type: 'payment', createdAt: sim(19, 9, 0) },
      { id: uuidv4(), merchant: 'Uber', amount: 350, sectionId: transport.id, sectionName: transport.name, sectionEmoji: transport.emoji, type: 'payment', createdAt: sim(16, 8, 30) },
      { id: uuidv4(), merchant: 'Uber', amount: 400, sectionId: transport.id, sectionName: transport.name, sectionEmoji: transport.emoji, type: 'payment', createdAt: sim(11, 10, 0) },
      { id: uuidv4(), merchant: 'BookMyShow', amount: 800, sectionId: entertainment.id, sectionName: entertainment.name, sectionEmoji: entertainment.emoji, type: 'payment', createdAt: sim(14, 19, 0) },
      { id: uuidv4(), merchant: 'BookMyShow', amount: 600, sectionId: entertainment.id, sectionName: entertainment.name, sectionEmoji: entertainment.emoji, type: 'payment', createdAt: sim(8, 18, 0) },
      { id: uuidv4(), merchant: 'Swiggy', amount: 600, sectionId: entertainment.id, sectionName: entertainment.name, sectionEmoji: entertainment.emoji, type: 'payment', createdAt: sim(6, 22, 0) },
      { id: uuidv4(), merchant: 'BookMyShow', amount: 500, sectionId: entertainment.id, sectionName: entertainment.name, sectionEmoji: entertainment.emoji, type: 'payment', createdAt: sim(2, 20, 0) },
      { id: uuidv4(), merchant: 'PharmEasy', amount: 180, sectionId: health.id, sectionName: health.name, sectionEmoji: health.emoji, type: 'payment', createdAt: sim(13, 12, 0) },
      { id: uuidv4(), merchant: 'PharmEasy', amount: 120, sectionId: health.id, sectionName: health.name, sectionEmoji: health.emoji, type: 'payment', createdAt: sim(9, 11, 0) },
      { id: uuidv4(), merchant: 'IRCTC', amount: 450, sectionId: transport.id, sectionName: transport.name, sectionEmoji: transport.emoji, type: 'payment', createdAt: sim(4, 14, 0) },
      { id: uuidv4(), merchant: 'BSES Electricity', amount: 800, sectionId: food.id, sectionName: food.name, sectionEmoji: food.emoji, type: 'payment', createdAt: sim(1, 10, 0) }
    ];

    // Build 6-month savings history
    const savingsHistory = [];
    for (let i = 5; i >= 1; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 28);
      savingsHistory.push({
        id: uuidv4(),
        type: 'month-sweep',
        amount: [2100, 3400, 1800, 5200, 2900][5 - i],
        note: 'Month-end sweep',
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        createdAt: d.toISOString()
      });
    }

    db.data = {
      user: { name: 'Rahul Verma', income: 45000, pin: '1234' },
      sections,
      bills,
      transactions,
      savings: {
        balance: 4200,
        goal: { name: 'Vacation Fund', target: 20000 },
        history: savingsHistory
      },
      settings: { month: currentMonth, year: currentYear },
      overrides: 0
    };

    await db.write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /verify-pin ──────────────────────────────────────────────────────────
router.post('/verify-pin', async (req, res) => {
  try {
    await db.read();
    const { pin } = req.body;
    res.json({ valid: pin === db.data.user?.pin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /reset ───────────────────────────────────────────────────────────────
router.post('/reset', async (req, res) => {
  try {
    db.data = {
      user: null,
      sections: [],
      bills: [],
      transactions: [],
      savings: { balance: 0, goal: null, history: [] },
      settings: { month: null, year: null },
      overrides: 0
    };
    await db.write();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
