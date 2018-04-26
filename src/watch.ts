#!/usr/bin/env ts-node
import {watch} from "fs";
import {emitKeypressEvents, Key} from "readline";
import * as BBPromise from "bluebird";
import * as _ from "lodash";
import chalk from "chalk";
import {ListenerTracker, spawn, ISpawnResult} from "asynchrony";

const DEBOUNCE_DELAY = 1500;
const SEP = "================================================================================";
const START_TEXT   = chalk.green.bold;
const STOP_TEXT    = chalk.white.bold.bgBlack;
const INFO_TEXT    = chalk.black.bgRgb(153, 153, 153);
const SUCCESS_TEXT = chalk.green.bold;
const FAIL_TEXT    = chalk.red.bold;

import * as yargs from "yargs";

function getArgs(): yargs.Arguments
{
    return yargs
    .usage("Watches a directory.")
    .help()
    .option("ignore",
        {
            demandOption: false,
            describe: "Ignore activity for files matching the specified regex (can be used multiple times)"
        }
    )
    .wrap(80)
    .argv;
}

function matchesAny(str: string, patterns: Array<RegExp>) {
    return _.some(patterns, (curPattern) => curPattern.test(str));
}

function main() {
    const argv = getArgs();
    const subject = argv._[0];
    const [cmd, ...args] = _.split(argv._[1], /\s+/);

    if (argv.ignore === undefined) {
    }
    else if (_.isArray(argv.ignore)) {
    }
    else {
        argv.ignore = [argv.ignore];
    }
    const ignorePatterns: Array<RegExp> = _.map(argv["ignore"], (curStr) => new RegExp(curStr));


    console.log(`Watching ${subject}...`);
    const watcher = new ListenerTracker(watch(subject, {recursive: true}));
    let isEnabled = true;
    let timerId: NodeJS.Timer | undefined = undefined;
    let spawnResult: ISpawnResult | undefined = undefined;
    watcher.on("change", onFilesystemActivity);

    // Like filesystem events, keypress events can also trigger this watcher.
    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", onKeypress);
    }


    // Perform the action once just to get started.
    performAction();

    function onFilesystemActivity(eventType: string, filename: string): void {
        if (!isEnabled) {
            return;
        }

        if (matchesAny(filename, ignorePatterns)) {
            console.log(INFO_TEXT(`Ignoring filesystem activity for ${filename}.`));
            return;
        }

        const msg = `File modified: ${filename}`;
        console.log(INFO_TEXT(msg));
        trigger();
    }

    function onKeypress(str: string, key: Key) {
        // Allow ctrl+c to exit the process.
        if (!key.ctrl && !key.meta && key.name === "p") {
            isEnabled = !isEnabled;
            const msg = isEnabled ? "unpaused" : "paused";
            console.log(INFO_TEXT(msg));
            return;
        }
        if (key.ctrl && key.name === "c") {
            process.exit();
            return;
        }

        if (isEnabled) {
            console.log(INFO_TEXT("Key pressed."));
            trigger();
        }

    }

    function trigger() {
        if (spawnResult) {
            console.log(STOP_TEXT("----- Killing current child process. -----"));
            spawnResult.childProcess.kill();
        }
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(performAction, DEBOUNCE_DELAY);
    }

    function performAction() {
        console.log(START_TEXT(SEP));
        const startTimestamp = new Date().toLocaleString("en-US");
        const commandStr = `"${cmd} ${args.join(" ")}"`;
        console.log(START_TEXT(startTimestamp));
        console.log(START_TEXT(`Executing command ${commandStr}`));
        console.log(START_TEXT(SEP));
        spawnResult = spawn(cmd, args, undefined, undefined, process.stdout, process.stderr);

        BBPromise.resolve(spawnResult.closePromise)
        .then(() => {
            const endTimestamp = new Date().toLocaleString("en-US");
            const msg = `✓ Success: ${commandStr}\n` +
                        `  started:  ${startTimestamp}\n`  +
                        `  finished: ${endTimestamp}`;
            console.log(SUCCESS_TEXT(msg));
        })
        .catch(() => {
            // This is here so we don't get unhandled rejection messages.
            const endTimestamp = new Date().toLocaleString("en-US");
            const msg = `✗ Failed: ${commandStr}\n` +
                        `  started:  ${startTimestamp}\n`  +
                        `  finished: ${endTimestamp}`;
            console.log(FAIL_TEXT(msg));
        })
        .finally(() => {
            console.log("");
            spawnResult = undefined;
        });
    }
}

main();
