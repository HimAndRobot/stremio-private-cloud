import { readFileSync, mkdirSync, existsSync } from 'fs';
import { createServer } from 'https';
import { resolve } from 'path';
import express from 'express';
import cors from 'cors';
import addonSdk from 'stremio-addon-sdk';
const { addonBuilder, getRouter } = addonSdk;

import config from './config.js';
import { migrate } from './db/migrations.js';
import { buildManifest } from './addon/manifest.js';
import { catalogHandler } from './addon/catalog.js';
import { streamHandler, setStreamBaseUrl, updateBaseUrlFromRequest } from './addon/stream.js';
import streamingRouter from './streaming/router.js';
import apiRouter from './api/router.js';
import { getLanIp, getAddonUrl } from './utils/network.js';

// Ensure data directories exist
mkdirSync(config.uploadDir, { recursive: true });

// Run database migrations
migrate();

// Build Stremio addon
const manifest = buildManifest();
const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(catalogHandler);
builder.defineStreamHandler(streamHandler);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Capture real hostname from first request for stream URLs
app.use((req, res, next) => {
  updateBaseUrlFromRequest(req);
  next();
});

// Mount Stremio addon routes
const addonRouter = getRouter(builder.getInterface());
app.use('/', addonRouter);

// Mount video streaming routes
app.use('/', streamingRouter);

// Mount management API
app.use('/api', apiRouter);

// Serve frontend static files
const frontendDist = resolve(config.rootDir, 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use('/admin', express.static(frontendDist));
  app.use('/admin', (req, res) => {
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

// Detect LAN IP and build URLs
const lanIp = getLanIp();
const baseUrl = getAddonUrl(lanIp, config.port);
setStreamBaseUrl(baseUrl);

// Load TLS certificates
const certPath = resolve(config.certsDir, 'local-ip.pem');
const keyPath = resolve(config.certsDir, 'local-ip.key');

let cert, key;
try {
  cert = readFileSync(certPath);
  key = readFileSync(keyPath);
} catch {
  console.error('Failed to load TLS certificates from', config.certsDir);
  console.error('Run: curl -s https://local-ip.medicmobile.org/fullchain -o certs/local-ip.pem');
  console.error('     curl -s https://local-ip.medicmobile.org/key -o certs/local-ip.key');
  process.exit(1);
}

// Start HTTPS server
const server = createServer({ cert, key }, app);

// API endpoint so frontend can build the correct addon URL
app.get('/api/server-info', (req, res) => {
  let host = req.headers.host || '';
  res.json({
    addonUrl: `https://${host}/manifest.json`,
    adminUrl: `https://${host}/admin`,
  });
});

server.listen(config.port, config.host, () => {
  const validIp = lanIp && /^(192\.168|10\.)/.test(lanIp);
  console.log('');
  console.log('  Stremio Private Cloud is running!');
  if (validIp) {
    console.log(`  Admin: ${baseUrl}/admin`);
  } else {
    console.log(`  Admin: https://<IP>.local-ip.medicmobile.org:${config.port}/admin`);
    console.log('');
    console.log('  Replace <IP> with your LAN IP using dashes instead of dots.');
    console.log(`  Example: if your IP is 192.168.1.100, access:`);
    console.log(`  https://192-168-1-100.local-ip.medicmobile.org:${config.port}/admin`);
  }
  console.log('');
});
