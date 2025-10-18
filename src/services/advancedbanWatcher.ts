// src/services/advancedbanWatcher.ts
import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import fs from 'fs-extra';
import path from 'path';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
import { getLogChannelId } from '../utils/configManager';
import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * AdvancedBan → Discord watcher
 * Generuje obraz-kartę (PNG) i wysyła jako załącznik.
 * Kolumny `ip` oraz `active` traktowane są opcjonalnie.
 */

const CURSOR_FILE = path.join(
  process.cwd(),
  'data',
  `advancedban_cursor_${(process.env.ADV_BAN_ACTIVE_TABLE || 'punishments').toLowerCase()}.json`
);

const FALLBACK_COLUMN_CANDIDATES = {
  id: ['id'],
  name: ['name'],
  uuid: ['uuid'],
  ip: ['ip'],
  reason: ['reason'],
  operator: ['operator', 'punisher', 'staff'] as string[],
  type: ['type', 'punishmentType'] as string[],
  start: ['start', 'created'] as string[],
  end: ['end', 'expires', 'until'] as string[],
  active: ['active', 'isActive'] as string[],
  calculation: ['calculation', 'calc', 'duration'] as string[],
};

export type AdvancedBanWatcherOptions = { pollIntervalMs?: number };

export async function startAdvancedBanWatcher(client: Client, opts: AdvancedBanWatcherOptions = {}) {
  const pollIntervalMs = Number(process.env.ADV_BAN_POLL_MS || opts.pollIntervalMs || 5000);

  await fs.ensureDir(path.dirname(CURSOR_FILE));

  const pool = await createPool();
  const schema = await resolveSchema(pool);
  let lastId = await loadCursor();

  if (lastId === 0) {
    lastId = await getCurrentMaxId(pool, schema.table, schema.columns.id);
    await saveCursor(lastId);
    console.log(`[AdvancedBan] Initial cursor set to id=${lastId}`);
  }

  console.log(`[AdvancedBan] Watching ${schema.table} every ${pollIntervalMs} ms`);

  setInterval(async () => {
    try {
      const onlyType = (process.env.ADV_BAN_ONLY_TYPE || '').trim().toUpperCase() || null;
      const newRows = await fetchNewPunishments(pool, schema, lastId, onlyType);
      if (!newRows.length) return;

      for (const row of newRows) {
        await sendPunishmentCard(client, pool, schema, row);
        lastId = Math.max(lastId, row._id as number);
      }

      await saveCursor(lastId);
    } catch (err) {
      console.error('[AdvancedBan] Poll error:', err);
    }
  }, pollIntervalMs);
}

/* ----------------------- MySQL & schema helpers ----------------------- */

async function createPool(): Promise<Pool> {
  const pool = mysql.createPool({
    host: process.env.ADV_BAN_DB_HOST || '127.0.0.1',
    port: Number(process.env.ADV_BAN_DB_PORT || 3306),
    user: process.env.ADV_BAN_DB_USER || 'advancedban',
    password: process.env.ADV_BAN_DB_PASS || '',
    database: process.env.ADV_BAN_DB_NAME || 'advancedban',
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: true,
  });
  await pool.query('SELECT 1');
  return pool;
}

async function resolveSchema(pool: Pool) {
  const table = (process.env.ADV_BAN_ACTIVE_TABLE || 'punishments').trim();

  type Col = { COLUMN_NAME: string } & RowDataPacket;
  const [rows] = await pool.query<Col[]>(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  const cols = rows.map(r => r.COLUMN_NAME.toLowerCase());

  const pick = (envName: string | undefined, cands: string[], { optional = false } = {}) => {
    const envVal = (envName || '').trim();
    if (envVal) {
      if (cols.includes(envVal.toLowerCase())) return envVal;
      console.warn(`[AdvancedBan] Column from .env not found in table: ${envVal} — ignoring`);
      return optional ? null : cands.find(c => cols.includes(c.toLowerCase())) || cands[0];
    }
    const found = cands.find(c => cols.includes(c.toLowerCase()));
    if (found) return found;
    return optional ? null : cands[0];
  };

  const columns = {
    id: pick(process.env.ADV_BAN_ID_COL, FALLBACK_COLUMN_CANDIDATES.id) as string,
    name: pick(process.env.ADV_BAN_NAME_COL, FALLBACK_COLUMN_CANDIDATES.name) as string,
    uuid: pick(process.env.ADV_BAN_UUID_COL, FALLBACK_COLUMN_CANDIDATES.uuid) as string,
    ip: pick(undefined, FALLBACK_COLUMN_CANDIDATES.ip, { optional: true }) as string | null,
    reason: pick(process.env.ADV_BAN_REASON_COL, FALLBACK_COLUMN_CANDIDATES.reason) as string,
    operator: pick(process.env.ADV_BAN_OPERATOR_COL, FALLBACK_COLUMN_CANDIDATES.operator) as string,
    type: pick(process.env.ADV_BAN_TYPE_COL, FALLBACK_COLUMN_CANDIDATES.type) as string,
    start: pick(process.env.ADV_BAN_START_COL, FALLBACK_COLUMN_CANDIDATES.start) as string,
    end: pick(process.env.ADV_BAN_END_COL, FALLBACK_COLUMN_CANDIDATES.end) as string,
    active: pick(undefined, FALLBACK_COLUMN_CANDIDATES.active, { optional: true }) as string | null,
    calculation: pick(process.env.ADV_BAN_CALC_COL, FALLBACK_COLUMN_CANDIDATES.calculation, { optional: true }) as string | null,
  } as const;

  return { table, columns } as const;
}

async function getCurrentMaxId(pool: Pool, table: string, idCol: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(${mysql.escapeId(idCol)}) as maxId FROM ${mysql.escapeId(table)}`
  );
  const maxId = Number((rows[0] as any)?.maxId || 0);
  return Number.isFinite(maxId) ? maxId : 0;
}

async function fetchNewPunishments(
  pool: Pool,
  schema: { table: string; columns: Record<string, string | null> },
  lastId: number,
  onlyType: string | null,
) {
  const { table, columns } = schema as any;
  const idCol = columns.id as string;
  const nameCol = columns.name as string;
  const uuidCol = columns.uuid as string;
  const ipCol = columns.ip as string | null;
  const reasonCol = columns.reason as string;
  const opCol = columns.operator as string;
  const typeCol = columns.type as string;
  const startCol = columns.start as string;
  const endCol = columns.end as string;
  const activeCol = columns.active as string | null;

  const whereType = onlyType ? `AND UPPER(${mysql.escapeId(typeCol)}) LIKE :onlyType` : '';

  const selectParts = [
    `${mysql.escapeId(idCol)} AS _id`,
    `${mysql.escapeId(nameCol)} AS _name`,
    `${mysql.escapeId(uuidCol)} AS _uuid`,
    `${reasonCol ? mysql.escapeId(reasonCol) + ' AS _reason' : `'Brak powodu' AS _reason'`}`,
    `${mysql.escapeId(opCol)} AS _operator`,
    `${mysql.escapeId(typeCol)} AS _type`,
    `${mysql.escapeId(startCol)} AS _start`,
    `${mysql.escapeId(endCol)} AS _end`,
  ];
  if (ipCol) selectParts.splice(3, 0, `${mysql.escapeId(ipCol)} AS _ip`); else selectParts.splice(3, 0, `' ' AS _ip`);
  if (activeCol) selectParts.push(`${mysql.escapeId(activeCol)} AS _active`);

  const sql = `
    SELECT 
      ${selectParts.join(',\n      ')}
    FROM ${mysql.escapeId(table)}
    WHERE ${mysql.escapeId(idCol)} > :lastId
      ${whereType}
    ORDER BY ${mysql.escapeId(idCol)} ASC
    LIMIT 200
  `;

  const params: any = { lastId };
  if (onlyType) params.onlyType = `${onlyType}%`;

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  return (rows as RowDataPacket[]).map((r: any) => {
    const _start = normalizeEpoch(Number(r._start));
    const _end = normalizeEpoch(Number(r._end));
    const hasActive = Object.prototype.hasOwnProperty.call(r, '_active');
    const _active = hasActive ? toBool(r._active) : computeActiveFromDates(_start, _end, String(r._type || ''));

    return {
      _id: Number(r._id),
      _name: String(r._name || ''),
      _uuid: String(r._uuid || ''),
      _ip: String(r._ip || ''),
      _reason: String(r._reason || 'Brak powodu'),
      _operator: String(r._operator || 'Console'),
      _type: normalizeType(String(r._type || 'UNKNOWN')),
      _start,
      _end,
      _active,
    };
  });
}

function computeActiveFromDates(_startMs: number | null, endMs: number | null, _type: string): boolean {
  if (!endMs) return true;
  return Date.now() < endMs;
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n !== 0;
  const s = String(v || '').toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y';
}

function normalizeType(t: string): string {
  const s = t.toUpperCase();
  if (s.includes('TEMP') && s.includes('BAN')) return 'TEMP_BAN';
  if (s.includes('BAN')) return 'BAN';
  if (s.includes('TEMP') && s.includes('MUTE')) return 'TEMP_MUTE';
  if (s.includes('MUTE')) return 'MUTE';
  if (s.includes('WARN')) return 'WARN';
  if (s.includes('KICK')) return 'KICK';
  return s;
}

function normalizeEpoch(v: number | null | undefined): number | null {
  if (!v || !Number.isFinite(v)) return null;
  if (v < 10_000_000_000) return v * 1000;
  return v;
}

/* ----------------------- Renderer PNG (ban card) ----------------------- */

function fmtDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

async function renderBanCardPNG(opts: {
  playerName: string; uuid?: string; totalBans?: number; brand?: string; footer?: string; timestamp?: Date;
}) {
  const W = 816, H = 311;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // tło
  ctx.fillStyle = '#0f1113';
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = '#2a2d2f';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // header: fioletowy z gradientem + stripes (clip)
  const headerH = 62;
  const headerX = 8, headerY = 8, headerW = W - 16;
  const grad = ctx.createLinearGradient(0, headerY, 0, headerY + headerH);
  grad.addColorStop(0, '#5b21b6');
  grad.addColorStop(1, '#3b0764');
  ctx.fillStyle = grad;
  ctx.fillRect(headerX, headerY, headerW, headerH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(headerX, headerY, headerW, headerH);
  ctx.clip();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  const stripeW = 26;
  for (let x = -W; x < W; x += stripeW) {
    ctx.beginPath();
    ctx.moveTo(x, headerY);
    ctx.lineTo(x + 18, headerY);
    ctx.lineTo(x + 18 + headerH, headerY + headerH);
    ctx.lineTo(x + headerH, headerY + headerH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // wyśrodkowany tytuł
  const title = 'Zablokowano konto!';
  ctx.font = '600 28px "Segoe UI", Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  const titleW = ctx.measureText(title).width;
  ctx.fillText(title, headerX + (headerW - titleW) / 2, headerY + headerH / 2);

  // „Łącznie blokad” — fioletowy badge
  // „Łącznie blokad” — MAŁY fioletowy badge (numer nie wychodzi poza tło)
  if (typeof opts.totalBans === 'number') {
    const label = 'Łącznie blokad';
    const value = opts.totalBans.toLocaleString('pl-PL');

    // male fonty
    const labelFont = 'bold 11px "Segoe UI", Arial';
    const valueFont = 'bold 14px "Segoe UI", Arial';

    // paddingy i odstępy
    const padX = 10;
    const padY = 6;
    const gapY = 3;
    const radius = 8;

    // Pomocnik do pobrania "realnej" wysokości linii z metryk (fallback, gdy brak ABB*)
    const lineH = (font: string, sample: string) => {
      ctx.save();
      ctx.font = font;
      const m = ctx.measureText(sample);
      ctx.restore();
      const asc = (m as any).actualBoundingBoxAscent ?? 0;
      const desc = (m as any).actualBoundingBoxDescent ?? 0;
      if (asc + desc > 0) return Math.ceil(asc + desc);
      // fallback przy braku metryk: ~1.3x rozmiar czcionki
      const size = Number(font.match(/(\d+)px/)?.[1] ?? 12);
      return Math.ceil(size * 1.3);
    };

    // szerokości i wysokości tekstów
    ctx.font = labelFont;
    const labelW = ctx.measureText(label).width;
    const labelH = lineH(labelFont, label);

    ctx.font = valueFont;
    const valueW = ctx.measureText(value).width;
    const valueH = lineH(valueFont, value);

    const innerW = Math.max(labelW, valueW);
    const innerH = labelH + gapY + valueH;

    // badge dopasowany do tekstów (MAŁY)
    const badgeW = Math.ceil(innerW + padX * 2);
    const badgeH = Math.ceil(innerH + padY * 2);

    // pozycja po prawej, centrowana w headerze
    const x = headerX + headerW - badgeW - 10;
    const y = headerY + Math.floor((headerH - badgeH) / 2);

    // tło: fioletowy gradient + obramówka
    const gradBadge = ctx.createLinearGradient(x, y, x, y + badgeH);
    gradBadge.addColorStop(0, '#7e22ce');
    gradBadge.addColorStop(1, '#581c87');

    const roundRect = (fx: number, fy: number, fw: number, fh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(fx + r, fy);
      ctx.lineTo(fx + fw - r, fy);
      ctx.quadraticCurveTo(fx + fw, fy, fx + fw, fy + r);
      ctx.lineTo(fx + fw, fy + fh - r);
      ctx.quadraticCurveTo(fx + fw, fy + fh, fx + fw - r, fy + fh);
      ctx.lineTo(fx + r, fy + fh);
      ctx.quadraticCurveTo(fx, fy + fh, fx, fy + fh - r);
      ctx.lineTo(fx, fy + r);
      ctx.quadraticCurveTo(fx, fy, fx + r, fy);
      ctx.closePath();
    };

    // wypełnienie
    ctx.fillStyle = gradBadge;
    roundRect(x, y, badgeW, badgeH, radius);
    ctx.fill();

    // obramówka
    ctx.strokeStyle = '#3f1a6a';
    ctx.lineWidth = 2;
    roundRect(x + 1, y + 1, badgeW - 2, badgeH - 2, radius - 1);
    ctx.stroke();

    // Teksty: bazujemy na baseline 'alphabetic', żeby nic nie ucinało
    const prevBaseline = ctx.textBaseline;
    ctx.textBaseline = 'alphabetic';

    // delikatny jasnoszary tekst + nowoczesna czcionka
    ctx.fillStyle = '#e2e2e2ff';

    // napis górny – większy, półgruby
    ctx.font = '600 11px "Poppins", Arial';
    const labelX = x + (badgeW - labelW) / 2;
    const labelY = y + padY + labelH;
    ctx.fillText(label, Math.round(labelX), Math.round(labelY));

    // liczba – mniejsza i subtelniejsza (niższa waga fontu)
    ctx.font = '500 10px "Poppins", Calibri';
    const valueX = x + (badgeW - valueW) / 2;
    const valueY = labelY + gapY + valueH;
    ctx.fillText(value, Math.round(valueX), Math.round(valueY));

    ctx.textBaseline = prevBaseline;


  }



  // lewy pasek
  ctx.fillStyle = '#6d28d9';
  ctx.fillRect(14, headerY + headerH + 16, 6, H - headerH - 32);

  // avatar
  const avatarX = 36, avatarY = headerY + headerH + 28, avatarSize = 96;
  let drewAvatar = false;
  try {
    const uuid = (opts.uuid || '').replaceAll('-', '');
    const candidates = [
      uuid ? `https://crafatar.com/avatars/${uuid}?size=${avatarSize}&overlay` : '',
      opts.playerName ? `https://minotar.net/avatar/${encodeURIComponent(opts.playerName)}/${avatarSize}` : '',
      `https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7?size=${avatarSize}&overlay`,
    ].filter(Boolean);
    for (const url of candidates) {
      try {
        const img = await loadImage(url);
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        drewAvatar = true;
        break;
      } catch {}
    }
  } catch {}

  // treść
  const contentX = avatarX + (drewAvatar ? avatarSize + 24 : 0) + 24;
  const contentTop = headerY + headerH + 30;

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 24px "Segoe UI", Arial';
  const headline = `Wykryto podejrzane działanie użytkownika ${opts.playerName}.`;
  wrapText(ctx, headline, contentX, contentTop, W - contentX - 30, 30);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '17px "Segoe UI", Arial';
  const brand = opts.brand || 'CHAOSMC.ZONE';
  const paragraph =
    `Konto użytkownika zostało zablokowane na wszystkich trybach serwera ${brand}. ` +
    `Naruszanie zasad lub używanie niedozwolonych modyfikacji może skutkować kolejnymi sankcjami. ` +
    `Dbaj o uczciwą grę, by uniknąć podobnych konsekwencji.`;
  wrapText(ctx, paragraph, contentX, contentTop + 48, W - contentX - 30, 26);

  // separator
  ctx.strokeStyle = '#2b2f33';
  ctx.lineWidth = 2;
  const sepY = H - 56;
  ctx.beginPath();
  ctx.moveTo(22, sepY);
  ctx.lineTo(W - 22, sepY);
  ctx.stroke();

  // stopka wyśrodkowana
  ctx.fillStyle = '#9aa1a9';
  ctx.font = '16px "Segoe UI", Arial';
  const when = opts.timestamp ? fmtDate(opts.timestamp) : fmtDate(new Date());
  const footer = `${opts.footer || 'System Anticheat'} • ${when}`;
  const fw = ctx.measureText(footer).width;
  ctx.fillText(footer, (W - fw) / 2, H - 24);

  return canvas.toBuffer('image/png');
}

function wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    const m = ctx.measureText(test).width;
    if (m > maxWidth) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

/* ----------------------- Discord sender (image) ----------------------- */

async function sendPunishmentCard(
  client: Client,
  pool: Pool,
  schema: { table: string; columns: Record<string, string | null> },
  row: any
) {
  const explicitLogId = (process.env.BAN_LOG_CHANNEL_ID || '').trim();
  const logChannelId = explicitLogId || (await getLogChannelId());
  if (!logChannelId) return;

  const channel = await client.channels.fetch(logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const totalBans = await countTotalBans(pool, schema);

  const png = await renderBanCardPNG({
    playerName: row._name || 'Nieznany',
    uuid: row._uuid || undefined,
    totalBans,
    brand: 'CHAOSMC.ZONE',
    footer: 'System Anticheat',
    timestamp: row._start ? new Date(row._start) : new Date(),
  });

  const file = new AttachmentBuilder(png, { name: `ban-${row._id}.png` });
  await (channel as TextChannel).send({ files: [file] }).catch(() => undefined);
}

async function countTotalBans(pool: Pool, schema: { table: string; columns: Record<string, string | null> }) {
  const typeCol = schema.columns.type as string;
  const table = schema.table;
  const sql = `SELECT COUNT(*) AS c FROM ${mysql.escapeId(table)} WHERE UPPER(${mysql.escapeId(typeCol)}) LIKE 'BAN%'`;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    const c = Number((rows[0] as any)?.c || 0);
    return Number.isFinite(c) ? c : 0;
  } catch {
    return 0;
  }
}

/* ----------------------- Cursor helpers ----------------------- */

async function loadCursor(): Promise<number> {
  try {
    const raw = await fs.readFile(CURSOR_FILE, 'utf8');
    const json = JSON.parse(raw);
    return Number(json.lastId || 0);
  } catch {
    return 0;
  }
}

async function saveCursor(lastId: number) {
  await fs.writeJson(CURSOR_FILE, { lastId }, { spaces: 2 });
}
