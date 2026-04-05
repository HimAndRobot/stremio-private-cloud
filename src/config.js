import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

const config = {
  port: parseInt(process.env.PORT || '11780', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: resolve(process.env.DATA_DIR || './data'),
  uploadDir: resolve(process.env.UPLOAD_DIR || './data/uploads'),
  rootDir: ROOT_DIR,
  certsDir: resolve(ROOT_DIR, 'certs'),
};

export default config;
