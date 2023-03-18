import * as path from "path";
import * as _ from "lodash";
import chalk from "chalk";
import { nodeBinForOs, createCmdLaunchScript, makeNodeScriptExecutable } from "./dev/depot/nodeUtil";
import { Directory } from "./dev/depot/directory";
import { toGulpError } from "./dev/depot/gulpHelpers";
import { File } from "./dev/depot/file";
import { getOs, OperatingSystem } from "./dev/depot/os";
import { spawn, spawnErrorToString } from "./dev/depot/spawn2";
import { hr } from "./dev/depot/ttyHelpers";
import * as promiseResult from "./dev/depot/promiseResult";
import { mapAsync } from "./dev/depot/promiseHelpers";
import { FailedResult, Result, SucceededResult } from "./dev/depot/result";
import { pipeAsync } from "./dev/depot/pipeAsync";

////////////////////////////////////////////////////////////////////////////////
// Project Configuration
////////////////////////////////////////////////////////////////////////////////

const distDir = new Directory(__dirname, "dist");
const tmpDir  = new Directory(__dirname, "tmp");

//
// The executable scripts build by this project.
// These scripts will be made executable.
//
const scripts: Array<string> = [
    path.join("src", "365_folders.js"),
    path.join("src", "capcom.js"),
    path.join("src", "captlog.js"),
    path.join("src", "convert.js"),
    path.join("src", "copyLatestShareXImg.js"),
    path.join("src", "copywrite.js"),
    path.join("src", "evaluate.js"),
    path.join("src", "fantomasModified.js"),
    path.join("src", "findgrep.js"),
    path.join("src", "hr.js"),
    path.join("src", "ideadiff.js"),
    path.join("src", "localWork.js"),
    path.join("src", "mergedBranches.js"),
    path.join("src", "randomFile.js"),
    path.join("src", "unique.js"),
    path.join("src", "watch.js"),
    path.join("src", "windrives.js"),
    path.join("src", "windowsSpotlightImages.js"),
    path.join("src", "movePhotos", "movePhotos.js")
];

const sep = hr("-");

const successStyle = chalk.green.bold;
const failStyle    = chalk.red.bold;
const headerStyle  = chalk.bold;


////////////////////////////////////////////////////////////////////////////////
// clean
////////////////////////////////////////////////////////////////////////////////

export async function clean(): Promise<void> {
    return promiseResult.toPromise(runClean());
}


function runClean(): Promise<Result<undefined, string>> {
    const dirsToDelete = [tmpDir, distDir];
    try {
        dirsToDelete.forEach((curDir) => curDir.deleteSync());
        return Promise.resolve(new SucceededResult(undefined));
    }
    catch (error) {
        return Promise.resolve(new FailedResult(`Failed to delete files. ${JSON.stringify(error, undefined, 4)}`));
    }
}


////////////////////////////////////////////////////////////////////////////////
// eslint
////////////////////////////////////////////////////////////////////////////////

export async function eslint(): Promise<void> {
    const result = await runEslint();
    if (result.succeeded) {
        // We still need to print the eslint output, because it may contain
        // warnings (only errors cause failure).
        console.log(result.value);
        return;
    }
    else {
        console.error(result.error);
        throw toGulpError("ESLint errors found.");
    }
}


async function runEslint(): Promise<Result<string, string>> {
    const eslintArgs = [
        ".",
        "--ext", ".js",
        "--ext", ".ts",
    ];

    let cmd = path.join(".", "node_modules", ".bin", "eslint");
    cmd = nodeBinForOs(cmd).toString();

    return pipeAsync(spawn(cmd, eslintArgs, { cwd: __dirname }).closePromise)
    .pipe((res) => Result.mapError((spawnErr) => spawnErrorToString(spawnErr), res))
    .end();
}


////////////////////////////////////////////////////////////////////////////////
// Unit Tests
////////////////////////////////////////////////////////////////////////////////

export async function ut(): Promise<void> {
    const result = await runUnitTests(true);
    if (result.succeeded) {
        // Since we allowed output while running the unit test task, we don't
        // have to print it out again.
    }
    else {
        // Since we allowed output while running the unit test task, we don't
        // have to print it out again.
        throw toGulpError("Unit tests failed.");
    }
}


async function runUnitTests(
    allowOutput: boolean
): Promise<Result<string, string>> {
    const jasmineConfigFile = new File(".", "jasmine.json");

    // A typical command line looks something like:
    // .\node_modules\.bin\ts-node.cmd --project .\tsconfig.json .\node_modules\jasmine\bin\jasmine.js --color --config=.\jasmine.json

    const tsconfigFile = new File(".", "tsconfig.json");
    const jasmineScript = new File(".", "node_modules", "jasmine", "bin", "jasmine.js");

    const cmd = nodeBinForOs(path.join(".", "node_modules", ".bin", "ts-node")).toString();
    const args = [
        "--project", tsconfigFile.toString(),
        jasmineScript.toString(),
        "--color",
        `--config=${jasmineConfigFile.toString()}`
    ];

    const spawnPromise = spawn(
        cmd,
        args,
        { cwd: __dirname },
        undefined,
        allowOutput ? process.stdout : undefined,
        allowOutput ? process.stderr : undefined
    )
    .closePromise;

    return pipeAsync(spawnPromise)
    .pipe((res) => Result.mapError((spawnErr) => spawnErrorToString(spawnErr), res))
    .end();
}


////////////////////////////////////////////////////////////////////////////////
// Compile
////////////////////////////////////////////////////////////////////////////////

export async function compile(): Promise<void> {
    const tsconfigFile = new File("tsconfig.json");
    const result = await runCompile(tsconfigFile);
    if (result.succeeded) {
        console.log(result.value);
    }
    else {
        console.error(result.error);
        throw toGulpError("TypeScript compilation failed.");
    }
}


async function runCompile(tsconfigFile: File): Promise<Result<string, string>> {
    // A typical command line looks something like:
    // _ ./node_modules/.bin/tsc --project ./tsconfig.json _
    const cmd = nodeBinForOs(path.join(".", "node_modules", ".bin", "tsc")).toString();
    const args = [
        "--project", tsconfigFile.toString(),
        "--pretty"
    ];

    return pipeAsync(spawn(cmd, args, { cwd: __dirname }).closePromise)
    .pipe((res) => Result.mapError((spawnErr) => spawnErrorToString(spawnErr), res))
    .end();
}


////////////////////////////////////////////////////////////////////////////////
// Build
////////////////////////////////////////////////////////////////////////////////

export async function build(): Promise<void> {
    const cleanResult = await runClean();
    if (cleanResult.failed) {
        throw toGulpError(cleanResult.error);
    }

    const tsConfigFile = new File("tsconfig.json");
    const tasks = [
        {
            name:          "ESLint",
            promiseResult: runEslint()
        },
        {
            name:          "Unit tests",
            promiseResult: runUnitTests(false)
        },
        {
            name:          "TypeScript compilation",
            promiseResult: runCompile(tsConfigFile)
        }
    ];

    const results = await promiseResult.allArrayM(tasks.map((curTask) => curTask.promiseResult));

    if (results.failed) {
        console.error(failStyle(sep));
        console.error(failStyle(`❌ Task failed: ${tasks[results.error.index]!.name}`));
        console.error(failStyle(sep));
        console.error(results.error.item);
        throw toGulpError("❌ " + failStyle("Build failed."));
    }
    else {
        const indexedResults = results.value.map(
            (curResult, index) => { return {index, result: curResult}; }
        );

        // Separate the results into those that produced output and those that did not.
        const [resultsWithOutput, resultsWithoutOutput] =
            _.partition(indexedResults, (curIndexedResult) => curIndexedResult.result);

        if (resultsWithoutOutput.length > 0) {
            const taskNames = _.map(resultsWithoutOutput, (curIndexedResult) => tasks[curIndexedResult.index]!.name);
            const header = headerStyle("Tasks with no output:");
            console.log(`${header} ${taskNames.join(", ")}`);
        }
        _.forEach(resultsWithOutput, (curIndexedResult) => {
            const header = headerStyle(`Output from ${tasks[curIndexedResult.index]!.name}`);
            console.log(header);
            console.log();
            console.log(curIndexedResult.result);

            console.log(sep);
        });

        await makeExecutable();

        console.log("✅ " + successStyle("Build succeeded."));
    }
}


/**
 * Configures the scripts this project builds so that they can be easily
 * executed.
 * @return A promise that resolves when all operations have completed.
 */
function makeExecutable(): Promise<void> {
    const scriptFiles = _.map(scripts, (curScript) => new File(distDir, curScript));

    //
    // Insert a shebang line into each script and turn on the executable
    // permission on each script file.
    //
    const makeExecutablePromises = mapAsync(scriptFiles, (curJsScriptFile) => {
        console.log(`Making executable:  ${curJsScriptFile.toString()}`);
        return makeNodeScriptExecutable(curJsScriptFile);
    });

    //
    // If running on Windows, create .cmd files that will launch the executable
    // scripts.
    //
    let createCmdPromises: Promise<void> = Promise.resolve();
    if (getOs() === OperatingSystem.Windows) {
        createCmdPromises = mapAsync(scriptFiles, (curJsScriptFile) => {
            return createCmdLaunchScript(curJsScriptFile)
            .then((cmdFile) => {
                console.log(`Created Windows cmd file:  ${cmdFile.fileName}`);
            });
        })
        .then(() => {
            // Do nothing.
        });
    }

    return Promise.all([makeExecutablePromises, createCmdPromises])
    .then(() => {
        // Do nothing.
    });
}


////////////////////////////////////////////////////////////////////////////////
// updateDistSaved
////////////////////////////////////////////////////////////////////////////////

export function updateDistSaved(): Promise<void> {
    const distSrcDir = new Directory(distDir, "src");
    const distSavedDir = new Directory("dist-saved");

    //
    // Clear out the current dist-saved directory.
    //
    distSavedDir.emptySync();

    //
    // Copy the part of the dist folder that is needed to run scripts.
    //
    distSrcDir.copySync(distSavedDir, true);

    return Promise.resolve();
}
