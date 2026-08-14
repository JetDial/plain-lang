// Plain - sending email.
//
//     use the mail server "smtp.example.com" on port 587
//     sign in to the mail server as "me@example.com" with password secret
//     send an email from "me@example.com" to "you@example.com" about "Hello"
//         saying "It worked."
//
// Nearly every program that keeps things eventually has to tell somebody
// about them: a receipt, a reset link, a nightly summary. That means SMTP,
// which is an old conversation between two machines, and a message written
// in a shape from before anybody had accents in their name.
//
// The conversation happens in a helper of its own, because sending has to
// finish before the next line runs and the interpreter waits for nothing.
// The message is built here, where it can be read and checked.

import { toText, toNumber } from '../../src/values.js';

export function installMail(rt, host = {}) {
  if (rt.libraries.has('mail')) return rt.mail;
  rt.libraries.add('mail');

  const mail = { host: null, port: 587, user: null, password: null, last: null };
  rt.mail = mail;

  const needTerminal = (ctx) => {
    ctx.fail(
      'Sending email only works when Plain runs in a terminal',
      'a page is not allowed to open a conversation with a mail server'
    );
  };

  rt.define('use the mail server $host on port $port', (a) => {
    mail.host = toText(a.host);
    mail.port = Math.round(toNumber(a.port));
  });

  rt.define('sign in to the mail server as $user with password $password', (a) => {
    mail.user = toText(a.user);
    mail.password = toText(a.password);
  });

  const send = (a, ctx, subject) => {
    if (!host.sendMail) needTerminal(ctx);
    if (!mail.host) {
      ctx.fail(
        'I do not know which mail server to use',
        'say so first: use the mail server "smtp.example.com" on port 587'
      );
    }
    const message = {
      from: toText(a.from).trim(),
      to: toText(a.to).trim(),
      subject: toText(subject),
      body: toText(a.body)
    };
    for (const which of ['from', 'to']) {
      if (!looksLikeAddress(message[which])) {
        ctx.fail(`"${message[which]}" does not look like an email address`);
      }
    }
    mail.last = host.sendMail(mail, message, ctx);
  };

  rt.define('send an email from $from to $to about $subject saying $body', (a, ctx) => {
    send(a, ctx, a.subject);
  });

  rt.define('send an email from $from to $to saying $body', (a, ctx) => {
    send(a, ctx, 'A message from Plain');
  });

  rt.defineValue('what the mail server said', () => (mail.last === null ? '' : mail.last));

  return mail;
}

// Not a full check - nobody has one that is both correct and short - but
// enough to catch the mistakes people actually make.
export function looksLikeAddress(text) {
  const one = String(text || '').trim();
  if (!/^[^\s@<>",;]+@[^\s@<>",;.]+(\.[^\s@<>",;.]+)+$/.test(one)) return false;
  return one.length <= 254;
}

// Anything outside plain ASCII has to be written down in a way a mail server
// from 1982 will carry without changing it. A subject line does that with
// =?UTF-8?B?...?=, and the message itself is turned into base64 lines.
export function encodeHeader(text) {
  const words = String(text ?? '');
  if (/^[\x20-\x7e]*$/.test(words) && words.length < 76) return words;
  return '=?UTF-8?B?' + Buffer.from(words, 'utf8').toString('base64') + '?=';
}

export function buildMessage(message, now = new Date(), tag = null) {
  const id = tag || Math.random().toString(36).slice(2) + Date.now().toString(36);
  const body = Buffer.from(String(message.body ?? ''), 'utf8').toString('base64');
  const lines = [];
  for (let at = 0; at < body.length; at += 76) lines.push(body.slice(at, at + 76));

  return [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@plain>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    ...lines
  ].join('\r\n') + '\r\n';
}
