import dotenv from 'dotenv';
import { CONFIG } from './config/config.js';
import { HttpServer } from './server/httpServer.js';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from "fs";
import path from "path";
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const gitRev = require('git-rev-sync');
const branch = gitRev.branch();
const packageJson = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'));

dotenv.config({ quiet: true });

const banner = await figlet.text("Rider Agent Panel");

console.log(chalk.greenBright(banner));
const badge = chalk.black.bgGreenBright.bold(` v${packageJson.version} ` + chalk.black.bgWhite.bold(` ${packageJson.name}@${branch} `));

console.log(' ' + badge + '\n');
console.log(chalk.dim('By Benno van Dorst - https://github.com/bennovandorst'));
console.log(chalk.gray('─────────────────────────────────────────────────────────'));

const httpServer = new HttpServer(process.env.PORT, CONFIG.SIM_RIGS);
httpServer.start();
