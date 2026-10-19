#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

console.log('Generates ADMIN_PASSWORD_HASH for the admin dashboard Vercel project.\n');
const password = await rl.question('Enter the admin dashboard password: ');
rl.close();

if (!password) {
  console.error('❌ Admin password is required');
  process.exit(1);
}

console.log('\nAdd this environment variable on Vercel (Production, Preview, Development):\n');
console.log(`   ADMIN_PASSWORD_HASH = ${bcrypt.hashSync(password, 12)}`);
