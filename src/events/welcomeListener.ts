import {
  AttachmentBuilder,
  Client,
  Events,
  TextChannel,
} from 'discord.js';
import { createCanvas, loadImage, CanvasRenderingContext2D, Image } from 'canvas';
import { getWelcomeChannelId } from '../utils/configManager';

export function setupWelcomeListener(client: Client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const channelId = getWelcomeChannelId();
      if (!channelId) return;

      const ch =
        member.guild.channels.cache.get(channelId) ??
        (await member.guild.channels.fetch(channelId).catch(() => null));
      if (!ch || !('send' in ch)) return;

      const buffer = await renderWelcomeCard({
        username: member.user.username,
        avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        memberCount: member.guild.memberCount,
        title: 'Witamy',
        subtitle: `${member.user.username}, cieszymy się, że dołączyłeś!`,
        body:
          'Aby uzyskać dostęp do serwera, przejdź na kanał weryfikacji i naciśnij przycisk.\n' +
          'Po pomyślnej weryfikacji otrzymasz rangę umożliwiającą korzystanie z serwera.',
        footerLabel: 'CHAOSMC.ZONE',
        timestamp: Date.now(),
      });

      const file = new AttachmentBuilder(buffer, { name: 'welcome.png' });
      await (ch as TextChannel).send({ files: [file] });
    } catch (e) {
      console.error('[welcomeListener] error:', e);
    }
  });
}

type CardOpts = {
  username: string;
  avatarURL: string;
  memberCount: number;
  title: string;
  subtitle: string;
  body: string;
  footerLabel: string;
  timestamp: number;
};

async function renderWelcomeCard(opts: CardOpts): Promise<Buffer> {
  const width = 1000;
  const height = 460;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;

  const CARD = '#171717';
  const ACCENT = '#8b5cf6'; // fioletowy pasek
  const TEXT = '#e5e7eb';
  const MUTED = '#9ca3af';

  // delikatny cień pod kartą
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 6;

  // sama karta (bez tła za nią)
  roundRect(ctx, 40, 40, width - 80, height - 80, 12, CARD);

  // wyłącz cień dla pozostałych elementów
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // fioletowy pasek
  ctx.fillStyle = ACCENT;
  ctx.fillRect(56, 64, 6, height - 128);

  // avatar
  const avatarSize = 96;
  try {
    const img = (await loadImage(opts.avatarURL)) as Image;
    circleImage(ctx, 500, 130, avatarSize / 2, img);
  } catch {
    // brak avatara — pomiń
  }

  // tytuł
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 36px sans-serif';
  const titleW = ctx.measureText(opts.title).width;
  ctx.fillText(opts.title, (width - titleW) / 2, 220);

  // podtytuł
  ctx.font = '20px sans-serif';
  ctx.fillStyle = TEXT;
  centerText(ctx, opts.subtitle, width / 2, 260);

  // body
  ctx.fillStyle = TEXT;
  ctx.font = '18px sans-serif';
  wrapCenter(ctx, opts.body, width / 2, 310, width - 200, 28);

  // separator
  ctx.strokeStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(80, height - 90);
  ctx.lineTo(width - 80, height - 90);
  ctx.stroke();

  // stopka
  ctx.fillStyle = MUTED;
  ctx.font = '16px sans-serif';
  const when = new Date(opts.timestamp).toLocaleString('pl-PL');
  const footer = `${opts.footerLabel} • ${when}`;
  ctx.fillText(footer, 100, height - 50);

  // liczba członków
  const badgeText = `${opts.memberCount.toLocaleString('pl-PL')} osób`;
  const padX = 18;
  ctx.font = 'bold 16px sans-serif';
  const tw = ctx.measureText(badgeText).width;
  const bx = width - 80 - (tw + padX * 2);
  const by = 64;
  roundRect(ctx, bx, by, tw + padX * 2, 34, 18, '#1f1f1f');
  ctx.fillStyle = MUTED;
  ctx.fillText(badgeText, bx + padX, by + 23);

  return canvas.toBuffer('image/png');
}

/* === Pomocnicze funkcje === */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function circleImage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  img: Image
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img as any, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  const w = ctx.measureText(text).width;
  ctx.fillText(text, cx - w / 2, y);
}

function wrapCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    let cur = '';
    for (const word of raw.split(' ')) {
      const next = (cur ? cur + ' ' : '') + word;
      if (ctx.measureText(next).width > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
  }
  for (const line of lines) {
    centerText(ctx, line, cx, y);
    y += lineHeight;
  }
}
