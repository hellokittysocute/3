const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;
const SCHEMA = 'app_mktdashboard_prd';

// ── DB 접속 (Secrets Manager ARN → 환경변수로 주입됨) ──
let dbConfig;
if (process.env.DB_SECRET) {
  try {
    const secret = JSON.parse(process.env.DB_SECRET);
    dbConfig = {
      host: secret.host || 'cip001.cosmaxhub.com',
      port: secret.port || 5432,
      database: secret.dbname || 'Postgres',
      user: secret.username || 'app_mktdashboard_prd',
      password: secret.password,
    };
  } catch {
    dbConfig = null;
  }
}
if (!dbConfig) {
  dbConfig = {
    host: process.env.DB_HOST || 'cip001.cosmaxhub.com',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'Postgres',
    user: process.env.DB_USER || 'app_mktdashboard_prd',
    password: process.env.DB_PASSWORD || '',
  };
}

const pool = new Pool(dbConfig);
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${SCHEMA}`);
});

// ── Azure SSO 설정 (Secrets Manager → 환경변수 → 빌드 시 Vite에 주입) ──
let azureSsoConfig = {};
if (process.env.AZURE_SSO) {
  try {
    azureSsoConfig = JSON.parse(process.env.AZURE_SSO);
  } catch { /* ignore */ }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// ── Azure SSO 설정 API (프론트엔드에서 런타임에 조회) ──
app.get('/api/auth/config', (req, res) => {
  res.json({
    clientId: azureSsoConfig.AZURE_CLIENT_ID || '',
    tenantId: azureSsoConfig.AZURE_TENANT_ID || '',
  });
});

// ══════════════════════════════════════
// API 엔드포인트
// ══════════════════════════════════════

// ── 대시보드 아이템 조회 ──
app.get('/api/dashboard-items', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM dashboard_items WHERE customer_code != '' ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    console.error('dashboard_items 조회 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 편집 데이터 조회 ──
app.get('/api/edit-data', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM edit_data`);
    res.json(rows);
  } catch (err) {
    console.error('edit_data 조회 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 단일 편집 데이터 업데이트 ──
app.put('/api/edit-data/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const d = req.body;
  try {
    await pool.query(
      `INSERT INTO edit_data (item_id, write_date, production_complete_date, material_setting_date,
        manufacturing_date, packaging_date, material_setting_filled_at, manufacturing_filled_at,
        packaging_filled_at, revenue_possible, revenue_possible_quantity, revenue_possible_filled_at,
        delay_reason, revenue_reflected, importance, purchase_manager, note, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
       ON CONFLICT (item_id) DO UPDATE SET
        write_date=EXCLUDED.write_date, production_complete_date=EXCLUDED.production_complete_date,
        material_setting_date=EXCLUDED.material_setting_date, manufacturing_date=EXCLUDED.manufacturing_date,
        packaging_date=EXCLUDED.packaging_date, material_setting_filled_at=EXCLUDED.material_setting_filled_at,
        manufacturing_filled_at=EXCLUDED.manufacturing_filled_at, packaging_filled_at=EXCLUDED.packaging_filled_at,
        revenue_possible=EXCLUDED.revenue_possible, revenue_possible_quantity=EXCLUDED.revenue_possible_quantity,
        revenue_possible_filled_at=EXCLUDED.revenue_possible_filled_at,
        delay_reason=EXCLUDED.delay_reason, revenue_reflected=EXCLUDED.revenue_reflected,
        importance=EXCLUDED.importance, purchase_manager=EXCLUDED.purchase_manager,
        note=EXCLUDED.note, updated_at=NOW()`,
      [itemId, d.write_date||'', d.production_complete_date||'', d.material_setting_date||'',
       d.manufacturing_date||'', d.packaging_date||'', d.material_setting_filled_at||'',
       d.manufacturing_filled_at||'', d.packaging_filled_at||'', d.revenue_possible||'확인중',
       d.revenue_possible_quantity||0, d.revenue_possible_filled_at||'',
       d.delay_reason||'', d.revenue_reflected||'', d.importance||'',
       d.purchase_manager||'', d.note||'']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('edit_data 업데이트 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 전체 편집 데이터 저장 ──
app.post('/api/edit-data/save-all', async (req, res) => {
  const allData = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [itemId, d] of Object.entries(allData)) {
      await client.query(
        `INSERT INTO edit_data (item_id, write_date, production_complete_date, material_setting_date,
          manufacturing_date, packaging_date, material_setting_filled_at, manufacturing_filled_at,
          packaging_filled_at, revenue_possible, revenue_possible_quantity, revenue_possible_filled_at,
          delay_reason, revenue_reflected, importance, purchase_manager, note, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
         ON CONFLICT (item_id) DO UPDATE SET
          write_date=EXCLUDED.write_date, production_complete_date=EXCLUDED.production_complete_date,
          material_setting_date=EXCLUDED.material_setting_date, manufacturing_date=EXCLUDED.manufacturing_date,
          packaging_date=EXCLUDED.packaging_date, material_setting_filled_at=EXCLUDED.material_setting_filled_at,
          manufacturing_filled_at=EXCLUDED.manufacturing_filled_at, packaging_filled_at=EXCLUDED.packaging_filled_at,
          revenue_possible=EXCLUDED.revenue_possible, revenue_possible_quantity=EXCLUDED.revenue_possible_quantity,
          revenue_possible_filled_at=EXCLUDED.revenue_possible_filled_at,
          delay_reason=EXCLUDED.delay_reason, revenue_reflected=EXCLUDED.revenue_reflected,
          importance=EXCLUDED.importance, purchase_manager=EXCLUDED.purchase_manager,
          note=EXCLUDED.note, updated_at=NOW()`,
        [itemId, d.write_date||'', d.production_complete_date||'', d.material_setting_date||'',
         d.manufacturing_date||'', d.packaging_date||'', d.material_setting_filled_at||'',
         d.manufacturing_filled_at||'', d.packaging_filled_at||'', d.revenue_possible||'확인중',
         d.revenue_possible_quantity||0, d.revenue_possible_filled_at||'',
         d.delay_reason||'', d.revenue_reflected||'', d.importance||'',
         d.purchase_manager||'', d.note||'']
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: Object.keys(allData).length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('edit_data 일괄 저장 오류:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── 설정값 조회 ──
app.get('/api/settings', async (req, res) => {
  const { keys } = req.query;
  try {
    const keyList = keys ? keys.split(',') : [];
    const { rows } = keyList.length > 0
      ? await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keyList])
      : await pool.query(`SELECT key, value FROM settings`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 설정값 업데이트 ──
app.put('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  try {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value.toString()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 전체 품목 조회 ──
app.get('/api/all-items', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM all_items WHERE customer_code != '' ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 전체 품목 편집 데이터 조회 ──
app.get('/api/all-items-edit-data', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM all_items_edit_data`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 전체 품목 편집 데이터 업데이트 ──
app.put('/api/all-items-edit-data/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const d = req.body;
  try {
    await pool.query(
      `INSERT INTO all_items_edit_data (item_id, write_date, production_complete_date, material_setting_date,
        manufacturing_date, packaging_date, material_setting_filled_at, manufacturing_filled_at,
        packaging_filled_at, revenue_possible, revenue_possible_quantity, revenue_possible_filled_at,
        delay_reason, revenue_reflected, importance, purchase_manager, note,
        material_arrival_expected, material_arrival_actual, production_complete_actual, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
       ON CONFLICT (item_id) DO UPDATE SET
        write_date=EXCLUDED.write_date, production_complete_date=EXCLUDED.production_complete_date,
        material_setting_date=EXCLUDED.material_setting_date, manufacturing_date=EXCLUDED.manufacturing_date,
        packaging_date=EXCLUDED.packaging_date, material_setting_filled_at=EXCLUDED.material_setting_filled_at,
        manufacturing_filled_at=EXCLUDED.manufacturing_filled_at, packaging_filled_at=EXCLUDED.packaging_filled_at,
        revenue_possible=EXCLUDED.revenue_possible, revenue_possible_quantity=EXCLUDED.revenue_possible_quantity,
        revenue_possible_filled_at=EXCLUDED.revenue_possible_filled_at,
        delay_reason=EXCLUDED.delay_reason, revenue_reflected=EXCLUDED.revenue_reflected,
        importance=EXCLUDED.importance, purchase_manager=EXCLUDED.purchase_manager, note=EXCLUDED.note,
        material_arrival_expected=EXCLUDED.material_arrival_expected,
        material_arrival_actual=EXCLUDED.material_arrival_actual,
        production_complete_actual=EXCLUDED.production_complete_actual, updated_at=NOW()`,
      [itemId, d.write_date||'', d.production_complete_date||'', d.material_setting_date||'',
       d.manufacturing_date||'', d.packaging_date||'', d.material_setting_filled_at||'',
       d.manufacturing_filled_at||'', d.packaging_filled_at||'', d.revenue_possible||'확인중',
       d.revenue_possible_quantity||0, d.revenue_possible_filled_at||'',
       d.delay_reason||'', d.revenue_reflected||'', d.importance||'',
       d.purchase_manager||'', d.note||'',
       d.material_arrival_expected||'', d.material_arrival_actual||'', d.production_complete_actual||'']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 전체 품목 편집 데이터 일괄 저장 ──
app.post('/api/all-items-edit-data/save-all', async (req, res) => {
  const allData = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [itemId, d] of Object.entries(allData)) {
      await client.query(
        `INSERT INTO all_items_edit_data (item_id, write_date, production_complete_date, material_setting_date,
          manufacturing_date, packaging_date, material_setting_filled_at, manufacturing_filled_at,
          packaging_filled_at, revenue_possible, revenue_possible_quantity, revenue_possible_filled_at,
          delay_reason, revenue_reflected, importance, purchase_manager, note,
          material_arrival_expected, material_arrival_actual, production_complete_actual, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
         ON CONFLICT (item_id) DO UPDATE SET
          write_date=EXCLUDED.write_date, production_complete_date=EXCLUDED.production_complete_date,
          material_setting_date=EXCLUDED.material_setting_date, manufacturing_date=EXCLUDED.manufacturing_date,
          packaging_date=EXCLUDED.packaging_date, material_setting_filled_at=EXCLUDED.material_setting_filled_at,
          manufacturing_filled_at=EXCLUDED.manufacturing_filled_at, packaging_filled_at=EXCLUDED.packaging_filled_at,
          revenue_possible=EXCLUDED.revenue_possible, revenue_possible_quantity=EXCLUDED.revenue_possible_quantity,
          revenue_possible_filled_at=EXCLUDED.revenue_possible_filled_at,
          delay_reason=EXCLUDED.delay_reason, revenue_reflected=EXCLUDED.revenue_reflected,
          importance=EXCLUDED.importance, purchase_manager=EXCLUDED.purchase_manager, note=EXCLUDED.note,
          material_arrival_expected=EXCLUDED.material_arrival_expected,
          material_arrival_actual=EXCLUDED.material_arrival_actual,
          production_complete_actual=EXCLUDED.production_complete_actual, updated_at=NOW()`,
        [itemId, d.write_date||'', d.production_complete_date||'', d.material_setting_date||'',
         d.manufacturing_date||'', d.packaging_date||'', d.material_setting_filled_at||'',
         d.manufacturing_filled_at||'', d.packaging_filled_at||'', d.revenue_possible||'확인중',
         d.revenue_possible_quantity||0, d.revenue_possible_filled_at||'',
         d.delay_reason||'', d.revenue_reflected||'', d.importance||'',
         d.purchase_manager||'', d.note||'',
         d.material_arrival_expected||'', d.material_arrival_actual||'', d.production_complete_actual||'']
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: Object.keys(allData).length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── 스냅샷 목록 ──
app.get('/api/snapshots', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, month, label, created_at, created_by, item_count, total_revenue
       FROM monthly_snapshots ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 스냅샷 생성 ──
app.post('/api/snapshots', async (req, res) => {
  const { month, label, created_by, item_count, total_revenue, data } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO monthly_snapshots (month, label, created_by, item_count, total_revenue, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [month, label, created_by, item_count, total_revenue, JSON.stringify(data)]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 스냅샷 상세 ──
app.get('/api/snapshots/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT data FROM monthly_snapshots WHERE id = $1`, [req.params.id]
    );
    res.json(rows[0]?.data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 스냅샷 삭제 ──
app.delete('/api/snapshots/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM monthly_snapshots WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 스냅샷 월 존재 여부 ──
app.get('/api/snapshots/check/:month', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM monthly_snapshots WHERE month = $1`, [req.params.month]
    );
    res.json({ exists: rows[0].count > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 사용자 프로필 조회 ──
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM user_profiles ORDER BY created_at`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 사용자 프로필 조회 (단일) ──
app.get('/api/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [req.params.id]);
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 사용자 프로필 upsert ──
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { email, name, avatar_url, role, status } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_profiles (id, email, name, avatar_url, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
        email=COALESCE(EXCLUDED.email, user_profiles.email),
        name=COALESCE(EXCLUDED.name, user_profiles.name),
        avatar_url=COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url)`,
      [id, email, name, avatar_url||'', role||'user', status||'active']
    );
    const { rows } = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 사용자 상태/역할 변경 ──
app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const setClauses = [];
  const values = [id];
  let idx = 2;
  for (const [key, val] of Object.entries(updates)) {
    if (['role', 'status', 'name', 'avatar_url'].includes(key)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }
  if (setClauses.length === 0) return res.json({ success: true });
  try {
    await pool.query(`UPDATE user_profiles SET ${setClauses.join(', ')} WHERE id = $1`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 데이터 업로드 (CSV → DB) ──
app.post('/api/upload/:table', async (req, res) => {
  const table = req.params.table;
  if (!['dashboard_items', 'all_items'].includes(table)) {
    return res.status(400).json({ error: 'Invalid table' });
  }
  const { rows: dataRows, editTable } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert items
    for (let i = 0; i < dataRows.length; i += 100) {
      const batch = dataRows.slice(i, i + 100);
      for (const row of batch) {
        const cols = Object.keys(row).filter(k => !k.startsWith('_'));
        const vals = cols.map(c => row[c]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        const colList = cols.map(c => `"${c}"`).join(',');
        const updateSet = cols.filter(c => c !== 'id').map(c => `"${c}"=EXCLUDED."${c}"`).join(',');
        await client.query(
          `INSERT INTO ${table} (${colList}) VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
          vals
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, count: dataRows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── SPA fallback (API 이외 모든 경로) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
