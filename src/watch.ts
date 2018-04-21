#!/usr/bin/env ts-node
// #! ./node_modules/.bin/ts-node

// #!/usr/bin/env ts-node
import {watch} from "fs";
import * as BBPromise from "bluebird";
import * as _ from "lodash";
import {ListenerTracker, spawn, ISpawnResult} from "asynchrony";

const DEBOUNCE_DELAY = 1500;
const SEP = "================================================================================";

import * as yargs from "yargs";

function getArgs(): yargs.Arguments
{
    return yargs
    .usage("Watches a directory.")
    .help()
    .wrap(80)
    .argv;
}

function main() {
    const argv = getArgs();
    const subject = argv._[0];
    const [cmd, ...args] = _.split(argv._[1], /\s+/);

    console.log(`Watching ${subject}...`);
    const watcher = new ListenerTracker(watch(subject, {recursive: true}));

    let timerId: NodeJS.Timer | undefined = undefined;
    let spawnResult: ISpawnResult | undefined = undefined;

    watcher.on("change", onFilesystemActivity);
    // Perform the action once just to get started.
    performAction();

    function onFilesystemActivity(/*eventType: string, filename: string*/) {
        if (spawnResult) {
            console.log("----- Filesystem activity detected.  Killing current child process. -----");
            spawnResult.childProcess.kill();
        }

        if (timerId) {
            clearTimeout(timerId);
        }

        timerId = setTimeout(performAction, DEBOUNCE_DELAY);
    }

    function performAction() {
        console.log(SEP);
        console.log(new Date().toLocaleString("en-US"));
        console.log(`Executing command: "${cmd} ${args.join(" ")}"`);
        console.log(SEP);
        spawnResult = spawn(cmd, args, undefined, undefined, process.stdout, process.stderr);

        BBPromise.resolve(spawnResult.closePromise)
        .catch(() => {
            // This is here so we don't get unhandled rejection messages.
        })
        .finally(() => {
            console.log("");
            spawnResult = undefined;
        });
    }

}

main();
