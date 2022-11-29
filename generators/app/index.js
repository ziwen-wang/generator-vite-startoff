const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const boxen = require('boxen');
const chalk = require('chalk');
const beeper = require('beeper');
const download = require('download-git-repo');
const Generator = require('yeoman-generator');
const updateNotifier = require('update-notifier');
const pkg = require('../../package.json');

const BOXEN_OPTS = {
    padding: 1,
    margin: 1,
    align: 'center',
    borderColor: 'yellow',
    borderStyle: 'round'
};
const APP_TYPE = {
    pc: 'pc',
    h5: 'h5'
};
const DEFAULT_DIR = 'webpack-app';
const GIT_BASE = 'https://github.com/';
const TPL_REPOSITORY = 'ziwen-wang/vant-vue3-template-pc'; // pc项目
const ROLLUP_TPL_REPOSITORY = 'ziwen-wang/vant-vue3-template-h5'; // h5
const ORA_SPINNER = {
    "interval": 80,
    "frames": [
        "   ⠋",
        "   ⠙",
        "   ⠚",
        "   ⠞",
        "   ⠖",
        "   ⠦",
        "   ⠴",
        "   ⠲",
        "   ⠳",
        "   ⠓"
    ]
};

class ViteStartoffGenerator extends Generator {
    constructor(params, opts) {
        super(params, opts);

        this.type = APP_TYPE.pc;
        this.dirName = this._getDefaultDir();

        this._getDefaultDir = this._getDefaultDir.bind(this);
        this._askForDir = this._askForDir.bind(this);
        this._askDirFlow = this._askDirFlow.bind(this);
        this._askForAppType = this._askForAppType.bind(this);
        this._askForOverwrite = this._askForOverwrite.bind(this);
    }

    _getDefaultDir() {
        return `${this.type}-app`;
    }

    /**
     * 检查版本信息
     */
    _checkVersion() {
        this.log();
        this.log('🛠️  Checking your Generator-Vite-Startoff version...');

        let checkResult = false;
        const notifier = updateNotifier({
            pkg,
            updateCheckInterval: 0
        });

        const update = notifier.update;
        if (update) {
            const messages = [];
            messages.push(
                chalk.bgYellow.black(' WARNI: ')
                + '  Generator-Vite-Startoff is not latest.\n'
            );
            messages.push(
                chalk.grey('current ')
                + chalk.grey(update.current)
                + chalk.grey(' → ')
                + chalk.grey('latest ')
                + chalk.green(update.latest)
            );
            messages.push(
                chalk.grey('Up to date ')
                + `npm i -g ${pkg.name}`
            );
            this.log(boxen(messages.join('\n'), BOXEN_OPTS));
            beeper();
            this.log('🛠️  Finish checking your Generator-Vite-Startoff. CAUTION ↑↑', '⚠️');
        }
        else {
            checkResult = true;
            this.log('🛠️  Finish checking your Generator-Vite-Startoff. OK', chalk.green('✔'));
        }

        return checkResult;
    }

    _printEnvInfo() {
        this.log(chalk.grey('Environment Info:'))
        this.log(chalk.grey(`Node\t${process.version}`));
        this.log(chalk.grey(`PWD\t${process.cwd()}`));
    }

    initializing() {
        this.log();

        const version = `(v${pkg.version})`;
        const messages = [];
        messages.push(
            `💁 Welcome to use Generator-Vite-Startoff ${chalk.grey(version)}   `
        );
        messages.push(
            chalk.yellow('You can create a Webpack/Rollup-based frontend environment.')
        );
        messages.push(
            chalk.grey('https://github.com/ziwen-wang/generator-vite-startoff')
        );
        messages.push(
            chalk.grey('https://github.com/ziwen-wang/generator-vite-startoff')
        )
        this.log(
            boxen(messages.join('\n'), {
                ...BOXEN_OPTS,
                ...{
                    borderColor: 'green',
                    borderStyle: 'doubleSingle'
                }
            })
        );

        this._printEnvInfo();
        this._checkVersion();
    }

    _askForAppType() {
        const opts = [{
            type: 'list',
            name: 'type',
            choices: [{
                name: 'pc (app based on ts, vue, element-plus……)',
                value: APP_TYPE.pc
            }, {
                name: 'h5 (app based on ts, vue, vant……)',
                value: APP_TYPE.h5
            }],
            message: 'Please choose the use for your project：',
            default: APP_TYPE.pc
        }];

        return this.prompt(opts).then(({ type }) => {
            this.type = type;
            this.dirName = this._getDefaultDir();
        });
    }

    _askForDir() {
        const opts = [{
            type: 'input',
            name: 'dirName',
            message: 'Please enter the directory name for your project：',
            default: this.dirName,
            validate: dirName => {
                if (dirName.length < 1) {
                    beeper();
                    return '⚠️  directory name must not be null！';
                }
                return true;
            }
        }];

        return this.prompt(opts).then(({ dirName }) => {
            this.dirName = dirName;
        });
    }

    _askForOverwrite() {
        const destination = this.destinationPath();
        const dirName = this.dirName;
        if (!fs.existsSync(path.resolve(destination, dirName))) {
            return Promise.resolve();
        }

        const warn = chalk.grey('CAUTION! Files may be overwritten.');
        const opts = [{
            type: 'confirm',
            name: 'overwrite',
            message: `⚠️  Directory ${dirName} exists. Whether use this directory still? ${warn}`,
            default: false
        }];

        return this.prompt(opts).then(({ overwrite }) => {
            if (!overwrite) {
                this.dirName = DEFAULT_DIR;
                return this._askDirFlow();
            }
        });
    }

    _askDirFlow() {
        return this._askForDir().then(this._askForOverwrite);
    }

    /**
     * 获取用户输入
     */
    prompting() {
        this.log();
        this.log('⚙  Basic configuration...');
        const done = this.async();

        this._askForAppType()
            .then(this._askDirFlow)
            .then(done);
    }

    _walk(filePath, templateRoot) {
        if (fs.statSync(filePath).isDirectory()) {
            fs.readdirSync(filePath).forEach(name => {
                this._walk(path.resolve(filePath, name), templateRoot);
            });
            return;
        }

        const relativePath = path.relative(templateRoot, filePath);
        const destination = this.destinationPath(this.dirName, relativePath);
        this.fs.copyTpl(filePath, destination, {
            dirName: this.dirName
        });
    }

    _downloadTemplate(repository) {
        return new Promise((resolve, reject) => {
            const dirPath = this.destinationPath(this.dirName, '.tmp');
            download(repository, dirPath, err => err ? reject(err) : resolve());
        });
    }

    /**
     * 写入模版文件及目录
     */
    writing() {
        const done = this.async();
        const repository = this.type === APP_TYPE.pc
            ? TPL_REPOSITORY
            : ROLLUP_TPL_REPOSITORY;

        this.log('⚙  Finish basic configuration.', chalk.green('✔'));
        this.log();
        this.log('📂 Generate the project template and configuration...');

        let spinner = ora({
            text: `Download the template from ${GIT_BASE}${repository}...`,
            spinner: ORA_SPINNER
        }).start();
        this._downloadTemplate(repository)
            .then(() => {
                spinner.stopAndPersist({
                    symbol: chalk.green('   ✔'),
                    text: `Finish downloading the template from ${GIT_BASE}${repository}`
                });

                spinner = ora({
                    text: `Copy files into the project folder...`,
                    spinner: ORA_SPINNER
                }).start();
                const templateRoot = this.destinationPath(this.dirName, '.tmp');
                this._walk(templateRoot, templateRoot);
                spinner.stopAndPersist({
                    symbol: chalk.green('   ✔'),
                    text: `Finish copying files into the project folder`
                });

                spinner = ora({
                    text: `Clean tmp files and folders...`,
                    spinner: ORA_SPINNER
                }).start();
                fs.removeSync(templateRoot);
                spinner.stopAndPersist({
                    symbol: chalk.green('   ✔'),
                    text: `Finish cleaning tmp files and folders`
                });
                done();
            })
            .catch(err => this.env.error(err));
    }

    /**
     * 安装npm依赖
     */
    install() {
        this.log();
        this.log('📂 Finish generating the project template and configuration.', chalk.green('✔'));
        this.log();
        this.log('📦 Install dependencies...');

        this.npmInstall('', {}, {
            cwd: this.destinationPath(this.dirName)
        });
    }

    end() {
        const dir = chalk.green(this.dirName);
        const info = `🎊 Create project successfully! Now you can enter ${dir} and start to code.`;
        this.log('📦 Finish installing dependencies.', chalk.green('✔'));
        this.log();
        this.log(
            boxen(info, {
                ...BOXEN_OPTS,
                ...{
                    borderColor: 'white'
                }
            })
        );
    }
}

module.exports = ViteStartoffGenerator;