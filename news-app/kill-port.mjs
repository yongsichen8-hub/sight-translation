import { execSync } from 'child_process';
try {
  const r = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = r.split('\n').filter(l => l.includes(':4000') && l.includes('LISTENING'));
  const pids = [...new Set(lines.map(l => l.trim().split(/\s+/).pop()))];
  for (const pid of pids) {
    if (pid && pid !== '0') {
      try { execSync('taskkill /F /PID ' + pid); console.log('killed', pid); } catch { console.log('skip', pid); }
    }
  }
  if (pids.length === 0) console.log('no process on 4000');
} catch (e) { console.log('error:', e.message); }
