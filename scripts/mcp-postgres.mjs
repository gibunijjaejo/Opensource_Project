/**
 * PostgreSQL MCP 서버 런처
 * .env에서 DB 정보를 읽어 MCP 서버를 실행합니다. (아이디/비번 코드 노출 없음)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// .env 파싱 (외부 패키지 의존 없이 직접 처리)
const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]*)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = env;

if (!DB_USER || !DB_PASSWORD || !DB_HOST || !DB_PORT || !DB_NAME) {
  console.error('ERROR: .env에 DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME 중 누락된 값이 있습니다.');
  process.exit(1);
}

const url = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

const child = spawn('npx', ['-y', '@modelcontextprotocol/server-postgres', url], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
  },
});

child.on('exit', code => process.exit(code ?? 0));
