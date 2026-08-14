// Plain - the half of sending email that talks to the mail server.
//
// Run as a program of its own, because sending has to finish before the next
// line of a Plain program runs, and the interpreter waits for nothing. It is
// handed one message on the command line and writes back what happened.
//
// The conversation is the same one mail servers have had since 1982: say
// hello, offer to lock the line, prove who you are, say who it is from and
// who it is for, then the message, then goodbye.

import net from 'node:net';
import tls from 'node:tls';

const settings = JSON.parse(process.argv[2]);
const message = process.argv[3];

const done = (answer) => {
  process.stdout.write(JSON.stringify(answer));
  process.exit(0);
};

let socket = null;
let held = '';
let waiting = null;

function expect(codes) {
  return new Promise((resolve, reject) => {
    waiting = { codes, resolve, reject };
    look();
  });
}

// A reply is one or more lines; only the last has a space after the number.
function look() {
  if (!waiting) return;
  const lines = held.split('\r\n');
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at];
    if (/^\d{3} /.test(line)) {
      const reply = lines.slice(0, at + 1).join('\n');
      held = lines.slice(at + 1).join('\r\n');
      const code = Number(line.slice(0, 3));
      const { codes, resolve, reject } = waiting;
      waiting = null;
      if (codes.includes(code)) resolve(reply);
      else reject(new Error(reply.trim()));
      return;
    }
  }
}

function listen(to) {
  to.setEncoding('utf8');
  to.on('data', piece => { held += piece; look(); });
  to.on('error', problem => {
    if (waiting) { const { reject } = waiting; waiting = null; reject(problem); }
    else done({ ok: false, said: String(problem.message || problem) });
  });
}

const say = (line) => new Promise(resolve => socket.write(line + '\r\n', resolve));

const base64 = (text) => Buffer.from(String(text), 'utf8').toString('base64');

try {
  const locked = settings.port === 465;
  socket = locked
    ? tls.connect({ host: settings.host, port: settings.port, servername: settings.host })
    : net.connect({ host: settings.host, port: settings.port });
  socket.setTimeout(30000, () => {
    done({ ok: false, said: 'the mail server did not answer in time' });
  });
  listen(socket);

  await new Promise((resolve, reject) => {
    socket.once(locked ? 'secureConnect' : 'connect', resolve);
    socket.once('error', reject);
  });
  await expect([220]);

  const me = 'plain';
  let offered = await say(`EHLO ${me}`).then(() => expect([250]));

  // Lock the line if the server can and it is not locked already.
  if (!locked && /STARTTLS/i.test(offered) && settings.starttls !== false) {
    await say('STARTTLS');
    await expect([220]);
    const older = socket;
    older.removeAllListeners('data');
    socket = tls.connect({ socket: older, servername: settings.host });
    held = '';
    listen(socket);
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    offered = await say(`EHLO ${me}`).then(() => expect([250]));
  }

  if (settings.user) {
    if (/AUTH[^\n]*PLAIN/i.test(offered)) {
      await say('AUTH PLAIN ' + base64(`\0${settings.user}\0${settings.password || ''}`));
      await expect([235]);
    } else {
      await say('AUTH LOGIN');
      await expect([334]);
      await say(base64(settings.user));
      await expect([334]);
      await say(base64(settings.password || ''));
      await expect([235]);
    }
  }

  await say(`MAIL FROM:<${settings.from}>`);
  await expect([250]);
  await say(`RCPT TO:<${settings.to}>`);
  await expect([250, 251]);
  await say('DATA');
  await expect([354]);

  // A line that is only a dot would end the message early, so any line
  // starting with one gets another in front of it.
  const body = message.split('\r\n').map(line => (line.startsWith('.') ? '.' + line : line)).join('\r\n');
  socket.write(body.endsWith('\r\n') ? body : body + '\r\n');
  await say('.');
  const said = await expect([250]);

  await say('QUIT');
  socket.end();
  done({ ok: true, said: said.trim() });
} catch (problem) {
  try { if (socket) socket.destroy(); } catch { /* already gone */ }
  done({ ok: false, said: String((problem && problem.message) || problem) });
}
