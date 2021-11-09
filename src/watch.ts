import {watch} from "fs";
import * as cp from "child_process";
import {emitKeypressEvents, Key} from "readline";
import * as _ from "lodash";
import chalk = require("chalk");
import * as yargs from "yargs";
import {Directory} from "./depot/directory";
import {File} from "./depot/file";
import {ListenerTracker} from "./depot/listenerTracker";
import {spawn, ISpawnResult} from "./depot/spawn";
import {getOs, OperatingSystem} from "./depot/os";

const DEBOUNCE_DELAY = 1500;
const SEP = "================================================================================";
const START_TEXT   = chalk.green.bold;
const STOP_TEXT    = chalk.white.bold.bgBlack;
const INFO_TEXT    = chalk.black.bgRgb(153, 153, 153);
const SUCCESS_TEXT = chalk.green.bold;
const FAIL_TEXT    = chalk.red.bold;


/**
 * Configuration options for this script.
 */
interface IWatchConfig
{
    cmd: string;
    cmdArgs: Array<string>;
    watchDirs: Array<Directory>;
    ignoreRegexes: Array<RegExp>;
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
function getConfiguration(): IWatchConfig
{
    const argv = yargs
    .usage("Watches a directory.")
    .help()
    .option(
        "watch",
        {
            demandOption: false,
            type:         "string",
            default:      ".",
            describe:     "specify a directory to watch."
        }
    )
    .option(
        "ignore",
        {
            demandOption: false,
            describe:     "Ignore activity for files matching the specified regex (can be used multiple times)"
        }
    )
    .wrap(80)
    .argv;

    //
    // Get the command from the command line arguments.
    //
    const [cmd, ...cmdArgs] = _.split(argv._[0], /\s+/);

    //
    // Figure out which directories to watch.
    //
    if (!_.isArray(argv.watch))
    {
        argv.watch = [argv.watch];
    }
    if (argv.watch.length === 0)
    {
        argv.watch = ["."];
    }

    // Convert the watched directory strings into Directory objects.
    const watchDirs = _.map(argv.watch, (curDir) => new Directory(curDir));

    // If any of the watched directories do not exist, exit.
    _.forEach(watchDirs, (curWatchDir) =>
    {
        if (!curWatchDir.existsSync())
        {
            console.error(`The directory "${curWatchDir}" does not exist.`);
            process.exit(-1);
        }
    });

    //
    // Setup the ignore regular expressions.
    //
    if (argv.ignore && !_.isArray(argv.ignore))
    {
        argv.ignore = [argv.ignore];
    }
    const ignoreRegexes: Array<RegExp> = _.map(argv.ignore, (curStr) => new RegExp(curStr));

    return {
        cmd:           cmd,
        cmdArgs:       cmdArgs,
        watchDirs:     watchDirs,
        ignoreRegexes: ignoreRegexes
    };
}


/**
 * The main routine for this script.
 */
function main(): void
{
    const config: IWatchConfig = getConfiguration();
    console.log(`watching:  ${config.watchDirs.join(", ")}`);
    console.log("ignoring:  " + (config.ignoreRegexes.join(", ") || "nothing"));
    console.log(`command:   ${config.cmd} ${config.cmdArgs.join(" ")}`);

    //
    // Start watching the directories.
    //
    const watchListenerTracker = _.map(config.watchDirs, (curWatchDir) =>
    {
        const tracker = new ListenerTracker(watch(curWatchDir.toString(), {recursive: true}));
        tracker.on("change", (eventType: string, filename: string): void =>
        {
            // When this event is fired, filename is relative to the directory
            // being watched.  Since onFilesystemActivity() is being used to
            // watch *all* of the watched directories, the path must be
            // prepended to eliminate possible ambiguity.
            onFilesystemActivity(eventType, new File(curWatchDir, filename));
        });
        return tracker;
    });

    let isEnabled = true;
    let timerId: NodeJS.Timer | undefined;
    let spawnResult: ISpawnResult | undefined;

    //
    // Setup keypresses so that they too can trigger the command.
    //
    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && process.stdin.setRawMode)
    {
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", onKeypress);
    }

    //
    // Perform the action once just to get started.
    //
    performAction();


    /**
     * Handler for filesystem change events
     * @param eventType - string
     * @param eventType - The type of change that has occurred
     * @param file - The file that changed
     */
    function onFilesystemActivity(eventType: string, file: File): void
    {
        if (!isEnabled)
        {
            return;
        }

        if (matchesAny(file.toString(), config.ignoreRegexes))
        {
            console.log(INFO_TEXT(`Ignoring filesystem activity for ${file.toString()}.`));
            return;
        }

        console.log(INFO_TEXT(`File modified: ${file}`));
        trigger();
    }


    /**
     * Handler for keypress events from stdin
     * @param str -
     * @param key - Information about the key that was pressed
     */
    function onKeypress(str: string, key: Key): void
    {
        // Allow ctrl+c to exit the process.
        if (!key.ctrl && !key.meta && key.name === "p")
        {
            isEnabled = !isEnabled;
            const msg = isEnabled ? "unpaused" : "paused";
            console.log(INFO_TEXT(msg));
            return;
        }

        if (key.ctrl && key.name === "c")
        {
            _.forEach(watchListenerTracker, (curWatcher) => curWatcher.removeAll());
            process.exit();
            return;
        }

        if (isEnabled)
        {
            console.log(INFO_TEXT("Key pressed."));
            trigger();
        }
    }


    /**
     * Helper function that should be called whenever an event happens that
     * should trigger the command to run.  This function takes care of killing
     * any in-progress commands and debouncing triggers.
     */
    function trigger(): void
    {
        if (spawnResult)
        {
            console.log(STOP_TEXT("----- Killing current child process. -----"));
            spawnResult.childProcess.kill();
        }
        if (timerId)
        {
            clearTimeout(timerId);
        }
        timerId = setTimeout(performAction, DEBOUNCE_DELAY);
    }


    /**
     * Executes the command line provided by the user
     */
    function performAction(): void
    {
        console.log(START_TEXT(SEP));
        const startTimestamp = new Date().toLocaleString("en-US");
        const commandStr = `"${config.cmd} ${config.cmdArgs.join(" ")}"`;
        console.log(START_TEXT(startTimestamp));
        console.log(START_TEXT(`Executing command ${commandStr}`));
        console.log(START_TEXT(SEP));

        let spawnOptions: cp.SpawnOptions | undefined;
        if (getOs() === OperatingSystem.Windows)
        {
            spawnOptions = {shell: true};
        }
        spawnResult = spawn(config.cmd, config.cmdArgs, spawnOptions, undefined, process.stdout, process.stderr);

        Promise.resolve(spawnResult.closePromise)
        .then(() =>
        {
            const endTimestamp = new Date().toLocaleString("en-US");
            const msg = `✓ Success: ${commandStr}\n` +
                        `  started:  ${startTimestamp}\n`  +
                        `  finished: ${endTimestamp}`;
            console.log(SUCCESS_TEXT(msg));
        })
        .catch(() =>
        {
            // This is here so we don't get unhandled rejection messages.
            const endTimestamp = new Date().toLocaleString("en-US");
            const msg = `✗ Failed: ${commandStr}\n` +
                        `  started:  ${startTimestamp}\n`  +
                        `  finished: ${endTimestamp}`;
            console.log(FAIL_TEXT(msg));
        })
        .finally(() =>
        {
            console.log("");
            spawnResult = undefined;
        });
    }
}

main();


////////////////////////////////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * Tests to see if any patterns match _str_
 * @param str - The string to test
 * @param patterns - The regular expressions to test against
 * @return true if one or more patterns match _str_
 */
function matchesAny(str: string, patterns: Array<RegExp>): boolean
{
    return _.some(patterns, (curPattern) => curPattern.test(str));
}
