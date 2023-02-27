# @genx/runner

Light-weight job runner library and cli

## Usage

* code
```javascript
const runner = require('@genx/runner');

await runner(
  jobs, // jobs config, same as the content of config file
  null // null as 'default', or specify a job name to start here, 
  {
    variables: { $env:{ var1: "Hello", var2: "Gen-X" } }
  }
);
```

* cli
```bash
genx-run
genx-run test/genx-run.jobs
genx-run test/genx-run.jobs.json
```

## Definitions

* Flow - A list of jobs in the order of resolved dependencies
* Job - Definition of a work flow
* Process - The running instance of a job
* Task - Definition of a job step 
* Activity - The running instance of a task

## Runner context

* concurrent - Whether to run in concurrent mode, default: false 
* logger - Logger instance
* tasks - Custom tasks
* variables - Input variables
* beforeJob - Hook run before job execution, function (jobInfo, jobContext) => jobContext
* afterJob - Hook run after job execution, function (jobInfo, jobContext) => void

## Flow context

* ... all runner context
* variables - Input variables
  * $env - process.env (readonly)

## Job context

* ... all flow context
* variables - Input variables
  * $env - process.env (readonly)
  * $job - variables produced by this job
* getEnv - Get value from variables.$env function (key) => value
* getVariable / getV - Get value from variables, function (key) => value, key can be dot path, e.g. object1.key1OfObject1.key2OfChildObject

## Step context

* ... all job context
* job - The job object
  * name
  * processing - The currency on-going step
  * completed - Completed steps
* updateVariables / update - Update variables to job variables, function (object)
* log - Log function, function (level, message)
* logRaw - Raw output collect, used to collect the stdout and stderr of the task itself (not the logs of the job runner)

## Job information

* dependsOn - Dependent jobs

* steps - Steps of a job, will be executed step by step

* picks - Picks variables from completed jobs
```javascript
"picks": {
    "job1": [
      { "from": "var3", "to": "var4" }, 
      "var3"
    ]
}

"picks": { // $last means to pick from the last job
    "$last": ["var3"]
}
```

* emits - Emits job variables from input 
```javascript
"emits": [
    "var4",
    {
        "from": "var3",
        "to": "var5"
    }
]
```

* onlyWhen - Pre-condition to run the job, object filter or using the JSON Syntax Expression (see @genx/jes)
```javascript
"onlyWhen": { // check jobContext.variables
    "var3": {
        "$gt": 100
    }
}
```

## Step information

* task - Task type
* continueOnError - Whether to continue on error
* onlyWhen - Pre-condition to run the step, object filter or using the JSON Syntax Expression (see @genx/jes)
```javascript
"onlyWhen": { // check stepContext.variables
    "var3": {
        "$gt": 100
    }
}
```

## Builtin tasks

* exec
  * commands or command - shell command line with variables interpolation supported

## Custom task implementation
Each step in a job is a certain type of task.
```
async function (step, stepContext) {
    // stepContext.getEnv
    // stepContext.getVariable
    // stepContext.log('level', message)

    // ... do something

    // stepContext.update({ ...result }) if variables produce
}
```

## Custom logger implementation
A logger not only can be used to log information and errors, but also can be used to capture the data produced during task execution.
```
{
  tag: <keyword> => <decorated keyword>,
  log: (level, message, meta: { job?, task? }) => {}
}
```