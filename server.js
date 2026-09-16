const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const APP_PORT = Number(process.env.PORT || 3006);
const INGEST_TOKEN = String(process.env.INGEST_TOKEN || "").trim();

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3307);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "heap_monitoring";
const DB_TABLE = process.env.DB_TABLE || "heap_logs";
const INSTALL_TABLE = process.env.INSTALL_TABLE || "module_installs";

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 0,
});

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const SCHEMA_CACHE_TTL_MS = 30_000;
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`${DB_TABLE}\` (
    \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`timestamp\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`device\` VARCHAR(191) NOT NULL,
    \`heap\` DOUBLE NULL,
    \`heap_kb\` DOUBLE NULL,
    \`heap_effective\` DOUBLE NULL,
    \`max_block\` DOUBLE NULL,
    \`frag_pct\` DOUBLE NULL,
    \`uptime\` BIGINT NULL,
    \`event\` VARCHAR(128) NULL,
    \`level\` VARCHAR(32) NULL,
    \`note\` VARCHAR(255) NULL,
    \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`status\` VARCHAR(32) NULL,
    \`maxblk\` DOUBLE NULL,
    \`frag\` DOUBLE NULL,
    PRIMARY KEY (\`id\`),
    KEY \`idx_${DB_TABLE}_timestamp\` (\`timestamp\`),
    KEY \`idx_${DB_TABLE}_device_timestamp\` (\`device\`, \`timestamp\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const CREATE_INSTALL_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`${INSTALL_TABLE}\` (
    \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`timestamp\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`device\` VARCHAR(64) NOT NULL,
    \`device_name\` VARCHAR(64) NULL,
    \`firmware\` VARCHAR(32) NULL,
    \`mac\` VARCHAR(32) NULL,
    \`supla_server\` VARCHAR(128) NULL,
    \`email\` VARCHAR(191) NULL,
    \`uptime_ms\` BIGINT NULL,
    \`reason\` VARCHAR(64) NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uniq_${INSTALL_TABLE}_device_mac\` (\`device\`, \`mac\`),
    KEY \`idx_${INSTALL_TABLE}_timestamp\` (\`timestamp\`),
    KEY \`idx_${INSTALL_TABLE}_email\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;
const COLUMN_CANDIDATES = {
  timestamp: ["timestamp", "created_at", "createdAt", "logged_at", "received_at", "inserted_at", "date", "datetime", "time", "ts"],
  device: ["device", "module", "module_name", "device_name", "node", "source"],
  heapKb: ["heap_kb", "heapkb", "free_heap_kb"],
  heapBytes: ["heap", "heap_bytes", "free_heap", "free_heap_bytes", "heap_b"],
  uptime: ["uptime", "uptime_ms", "uptime_sec", "uptime_s"],
  event: ["event", "reason", "source_event", "trigger"],
  status: ["status", "severity", "level", "state", "alert_level"],
  maxBlock: ["maxblk", "max_block", "maxBlock"],
  frag: ["frag", "frag_pct", "fragmentation", "heap_frag_pct"],
  id: ["id"],
};

let schemaCache = {
  expiresAt: 0,
  value: null,
};

function clampLimit(value, { min = 1, max = 500, fallback = 50 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeStatus(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "WARN") return "WARNING";
  if (raw === "CRIT" || raw === "FATAL") return "CRITICAL";
  return raw;
}

function readIngestToken(req) {
  const headerToken = String(req.get("x-ingest-token") || "").trim();
  if (headerToken) return headerToken;

  const authHeader = String(req.get("authorization") || "");
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return "";
}

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function ensureTableExists() {
  await query(CREATE_TABLE_SQL, []);
}

async function ensureInstallTableExists() {
  await query(CREATE_INSTALL_TABLE_SQL, []);
}

function sqlIdent(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function buildColumnIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const columnName = row?.COLUMN_NAME;
    if (columnName) {
      index.set(String(columnName).toLowerCase(), columnName);
    }
  }
  return index;
}

function pickColumn(index, candidates) {
  for (const candidate of candidates) {
    const match = index.get(candidate.toLowerCase());
    if (match) return match;
  }
  return null;
}

function pickColumns(index, candidates) {
  const matches = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const match = index.get(candidate.toLowerCase());
    if (match && !seen.has(match)) {
      seen.add(match);
      matches.push(match);
    }
  }
  return matches;
}

async function getSchema() {
  if (schemaCache.value && Date.now() < schemaCache.expiresAt) {
    return schemaCache.value;
  }

  await ensureTableExists();

  const rows = await query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
    `,
    [DB_NAME, DB_TABLE]
  );

  if (!rows.length) {
    throw new Error(`Table '${DB_NAME}.${DB_TABLE}' introuvable.`);
  }

  const columnIndex = buildColumnIndex(rows);
  const schema = {
    available: rows.map((row) => row.COLUMN_NAME),
    timestamp: pickColumn(columnIndex, COLUMN_CANDIDATES.timestamp),
    device: pickColumn(columnIndex, COLUMN_CANDIDATES.device),
    heapKb: pickColumn(columnIndex, COLUMN_CANDIDATES.heapKb),
    heapBytes: pickColumn(columnIndex, COLUMN_CANDIDATES.heapBytes),
    uptime: pickColumn(columnIndex, COLUMN_CANDIDATES.uptime),
    event: pickColumn(columnIndex, COLUMN_CANDIDATES.event),
    status: pickColumn(columnIndex, COLUMN_CANDIDATES.status),
    statusColumns: pickColumns(columnIndex, COLUMN_CANDIDATES.status),
    maxBlock: pickColumn(columnIndex, COLUMN_CANDIDATES.maxBlock),
    frag: pickColumn(columnIndex, COLUMN_CANDIDATES.frag),
    id: pickColumn(columnIndex, COLUMN_CANDIDATES.id),
  };

  schema.orderBy = schema.timestamp || schema.id || null;
  schemaCache = {
    expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS,
    value: schema,
  };

  return schema;
}

function requireCompatibleSchema(schema) {
  const missing = [];

  if (!schema.device) missing.push("device");
  if (!schema.heapKb && !schema.heapBytes) missing.push("heap/heap_kb");

  if (missing.length) {
    throw new Error(
      `Schema incompatible pour '${DB_TABLE}'. Colonnes manquantes: ${missing.join(", ")}. Colonnes disponibles: ${schema.available.join(", ")}`
    );
  }
}

function aliasExpr(expr, alias) {
  return `${expr} AS ${sqlIdent(alias)}`;
}

function buildTimestampExpr(schema) {
  return schema.timestamp ? sqlIdent(schema.timestamp) : "NOW()";
}

function buildDeviceExpr(schema) {
  return schema.device ? sqlIdent(schema.device) : "''";
}

function buildHeapBytesExpr(schema) {
  if (schema.heapBytes && schema.heapKb) {
    return `COALESCE(${sqlIdent(schema.heapBytes)}, ROUND(${sqlIdent(schema.heapKb)} * 1024, 0))`;
  }
  if (schema.heapBytes) return sqlIdent(schema.heapBytes);
  if (schema.heapKb) return `ROUND(${sqlIdent(schema.heapKb)} * 1024, 0)`;
  return "NULL";
}

function buildHeapKbExpr(schema) {
  if (schema.heapKb && schema.heapBytes) {
    return `COALESCE(${sqlIdent(schema.heapKb)}, ROUND(${sqlIdent(schema.heapBytes)} / 1024, 2))`;
  }
  if (schema.heapKb) return sqlIdent(schema.heapKb);
  if (schema.heapBytes) return `ROUND(${sqlIdent(schema.heapBytes)} / 1024, 2)`;
  return "NULL";
}

function buildUptimeExpr(schema) {
  return schema.uptime ? sqlIdent(schema.uptime) : "NULL";
}

function buildEventExpr(schema) {
  return schema.event ? sqlIdent(schema.event) : "''";
}

function buildStatusExpr(schema) {
  const statusColumns = Array.isArray(schema.statusColumns) && schema.statusColumns.length
    ? schema.statusColumns
    : (schema.status ? [schema.status] : []);

  if (statusColumns.length) {
    const rawStatusValueExpr = `COALESCE(${statusColumns
      .map((column) => `NULLIF(TRIM(CAST(${sqlIdent(column)} AS CHAR)), '')`)
      .join(", ")})`;
    const rawStatusExpr = `UPPER(${rawStatusValueExpr})`;
    return `
      CASE
        WHEN ${rawStatusExpr} IN ('OK', 'INFO') THEN 'OK'
        WHEN ${rawStatusExpr} IN ('WARNING', 'WARN') THEN 'WARNING'
        WHEN ${rawStatusExpr} IN ('CRITICAL', 'CRIT', 'FATAL') THEN 'CRITICAL'
        ELSE COALESCE(${rawStatusValueExpr}, 'UNKNOWN')
      END
    `;
  }

  const heapBytesExpr = buildHeapBytesExpr(schema);
  return `
    CASE
      WHEN ${heapBytesExpr} IS NULL THEN 'UNKNOWN'
      WHEN ${heapBytesExpr} < 6000 THEN 'CRITICAL'
      WHEN ${heapBytesExpr} <= 8000 THEN 'WARNING'
      ELSE 'OK'
    END
  `;
}

async function insertIngestRow(payload) {
  const schema = await getSchema();
  requireCompatibleSchema(schema);

  const columns = [];
  const values = [];
  const params = [];
  const pushParam = (column, value) => {
    columns.push(sqlIdent(column));
    values.push("?");
    params.push(value);
  };

  if (!schema.device) {
    throw new Error(`Schema incompatible pour '${DB_TABLE}': colonne device introuvable.`);
  }

  if (schema.timestamp) {
    columns.push(sqlIdent(schema.timestamp));
    values.push("NOW()");
  }

  pushParam(schema.device, payload.deviceId);

  if (schema.heapBytes) pushParam(schema.heapBytes, payload.heapBytes);
  if (schema.heapKb) pushParam(schema.heapKb, payload.heapKb);
  if (schema.uptime && payload.uptime !== null) pushParam(schema.uptime, payload.uptime);
  if (schema.status && payload.status !== null) pushParam(schema.status, payload.status);
  if (schema.event) pushParam(schema.event, "ingest");
  if (schema.maxBlock && payload.maxBlock !== null) pushParam(schema.maxBlock, payload.maxBlock);
  if (schema.frag && payload.frag !== null) pushParam(schema.frag, payload.frag);

  await query(
    `INSERT INTO ${sqlIdent(DB_TABLE)} (${columns.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );
}

app.get("/api/logs", async (req, res) => {
  const limit = clampLimit(req.query.limit, { min: 1, max: 200, fallback: 50 });
  try {
    const schema = await getSchema();
    requireCompatibleSchema(schema);
    const orderByClause = schema.orderBy ? `ORDER BY ${sqlIdent(schema.orderBy)} DESC` : "";
    const rows = await query(
      `
      SELECT
        ${aliasExpr(buildTimestampExpr(schema), "timestamp")},
        ${aliasExpr(buildDeviceExpr(schema), "device")},
        ${aliasExpr(buildHeapKbExpr(schema), "heap_kb")},
        ${aliasExpr(buildUptimeExpr(schema), "uptime")},
        ${aliasExpr(buildEventExpr(schema), "event")},
        ${aliasExpr(buildStatusExpr(schema), "status")}
      FROM \`${DB_TABLE}\`
      ${orderByClause}
      LIMIT ${limit}
      `
    );
    res.json({ ok: true, limit, rows });
  } catch (err) {
    schemaCache.expiresAt = 0;
    res.status(500).json({ ok: false, error: "DB_QUERY_FAILED", detail: String(err?.message || err) });
  }
});

app.get("/api/chart", async (req, res) => {
  const limit = clampLimit(req.query.limit, { min: 1, max: 2000, fallback: 100 });
  try {
    const schema = await getSchema();
    requireCompatibleSchema(schema);
    const orderByClause = schema.orderBy ? `ORDER BY ${sqlIdent(schema.orderBy)} DESC` : "";
    const rows = await query(
      `
      SELECT
        ${aliasExpr(buildTimestampExpr(schema), "timestamp")},
        ${aliasExpr(buildDeviceExpr(schema), "device")},
        ${aliasExpr(buildHeapKbExpr(schema), "heap_kb")}
      FROM \`${DB_TABLE}\`
      ${orderByClause}
      LIMIT ${limit}
      `
    );
    res.json({ ok: true, limit, rows });
  } catch (err) {
    schemaCache.expiresAt = 0;
    res.status(500).json({ ok: false, error: "DB_QUERY_FAILED", detail: String(err?.message || err) });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const schema = await getSchema();
    requireCompatibleSchema(schema);
    const deviceExpr = buildDeviceExpr(schema);
    const heapKbExpr = buildHeapKbExpr(schema);
    const statusExpr = buildStatusExpr(schema);
    const whereClause = schema.timestamp ? `WHERE ${sqlIdent(schema.timestamp)} >= (NOW() - INTERVAL 1 DAY)` : "";
    const rows = await query(
      `
      SELECT
        ${aliasExpr(deviceExpr, "device")},
        SUM(CASE WHEN ${statusExpr} = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_24h,
        MIN(${heapKbExpr}) AS min_heap_kb_24h,
        MAX(${heapKbExpr}) AS max_heap_kb_24h
      FROM \`${DB_TABLE}\`
      ${whereClause}
      GROUP BY ${deviceExpr}
      ORDER BY ${deviceExpr} ASC
      `
    );
    res.json({ ok: true, rows });
  } catch (err) {
    schemaCache.expiresAt = 0;
    res.status(500).json({ ok: false, error: "DB_QUERY_FAILED", detail: String(err?.message || err) });
  }
});

app.get("/api/installations", async (req, res) => {
  const limit = clampLimit(req.query.limit, { min: 1, max: 500, fallback: 100 });
  try {
    await ensureInstallTableExists();
    const rows = await query(
      `
      SELECT
        \`timestamp\`,
        \`device\`,
        \`device_name\`,
        \`firmware\`,
        \`mac\`,
        \`supla_server\`,
        \`email\`,
        \`uptime_ms\`,
        \`reason\`
      FROM \`${INSTALL_TABLE}\`
      ORDER BY \`timestamp\` DESC
      LIMIT ${limit}
      `
    );
    res.json({ ok: true, limit, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB_QUERY_FAILED", detail: String(err?.message || err) });
  }
});

app.get("/health", async (req, res) => {
  try {
    const schema = await getSchema();
    requireCompatibleSchema(schema);
    await ensureInstallTableExists();
    await query(`SELECT 1 FROM ${sqlIdent(DB_TABLE)} LIMIT 1`, []);
    res.json({ ok: true });
  } catch (err) {
    schemaCache.expiresAt = 0;
    res.status(500).json({ ok: false, error: "APP_NOT_READY", detail: String(err?.message || err) });
  }
});

app.post("/api/ingest", async (req, res) => {
  if (INGEST_TOKEN && readIngestToken(req) !== INGEST_TOKEN) {
    return res.status(401).json({ ok: false });
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const deviceId = String(body.device_id ?? "").trim();
  const heapBytes = toFiniteNumber(body.heap);

  if (!deviceId || heapBytes === null) {
    return res.status(400).json({ ok: false });
  }

  const payload = {
    deviceId,
    heapBytes,
    heapKb: roundTo(heapBytes / 1024, 2),
    maxBlock: toFiniteNumber(body.maxblk),
    frag: toFiniteNumber(body.frag),
    uptime: toFiniteNumber(body.uptime),
    status: normalizeStatus(body.status),
  };

  try {
    await insertIngestRow(payload);
    return res.json({ ok: true });
  } catch (err) {
    schemaCache.expiresAt = 0;
    return res.status(500).json({ ok: false });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(APP_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    [
      `[heap-dashboard] HTTP server listening on :${APP_PORT}`,
      `[heap-dashboard] DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} tables=${DB_TABLE},${INSTALL_TABLE}`,
    ].join("\n")
  );
});
