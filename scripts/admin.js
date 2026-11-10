// Admin account CLI (no sign-up API; one admin is assumed)
//   npm run admin:create   -- <adminId>
//   npm run admin:password -- <adminId>
//   npm run admin:rename   -- <currentId> <newId>
// Passwords are entered interactively (hidden), never passed as arguments.
import readline from 'node:readline';
import pool from '../src/config/db.js';
import {
  validateAdminId,
  validatePassword,
  findAdminById,
  countAdmins,
  createAdmin,
  changePassword,
  renameAdmin,
} from '../src/services/adminService.js';

class CliError extends Error {}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

// Non-interactive input (piped stdin): first line = password, second line = confirmation.
async function readPipedLines() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/);
}

async function readNewPassword() {
  let password;
  let confirm;
  if (process.stdin.isTTY) {
    password = await promptHidden('새 비밀번호: ');
    confirm = await promptHidden('새 비밀번호 확인: ');
  } else {
    [password = '', confirm = ''] = await readPipedLines();
  }

  if (password !== confirm) throw new CliError('비밀번호가 일치하지 않습니다.');
  const error = validatePassword(password);
  if (error) throw new CliError(error);
  return password;
}

function assertValidId(adminId) {
  const error = validateAdminId(adminId);
  if (error) throw new CliError(error);
}

async function requireExistingAdmin(adminId) {
  const admin = await findAdminById(adminId);
  if (!admin) throw new CliError(`관리자 계정 '${adminId}'을(를) 찾을 수 없습니다.`);
  return admin;
}

async function create([adminId]) {
  assertValidId(adminId);
  if ((await countAdmins()) > 0) {
    throw new CliError('관리자 계정이 이미 존재합니다. (관리자 1명 가정) admin:password 또는 admin:rename을 사용하세요.');
  }
  const password = await readNewPassword();
  await createAdmin(adminId, password);
  console.log(`관리자 계정 '${adminId}'을(를) 생성했습니다.`);
}

async function password([adminId]) {
  assertValidId(adminId);
  const admin = await requireExistingAdmin(adminId);
  const newPassword = await readNewPassword();
  await changePassword(admin.admin_id, newPassword);
  console.log(`'${admin.admin_id}'의 비밀번호를 변경했습니다. 기존 로그인은 모두 무효화됩니다.`);
}

async function rename([currentId, newId]) {
  assertValidId(currentId);
  assertValidId(newId);
  const admin = await requireExistingAdmin(currentId);

  const existing = await findAdminById(newId);
  if (existing && existing.admin_id !== admin.admin_id) {
    throw new CliError(`아이디 '${newId}'은(는) 이미 사용 중입니다.`);
  }

  await renameAdmin(admin.admin_id, newId);
  console.log(`아이디를 '${admin.admin_id}'에서 '${newId}'(으)로 변경했습니다. 기존 로그인은 모두 무효화됩니다.`);
}

const commands = { create, password, rename };
const [command, ...args] = process.argv.slice(2);

try {
  if (!commands[command]) {
    throw new CliError('사용법: node scripts/admin.js <create|password|rename> <args...>');
  }
  await commands[command](args);
  process.exitCode = 0;
} catch (err) {
  console.error(`[admin] ${err instanceof CliError ? err.message : `오류: ${err.code || ''} ${err.message}`}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
