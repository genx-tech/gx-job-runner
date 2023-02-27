const { _, eachAsync_ } = require("@genx/july");
const { cmd } = require("@genx/sys");

function trimBuffer(buf) {
    let output = buf.toString();

    if (output.endsWith("\r\n")) {
        output = output.slice(0, -2);
    } else if (output.endsWith("\n")) {
        output = output.slice(0, -1);
    }

    return output;
}

async function run_(activity, stepContext, command) {
    stepContext.log("info", `${stepContext.logger.tag('run')} ${command}`);
    const options = _.pick(activity, ["cwd", "env", "timeout", "detached"]);

    const [program, ...args] = command.split(" ");

    return cmd.runLive_(
        program,
        args,
        (buf) => {
            let output = trimBuffer(buf);

            if (_.trimStart(output).substring(0, 4).toLocaleLowerCase() === "warn") {
                stepContext.logRaw("warn", output);
            } else {
                stepContext.logRaw("info", output);
            }
        },
        (buf) => {
            stepContext.logRaw("error", trimBuffer(buf));
        },
        options
    );
}

const esTemplateSetting = {
    interpolate: /\$\{([\s\S]+?)\}/g,
};

module.exports = async (step, stepContext) => {
    let { command, commands } = step;
    if (commands == null) {
        if (command == null) {
            throw new Error('Either "commands" or "command" is required for "exec" task.');
        }

        commands = _.castArray(command);
    }

    const { variables } = stepContext;

    await eachAsync_(commands, (_command) => {
        let __command;
        try {
            __command = _.template(_command, esTemplateSetting)(variables);
        } catch (e) {
            throw new Error(`Failed to interpolate command line \`${_command}\`, ${e.message}`);
        }
        return run_(step, stepContext, __command);
    });
};
