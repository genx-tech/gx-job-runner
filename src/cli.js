const path = require('node:path');
const {
    Starters: { startCommand },
} = require("@genx/app");
const { fs } = require('@genx/sys');
const ConfigLoader = require("@genx/config");
const JsonConfigProvider = require('@genx/config/lib/JsonConfigProvider');
const chalk = require("chalk");
const pkg = require("../package.json");

const runner = require("./runner");

startCommand(
    async (app) => {
        const cmd = app.commandLine;

        if (cmd.option("help")) {
            cmd.showUsage();
            return;
        }

        if (cmd.option("version")) {
            console.log(pkg.version);
            return;
        }

        const runnerConfigFile = cmd.argv._[0];       
        let relativePath = runnerConfigFile || "genx-run.jobs";
        if (!relativePath.endsWith('.json')) {
            relativePath += '.json';
        }

        const configFile = path.resolve(process.cwd(), relativePath);

        if (!fs.existsSync(configFile)) {
            throw new Error(`Jobs configuration "${relativePath}" not found.`);
        }

        const config = new ConfigLoader(
            new JsonConfigProvider(configFile)
        );
        
        const runnerConfig = await config.load_();

        const loggerModule = cmd.option("logger");
        const loggerInstance = cmd.option("logger-instance");

        let logger;

        if (loggerInstance == null) {
            const builtinLoggers = require('./loggers');
            if (loggerModule in builtinLoggers) {
                logger = builtinLoggers[loggerModule];
            }
        } 

        if (logger == null) {
            logger = require(loggerModule);
            if (loggerInstance != null) {
                logger = logger[loggerInstance];
            }
        } 

        const context = {
            variables: {
                $env: {
                    ...process.env,
                },
            },
            logger
        };

        const entryJobName = cmd.option("job");

        return runner(runnerConfig, entryJobName, context);        
    },
    {
        commandName: "genx-run",
        config: {
            version: pkg.version,
            commandLine: {
                banner: () => chalk.white.bgBlue.bold(` Gen-X job runner cli v${pkg.version} `),
                program: "genx-run",
                arguments: [
                    {
                        name: "jobs-config",
                        required: false,
                    },
                ],
                options: {
                    s: {
                        desc: "Silent mode",
                        alias: ["silent"],
                        bool: true,
                        default: false,
                    },
                    v: {
                        desc: "Show version information",
                        alias: ["version"],
                        bool: true,
                        default: false,
                    },
                    h: {
                        desc: "Show usage message",
                        alias: ["help", "usage"],
                        bool: true,
                        default: false,
                    },
                    j: {
                        desc: "Name of the job to start",
                        alias: ["job"],
                        default: "default",
                        inquire: false,
                        required: true,
                    },
                    log: {
                        desc: "Logger module",
                        alias: ["logger"],
                        default: "console",
                        inquire: false,
                        required: true,
                    },
                    "logger-instance": {
                        desc: "Logger instance",
                        inquire: false,
                        required: false
                    },
                },
                silentMode: (cli) => cli.argv["s"] || cli.argv["v"] || cli.argv["h"],
                nonValidationMode: (cli) => cli.argv["v"] || cli.argv["h"],
                showUsageOnError: true,
                showArguments: false,
            },
        },
        throwOnError: true
    }
).catch((e) => {
    console.error(chalk.red.bold('error') + ': ' + chalk.red(e.message));
    process.exit(e.code || -1);
});
