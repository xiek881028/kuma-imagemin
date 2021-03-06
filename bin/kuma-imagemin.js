#!/usr/bin/env node

/**
 * @file 脚手架命令基类
 * @author xiek(285985285@qq.com)
 */

const pkg = require('../package.json');
const semver = require('semver');
const chalk = require('chalk');
const path = require('path');
const leven = require('leven');
const figlet = require('figlet');
const prettyBytes = require('pretty-bytes');
// node版本检测
const checkNodeVersion = (wanted, id) => {
  if (!semver.satisfies(process.version, wanted, { includePrerelease: true })) {
    console.log(
      chalk.red(
        '您使用的Node版本为 ' +
          process.version +
          ', 但 ' +
          id +
          ' 需要使用Node版本为 ' +
          wanted +
          '。\n请升级您的Node版本。'
      )
    );
    process.exit(1);
  }
};
// 放在开头运行，避免后续使用es7新语法报错（为啥不过babel？因为懒。。。）
checkNodeVersion(pkg.engines.node, pkg.name);

const { minDir, clearOrigin, clearLog, resetByOrigin, readLog } = require('../index');

class Cli {
  constructor(ops = {}) {
    this.bin = this.binName();
    const program = require('commander');

    const suggestCommands = unknownCommand => {
      const availableCommands = program.commands.map(cmd => cmd._name);
      let suggestion;
      availableCommands.forEach(cmd => {
        // 错误命令与标准命令最小路径 < 错误命令与空命令的最小路径
        const isBestMatch = leven(cmd, unknownCommand) < leven(suggestion || '', unknownCommand);
        if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
          suggestion = cmd;
        }
      });

      if (suggestion) {
        console.log(`  ` + chalk.red(`您是否是想运行 ${chalk.yellow(suggestion)}？`));
      }
    };

    program.addHelpText('beforeAll', figlet.textSync('kuma-imagemin'));

    program
      .version(`${pkg.name} ${pkg.version}`, '-v, --version', '查看版本')
      .helpOption('-h, --help', '获取帮助')
      .addHelpCommand('help [command]', '获取对应[command]命令的帮助信息')
      .usage('<command> [options]');

    program
      .command('min <路径>')
      .description('压缩指定的文件或文件夹')
      .option('-b, --backup', '压缩后备份源文件')
      .option('-f, --force', '强制压缩')
      .option('-q, --quality <0~100>', '选择压缩品质，0最低，100最高')
      .action(async (name, ops) => {
        const { backup, force, quality } = ops;
        // 转换输入路径为绝对路径，方便log日志记录
        await minDir(path.resolve(process.cwd(), name), {
          backup,
          force,
          quality,
        });
      });

    program
      .command('count')
      .description('查看压缩统计数据')
      .action(async (name, ops) => {
        const { count } = readLog();
        console.log(chalk.green(`总压缩文件：${count.total}`));
        console.log(chalk.yellow(`总忽略文件：${count.quit}`));
        console.log(chalk.red(`总压缩失败：${count.error}`));
        console.log(chalk.white(`总原始大小：${prettyBytes(count.preLen)}`));
        console.log(chalk.white(`总压缩大小：${prettyBytes(count.nextLen)}`));
        console.log(chalk.white(`最佳压缩率：${count.best}%`));
        console.log(
          chalk.white(
            `平均压缩率：${
              count.preLen ? (100 - (count.nextLen * 100) / count.preLen).toFixed(2) : 0
            }%`
          )
        );
        console.log(chalk.white(`最大的文件：${prettyBytes(count.max)}`));
        console.log(chalk.white(`最小的文件：${prettyBytes(count.min)}`));
      });

    program
      .command('clearOrigin <路径>')
      .description('清除源文件（需要在压缩时备份源文件）')
      .action(async (name, ops) => {
        await clearOrigin(name);
        console.log('源文件清除完成');
      });

    program
      .command('clearLog')
      .description('清除压缩记录')
      .action(async (name, ops) => {
        await clearLog();
        console.log('压缩记录清除完成');
      });

    program
      .command('resetByOrigin <路径>')
      .description('使用源文件覆盖压缩后文件（需要在压缩时备份源文件）')
      .action(async (name, ops) => {
        await resetByOrigin(name);
        console.log('源文件覆盖完成');
      });

    // 在用户输入未知命令时显示帮助信息
    program.on('command:*', ([cmd]) => {
      // program.outputHelp()
      console.log(`  ` + chalk.red(`未知的命令 ${chalk.yellow(cmd)}.`));
      console.log();
      suggestCommands(cmd);
      process.exitCode = 1;
    });

    program.on('--help', () => {
      console.log();
      console.log(
        `  运行 ${chalk.cyan(`${this.bin} <command> --help`)} 查看对应 command 的帮助信息。`
      );
      console.log();
    });

    program.commands.forEach(c => c.on('--help', () => console.log()));
    this.program = program;
  }

  binName() {
    const scriptPath = process.argv[1];
    return this.bin || (scriptPath && path.basename(scriptPath, path.extname(scriptPath)));
  }

  run() {
    // 公用错误处理
    const enhanceErrorMessages = require('../lib/util/enhanceErrorMessages');

    enhanceErrorMessages('missingArgument', argName => {
      return `缺少必传配置项 ${chalk.yellow(`<${argName}>`)}.`;
    });

    enhanceErrorMessages('unknownOption', optionName => {
      return `未知的选项option ${chalk.yellow(optionName)}`;
    });

    enhanceErrorMessages('optionMissingArgument', (option, flag) => {
      return (
        `选项option 缺少必传配置项 ${chalk.yellow(option.flags)}` +
        (flag ? `, got ${chalk.yellow(flag)}` : ``)
      );
    });

    this.program.parse(process.argv);

    // 没有捕获参数直接输出帮助列表
    if (!process.argv.slice(2).length) {
      this.program.outputHelp();
    }
  }
}

const imagemin = new Cli();
imagemin.run();
