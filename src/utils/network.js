import { networkInterfaces } from 'os';
import { execSync } from 'child_process';

// Get the LAN IP of the host machine
export function getLanIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;

  // Inside Docker Desktop (Windows/Mac): resolve host.docker.internal
  try {
    const lines = execSync('getent ahostsv4 host.docker.internal', { timeout: 2000 })
      .toString().trim().split('\n');
    const ipv4 = lines[0]?.split(/\s+/)[0];
    if (ipv4 && /^\d+\.\d+\.\d+\.\d+$/.test(ipv4) && !ipv4.startsWith('127.')) return ipv4;
  } catch { /* not in Docker or Linux host */ }

  // Direct detection (works on host or Linux Docker with host network)
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.')) {
        return net.address;
      }
    }
  }

  return '127.0.0.1';
}

// Convert IP to dashed format for local-ip.medicmobile.org
export function ipToDashed(ip) {
  return ip.replace(/\./g, '-');
}

// Build the full HTTPS addon URL
export function getAddonUrl(ip, port) {
  const dashed = ipToDashed(ip);
  return `https://${dashed}.local-ip.medicmobile.org:${port}`;
}
