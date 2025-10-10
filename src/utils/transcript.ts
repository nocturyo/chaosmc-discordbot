import { AttachmentBuilder, Guild, Message, TextChannel, userMention } from 'discord.js';

/**
 * Pobiera wszystkie wiadomości z kanału (od najstarszych do najnowszych)
 */
async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const out: Message[] = [];
  let lastId: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;
    const arr = [...batch.values()];
    out.push(...arr);
    lastId = arr[arr.length - 1].id;
    if (batch.size < 100) break;
  }

  // wiadomości rosnąco po czasie (od najstarszej)
  out.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return out;
}

/**
 * Generuje prosty, estetyczny HTML transkryptu (ciemny motyw).
 * Zwraca Attachment do wysłania oraz nazwę pliku.
 */
export async function makeTranscript(channel: TextChannel, guild: Guild) {
  const messages = await fetchAllMessages(channel);

  const title = `${guild.name} • #${channel.name} • Transcript`;
  const created = new Date().toLocaleString('pl-PL');

  const rows = await Promise.all(
    messages.map(async (m) => {
      const when = new Date(m.createdTimestamp).toLocaleString('pl-PL');
      const author = `${m.member?.displayName ?? m.author.username} (${m.author.tag})`;
      const avatar = m.author.displayAvatarURL({ extension: 'png', size: 64 });
      const content = escapeHtml(m.content || '');

      // załączniki (obrazy i pliki)
      const attachments: string[] = [];
      for (const att of m.attachments.values()) {
        const isImage = att.contentType?.startsWith('image/');
        attachments.push(
          isImage
            ? `<div class="attach"><a href="${att.url}" target="_blank"><img src="${att.url}" alt="attachment"/></a></div>`
            : `<div class="attach"><a href="${att.url}" target="_blank">${att.name ?? 'plik'}</a> (${Math.round(
                att.size / 1024,
              )} KB)</div>`,
        );
      }

      // wzmianki w treści (prosta zamiana)
      const withMentions = content
        .replace(/<@!?(\d+)>/g, (_, id) => userMention(id))
        .replace(/<#(\d+)>/g, 'kanał #$1')
        .replace(/<@&(\d+)>/g, 'rola @$1');

      return `
      <div class="msg">
        <img class="avatar" src="${avatar}" />
        <div class="b">
          <div class="meta"><span class="author">${escapeHtml(author)}</span><span class="time">${when}</span></div>
          <div class="content">${withMentions || '<i>(brak treści)</i>'}</div>
          ${attachments.join('\n')}
        </div>
      </div>`;
    }),
  );

  const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  :root{ color-scheme: dark; }
  body{ margin:0; font:14px/1.4 system-ui,Segoe UI,Roboto,Ubuntu; background:#0b0b0b; color:#e5e7eb;}
  header{ background:#111; border-bottom:1px solid #222; padding:16px 24px; }
  h1{ margin:0 0 4px 0; font-size:18px; }
  .sub{ color:#9ca3af; font-size:12px; }
  .wrap{ padding:24px; }
  .msg{ display:flex; gap:12px; padding:12px 0; border-bottom:1px solid #191919;}
  .avatar{ width:40px; height:40px; border-radius:50%; }
  .b{ flex:1; min-width:0; }
  .meta{ color:#9ca3af; font-size:12px; margin-bottom:4px; display:flex; gap:8px; }
  .author{ color:#e5e7eb; font-weight:600; }
  .content{ white-space:pre-wrap; word-break:break-word; }
  .attach{ margin-top:8px; }
  .attach img{ max-width:420px; border-radius:8px; border:1px solid #222; }
  footer{ padding:16px 24px; color:#9ca3af; font-size:12px; border-top:1px solid #222; background:#111; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">Wygenerowano: ${created}</div>
  </header>
  <div class="wrap">
    ${rows.join('\n')}
  </div>
  <footer>Transcript wygenerowany automatycznie przez CHAOSMC.ZONE</footer>
</body>
</html>`;

  const fileName = `${channel.name}-transcript-${Date.now()}.html`;
  const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: fileName });
  return { attachment, fileName };
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
