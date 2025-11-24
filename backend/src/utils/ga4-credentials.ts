import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const OUTPUT_DIR = 'ga4-creds';
const OUTPUT_FILE = 'service-account.json';

export function ensureGaCredsFile() {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) {
    return null;
  }

  const dir = path.join(os.tmpdir(), OUTPUT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const file = path.join(dir, OUTPUT_FILE);
  fs.writeFileSync(file, json, 'utf8');

  process.env.GOOGLE_APPLICATION_CREDENTIALS = file;

  return file;
}
