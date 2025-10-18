// src/utils/banCard.ts
import { createCanvas, loadImage } from '@napi-rs/canvas';

type BanCardOptions = {
  playerName: string;
  uuid?: string;
  totalBans?: number;          // liczba banów ogółem (opcjonalnie)
  brand?: string;              // np. "CHAOSMC.ZONE"
  footer?: string;             // np. "System Anticheat"
  timestamp?: Date;            // Date ban eventu
};

function fmtDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export async function renderBanCardPNG(opts: BanCardOptions): Promise<Buffer> {
  const W = 816, H = 311;                  // proporcje jak na screenie
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // tło (ciemny grafit)
  ctx.fillStyle = '#151718';
  ctx.fillRect(0, 0, W, H);

  // obramowanie (ciemny + delikatny glow)
  ctx.strokeStyle = '#2a2d2f';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // czerwony nagłówek z diagonalnym patternem
  const headerH = 62;
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(8, 8, W - 16, headerH);

  // diagonal stripes
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  const stripeW = 26;
  for (let x = -W; x < W; x += stripeW) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 18, 8);
    ctx.lineTo(x + 18 + headerH, 8 + headerH);
    ctx.lineTo(x + headerH, 8 + headerH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // tytuł
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠️ Zablokowano konto!', 26, 8 + headerH / 2);

  // badge „Łącznie blokad”
  if (typeof opts.totalBans === 'number') {
    const badgeTextTop = 'Łącznie blokad';
    const badgeTextNum = opts.totalBans.toLocaleString('pl-PL');
    const padX = 14, padY = 10;
    ctx.font = 'bold 16px Arial';
    const topW = ctx.measureText(badgeTextTop).width;
    ctx.font = 'bold 24px Arial';
    const numW = ctx.measureText(badgeTextNum).width;
    const badgeW = Math.max(topW, numW) + padX * 2;
    const badgeH = 56;

    const x = W - 8 - badgeW;
    const y = 8 + (headerH - badgeH) / 2;

    // badge tło
    ctx.fillStyle = '#dc2626';
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + badgeW - r, y);
    ctx.quadraticCurveTo(x + badgeW, y, x + badgeW, y + r);
    ctx.lineTo(x + badgeW, y + badgeH - r);
    ctx.quadraticCurveTo(x + badgeW, y + badgeH, x + badgeW - r, y + badgeH);
    ctx.lineTo(x + r, y + badgeH);
    ctx.quadraticCurveTo(x, y + badgeH, x, y + badgeH - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    // teksty
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(badgeTextTop, x + padX, y + 16);
    ctx.font = 'bold 24px Arial';
    ctx.fillText(badgeTextNum, x + padX, y + 38);
  }

  // lewa pionowa czerwona linia
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(14, headerH + 16, 6, H - headerH - 32);

  // avatar (pixel head z Crafatar wg UUID, fallback do Steve)
  const avatarX = 36, avatarY = headerH + 36, avatarSize = 92;
  try {
    const uuid = (opts.uuid || '').replaceAll('-', '');
    const url = uuid
      ? `https://crafatar.com/avatars/${uuid}?size=${avatarSize}&overlay`
      : `https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7?size=${avatarSize}&overlay`; // Steve
    const img = await loadImage(url);
    ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
  } catch {
    // nic — avatar opcjonalny
  }

  // duży nagłówek treści (pogrubiony)
  const contentX = avatarX + avatarSize + 24;
  const contentTop = headerH + 36;
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 28px Arial';
  const headline = `Wykryto podejrzane działanie użytkownika ${opts.playerName}.`;
  wrapText(ctx, headline, contentX, contentTop, W - contentX - 30, 33);

  // akapit opisu
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px Arial';
  const brand = opts.brand || 'CHAOSMC.ZONE';
  const paragraph = `Jego konto zostało trwale zablokowane na wszystkich trybach serwera ${brand}. ` +
    `Przypominamy, że naruszanie regulaminu, w tym stosowanie niedozwolonych praktyk, ` +
    `może skutkować podobnymi sankcjami. Dbaj o przestrzeganie zasad, aby uniknąć konsekwencji.`;
  wrapText(ctx, paragraph, contentX, contentTop + 52, W - contentX - 30, 26);

  // separator
  ctx.strokeStyle = '#303336';
  ctx.lineWidth = 2;
  const sepY = H - 56;
  ctx.beginPath();
  ctx.moveTo(22, sepY);
  ctx.lineTo(W - 22, sepY);
  ctx.stroke();

  // stopka
  ctx.fillStyle = '#9aa1a9';
  ctx.font = '16px Arial';
  const when = opts.timestamp ? fmtDate(opts.timestamp) : fmtDate(new Date());
  const footerLeft = `${opts.footer || 'System Anticheat'} • ${when}`;
  ctx.fillText(footerLeft, 26, H - 24);

  return canvas.toBuffer('image/png');
}

// prościutkie łamanie linii
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
