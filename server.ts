import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3100;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'edit-data.json');

app.use(express.json());

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '{}', 'utf-8');
}

function readData(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeData(data: Record<string, unknown>): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/edit-data — return all edit data
app.get('/api/edit-data', (_req, res) => {
  const data = readData();
  res.json(data);
});

// PUT /api/edit-data/:itemId — update a single item
app.put('/api/edit-data/:itemId', (req, res) => {
  const { itemId } = req.params;
  const body = req.body;
  const data = readData();
  data[itemId] = { ...(data[itemId] as Record<string, unknown> || {}), ...body };
  writeData(data);
  res.json({ success: true, itemId, data: data[itemId] });
});

// POST /api/edit-data/save-all — replace all edit data
app.post('/api/edit-data/save-all', (req, res) => {
  const body = req.body;
  writeData(body);
  res.json({ success: true, count: Object.keys(body).length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
});
