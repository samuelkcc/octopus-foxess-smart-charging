import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';

export const remoteCookie = '__Host-octopus-remote';
const digest = value => createHash('sha256').update(String(value || '')).digest();
export const createRemoteKey = () => randomBytes(32).toString('base64url');
export function matchesRemoteKey(supplied, expected) {
  return Boolean(expected && supplied && String(supplied).length <= 128 && timingSafeEqual(digest(supplied), digest(expected)));
}

export class RemoteSessions {
  sessions = new Map();
  failures = [];
  clear() { this.sessions.clear(); this.failures = []; }
  limited(now = Date.now()) {
    this.failures = this.failures.filter(at => now - at < 60_000);
    return this.failures.length >= 10;
  }
  fail() { this.failures.push(Date.now()); }
  issue(key) {
    const now = Date.now();
    for (const [id, session] of this.sessions) if (session.until <= now) this.sessions.delete(id);
    if (this.sessions.size >= 128) this.sessions.delete(this.sessions.keys().next().value);
    const token = createRemoteKey();
    this.sessions.set(digest(token).toString('hex'), { key: digest(key).toString('hex'), until: now + 12 * 60 * 60_000 });
    return token;
  }
  token(request) {
    return String(request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${remoteCookie}=`))?.slice(remoteCookie.length + 1) || '';
  }
  revoke(request) { this.sessions.delete(digest(this.token(request)).toString('hex')); }
  valid(request, key) {
    const session = this.sessions.get(digest(this.token(request)).toString('hex'));
    return Boolean(key && session && session.until > Date.now() && session.key === digest(key).toString('hex'));
  }
}

// This process can only forward to the dedicated, unprivileged remote listener.
// Never point cloudflared at the LAN/admin listener.
export class QuickTunnel {
  constructor({ url, binary = process.env.OCTOPUS_CLOUDFLARED || 'cloudflared', spawnProcess = spawn }) {
    this.target = url;
    this.binary = binary;
    this.spawnProcess = spawnProcess;
    this.enabled = false;
    this.status = { state: 'disabled', url: null, error: null };
  }
  start() {
    this.enabled = true;
    if (this.child || this.retry) return;
    this.status = { state: 'starting', url: null, error: null };
    const child = this.spawnProcess(this.binary, ['tunnel', '--no-autoupdate', '--config', process.platform === 'win32' ? 'NUL' : '/dev/null', '--url', this.target], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    this.child = child;
    let startupTimer;
    this.clearStartup = () => clearTimeout(startupTimer);
    let buffer = '';
    let publicUrl = null;
    const connections = new Set();
    let connected = false;
    const onData = chunk => {
      if (this.child !== child) return;
      buffer = (buffer + chunk.toString()).slice(-8192);
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
        if (match) publicUrl = match[0];
        const index = line.match(/connIndex[=:]\s*([0-9]+)/)?.[1] || 'default';
        if (/Registered tunnel connection/.test(line)) {connections.add(index);clearTimeout(startupTimer);}
        if (/failed to serve tunnel connection|connection terminated|Unable to establish connection/i.test(line)) connections.delete(index);
        connected = connections.size > 0;
      }
      this.status = { state: connected && publicUrl ? 'running' : publicUrl ? 'connecting' : 'starting',
        url: connected ? publicUrl : null, error: publicUrl && !connected ? 'Connecting to Cloudflare. The URL is not ready yet.' : null };
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const ended = error => {
      if (this.child !== child) return;
      clearTimeout(startupTimer);
      this.child = null;
      this.status = { state: 'error', url: null, error: error?.code === 'ENOENT' ? 'cloudflared is not installed. Run the updated Pi installer.' : 'Tunnel disconnected; retrying in 30 seconds.' };
      if (this.enabled) this.retry = setTimeout(() => { this.retry = null; this.start(); }, 30_000);
    };
    startupTimer = setTimeout(() => { if (this.child === child && !connected) {ended();child.kill('SIGTERM');} }, 120_000);
    startupTimer.unref?.();
    child.once('error', ended);
    child.once('exit', () => ended());
  }
  restart() {
    this.stop();
    this.start();
  }
  stop() {
    this.enabled = false;
    this.clearStartup?.();
    clearTimeout(this.retry);
    this.retry = null;
    const child = this.child;
    this.child = null;
    child?.kill('SIGTERM');
    this.status = { state: 'disabled', url: null, error: null };
  }
}
