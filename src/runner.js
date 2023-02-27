const { TopoSort, Search } = require("@genx/algorithm");
const { _, eachAsync_, get: _get, set: _set, arrayToObject } = require("@genx/july");
const nil = require("./loggers/nil");
const builtins = require("./steps");
const JES = require("@genx/jes").default;
require("@genx/jes/lib/locale/msg.en-US");

function getJobInfo(jobsConfig, jobName) {
    const jobInfo = jobsConfig[jobName];
    if (jobInfo == null) {
        throw new Error(`Job "${jobName}" not found.`);
    }

    return jobInfo;
}

function sortJobs(jobsConfig, entryJobName) {
    const topo = new TopoSort();

    const entryJob = getJobInfo(jobsConfig, entryJobName);

    Search.bfs(
        entryJob,
        (job) => {
            if (job.dependsOn) {
                job.dependsOn.forEach((dep) => topo.add(dep, job.name));
            }
        },
        (job) => {
            if (job.dependsOn) {
                return job.dependsOn.map((jn) => getJobInfo(jobsConfig, jn));
            }

            return null;
        }
    );

    try {
        return topo.sort();
    } catch (e) {
        throw new Error("Circular job dependency detected");
    }
}

function transferVariables(transfers, dest, source) {
    transfers.forEach((item) => {
        const _item = typeof item === "string" ? { from: item, to: item } : item;
        _set(dest, _item.to, _get(source, _item.from));
    });
}

function addFailedStep(job, step) {
    if (!job.failed) {
        job.failed = [step];
    } else {
        job.failed.push(step);
    }
}

async function runJob_(job, flowContext) {
    const { name, steps, picks, emits, onlyWhen } = job;

    flowContext.processing.add(job);

    // complated steps
    job.completed = [];
    job.variables = {};

    const { beforeJob, afterJob, logger, tasks, completed: completedJobs } = flowContext;

    logger.log("info", `Running job "${name}" ...`, { job: name });

    const $env = flowContext.variables.$env;

    let pickedVairiables;

    if (picks) {
        const mapCompleted = arrayToObject(completedJobs, "name");
        pickedVairiables = {};

        _.each(picks, (picksFromJob, jobName) => {
            let source;

            if (jobName === "$last") {
                source = _.last(completedJobs).variables;
            } else {
                source = mapCompleted[jobName]?.variables;
            }

            transferVariables(picksFromJob, pickedVairiables, source || {});
        });
    }

    const _jobContext = {
        ...flowContext,
        variables: {
            ...pickedVairiables,
            $env,
            $job: job.variables,
        },
        getEnv: (key) => $env[key],
        getVariable: (key) => _get(_jobContext.variables, key),
    };

    _jobContext.getV = _jobContext.getVariable;

    const jobContext = beforeJob ? await beforeJob(job, _jobContext) : _jobContext;

    const { beforeStep, afterStep } = jobContext;

    if (onlyWhen) {
        const [matched, unmatchedReason] = JES.match(jobContext.variables, onlyWhen);
        if (!matched) {
            logger.log("info", `Job "${name}" is skipped due to: ${unmatchedReason}`, { job: name });
            return;
        }
    }

    await eachAsync_(steps, async (step) => {
        const { task, continueOnError, onlyWhen: stepOnlyWhen } = step;
        const taskExecutor = tasks?.[task] || builtins[task];

        if (taskExecutor == null) {
            throw new Error(`Task "${task}" not found.`);
        }

        const _step = { ...step, job: name };
        const _stepContext = {
            ...jobContext,
            job,
            log: (level, message) => logger.log(level, message, { job: name, task }),
            logRaw: (level, message) => logger.log(`raw:${level}`, message),
        };
        job.processing = _step;

        _step.variables = {};
        _stepContext.update = (values) => {
            // skip $env, $job
            const { $env, $job, ...allowValues } = values;

            // update step variables
            Object.assign(_step.variables, allowValues);

            // override job result variables
            Object.assign(job.variables, allowValues);

            // override job shared variables, not accessible to other jobs in the same flow
            // other jobs in the same flow requires "picks" to import variables
            Object.assign(jobContext.variables, allowValues);
        };
        _stepContext.updateVariables = _stepContext.update;

        logger.log("info", `Running task "${task}" ...`, { job: name, task });

        let stepContext;

        try {
            stepContext = beforeStep ? await beforeStep(_step, _stepContext) : _stepContext;

            if (stepOnlyWhen) {
                const [matched, unmatchedReason] = JES.match(stepContext.variables, stepOnlyWhen);
                if (!matched) {
                    logger.log("info", `Task "${task}" is skipped due to: ${unmatchedReason}`, { job: name, task });
                    return;
                }
            }

            await taskExecutor(_step, stepContext);
        } catch (error) {
            delete job.processing;
            addFailedStep(job, _step);

            if (continueOnError) {
                logger.log("error", `Error ignored as "continueOnError" enabled. ${error.message}`, {
                    job: name,
                    task,
                });
                return;
            }

            logger.log("error", `Task "${task}" failed.`, { job: name, task });

            throw error;
        }

        afterStep && (await afterStep(_step, stepContext));

        delete job.processing;
        job.completed.push(_step);
        logger.log("info", `Task "${task}" is done.`, { job: name, task });
    });

    afterJob && (await afterJob(job, jobContext));

    if (emits) {
        const emitsVariables = {};
        transferVariables(emits, emitsVariables, _jobContext.variables);

        // skip $env, $job
        const { $env, $job, ...allowValues } = emitsVariables;
        Object.assign(job.variables, allowValues);
    }

    flowContext.processing.delete(job);
    flowContext.completed.push(job);
    logger.log("info", `Job "${name}" is completed.`, { job: name });
}

async function runner(runnerConfig, entryJobName, context) {
    entryJobName == null && (entryJobName = "default");

    const jobsConfig = _.mapValues(runnerConfig.jobs, (job, name) => ({ ...job, name }));

    const flow = sortJobs(jobsConfig, entryJobName);

    const flowContext = {
        logger: nil,
        ...context,
        processing: new Set(),
        completed: [],
    };

    const { concurrent, logger } = flowContext;

    if (concurrent) {
        while (flow.length > 0) {
            const node = flow.shift();
        }
    } else {
        try {
            await eachAsync_(flow, (jobName) => runJob_(getJobInfo(jobsConfig, jobName), flowContext));
        } catch (e) {
            logger.log("error", e.message);
            if (process.env.DEBUG) {
                console.log(e);
            }
        }
    }

    logger.log("info", `Job "${entryJobName}" and its dependents are all done.`);

    return flowContext.completed;
}

module.exports = runner;
