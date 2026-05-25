import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { router } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api', router);

// Redirect root to onboarding or dashboard
app.get('/', (req, res) => {
  res.redirect('/pages/onboarding.html');
});

app.listen(PORT, () => {
  console.log(`✅ Splitr running at http://localhost:${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser`);
});
