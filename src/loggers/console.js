const chalk = require("chalk");

const nochange = a => a;

const levelToColor = {
    'error': chalk.red,
    'warn': chalk.orange,
    'info': chalk.green,
    'verbose': chalk.aqua,
    'debug': chalk.blue
};

const messageToColor = {
    'error': chalk.red,
    'warn': chalk.orange,
    'info': nochange,
    'verbose': nochange,
    'debug': nochange
};

module.exports = {
    tag: (keyword) => {
        return chalk.white.bgBlue(` ${keyword} `);
    },

    log: (level, message, meta) => {

        if (level.startsWith('raw')) {         
            const pos = level.indexOf(':');
            const _level = level.substring(pos+1);
            
            if (_level === 'error') {
                // raw:error
                console.error(message);
                return;
            }

            if (_level === 'warn') {
                // raw:warn
                console.warn(message);
                return;
            }

            console.log(message);
            return;
        }


        const { job, task } = meta || {};

        const color = levelToColor[level]; 

        const sLevel = `${color.bold(level)}: `;
        const sCategory = job ? (task ? color(`[${color(job)}.${color(task)}] `) : color(`[${color(job)}] `))  : '';    
        const sMessage = messageToColor[level](message);    
        
        console.log(`${sLevel}${sCategory}${sMessage}`);
    }
};