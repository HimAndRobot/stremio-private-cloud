import { networkInterfaces } from 'os';

// Get the first non-internal IPv4 address
export function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
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
