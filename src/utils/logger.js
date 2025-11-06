import chalk from 'chalk';

export const logInfo = msg => console.log(`${chalk.cyanBright('[INFO]')} ${msg}`);
export const logSuccess = msg => console.log(`${chalk.greenBright('[✓]')} ${msg}`);
export const logError = msg => console.error(`${chalk.redBright('[ERROR]')} ${msg}`);
export const logWarning = msg => console.warn(`${chalk.yellowBright('[WARNING]')} ${msg}`);
export const logDebug = msg => console.debug(`${chalk.yellow('[DEBUG]')} ${msg}`);
