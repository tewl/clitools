////////////////////////////////////////////////////////////////////////////////
//
// Usage: node.exe findgrep.js
//
// Running this script using ts-node:
// .\node_modules\.bin\ts-node .\src\findgrep.ts --recurse --pathIgnore "node_modules" --pathIgnore "package-lock" "/\.json$/i" "/depend/i"
//
////////////////////////////////////////////////////////////////////////////////

import * as os from "os";
import chalk = require("chalk");
import * as yargs from "yargs";
import { toArray } from "./depot/arrayHelpers";
import { highlightMatches } from "./depot/chalkHelpers";
import { Directory } from "./depot/directory";
import { matchesAny, strToRegExp } from "./depot/regexpHelpers";
import { failed, Result, succeededResult } from "./depot/result";
import { bindResult, boolToResult, mapWhileSuccessful } from "./depot/resultHelpers";
import _ = require("lodash");
import { pipe } from "./depot/pipe";
import { boolToOption, isNone, isSome, mapSome, Option } from "./depot/option";


if (require.main === module)
{
    findGrepMain()
    .then((exitCode) =>
    {
        if (exitCode !== 0)
        {
            process.exit(exitCode);
        }
    })
    .catch((err: Error) =>
    {
        console.error(err.message);
        process.exit(-1);
    });
}


async function findGrepMain(): Promise<number>
{
    const configResult = getConfiguration();
    if (failed(configResult))
    {
        throw new Error(configResult.error);
    }

    const config = configResult.value;

    console.log(`path regex:   ${config.pathRegex}`);
    console.log(`path ignores: ${config.pathIgnores.join(", ")}`);
    console.log(`text regex:   ${config.textRegex}`);
    console.log(`recurse:      ${config.recurse}`);
    console.log();


    if (isNone(config.textRegex))
    {
        return doFilesystemSearch(config);
    }
    else
    {
        return doTextSearch(config);
    }
}


/**
 * Configuration options for this script.
 */
interface IFindGrepConfig
{
    recurse: boolean;
    pathRegex: RegExp;
    textRegex: Option<RegExp>;
    pathIgnores: Array<RegExp>;
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
function getConfiguration(): Result<IFindGrepConfig, string>
{
    const argv = yargs
    .usage(
        [
            "Finds text within files.",
            `findgrep [options] "<pathRegex>" ["<textRegex>"]`,
            "",
            "textRegex is optional.  If omitted, matching file names and directories will",
            "be listed.  If included, matching files will be searched using the specified",
            "regular expression.",
            "",
            'Regular expressions can be specified as "<pattern>" or "/<pattern>/<flags>".',
            '  - Include the "g" flag to display multiple matches in a path or line'
        ].join(os.EOL)
    )
    .help()
    .option(
        "recurse",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "search through subdirectories recursively"
        }
    )
    .option(
        "pathIgnore",
        {
            demandOption: false,
            describe:     "Ignore paths that match the specified regex"
        }
    )
    .wrap(80)
    .argv;

    // Get the path regex positional argument.
    const pathRegexResult = pipe(
        succeededResult(argv._[0]),
        (r) => bindResult((v) => boolToResult(_.isString(v), v, "Path regex not specified."), r),
        (r) => bindResult(strToRegExp, r)
    );
    if (failed(pathRegexResult))
    {
        return pathRegexResult;
    }

    // Get the optional text regex positional argument.
    const textRegexOptResult = pipe(
        argv._[1],
        (str) => boolToOption(str, str),
        (strOpt) => mapSome(strToRegExp, strOpt)
    );
    if (isSome(textRegexOptResult) && failed(textRegexOptResult.value))
    {
        return textRegexOptResult.value;
    }

    // Get the path ignore regexes from the --pathIgnore arguments.
    const pathIgnoresResult = pipe(
        succeededResult(toArray<string>(argv.pathIgnore)),
        (r) => bindResult((v) => mapWhileSuccessful(v, strToRegExp), r)
    );
    if (failed(pathIgnoresResult))
    {
        return pathIgnoresResult;
    }

    return succeededResult({
        recurse:     argv.recurse,
        pathRegex:   pathRegexResult.value,
        pathIgnores: pathIgnoresResult.value,
        textRegex:   mapSome((res) => res.value!, textRegexOptResult)
    });
}


async function doTextSearch(config: IFindGrepConfig): Promise<number>
{
    const styles = {
        fileStyle:      chalk.cyan,
        fileMatchStyle: chalk.inverse,
        lineStyle:      chalk.yellow,
        textMatchStyle: chalk.inverse
    };

    const cwd = new Directory(".");
    await cwd.walk(async (fileOrDir): Promise<boolean> =>
    {
        const path = fileOrDir.toString();
        const shouldBeIgnored = matchesAny(path, config.pathIgnores);
        // If the current item has been explicitly ignored, do not recurse.
        // Otherwise, recurse as the user has specified.
        const shouldRecurse = shouldBeIgnored ? false : config.recurse;

        if (shouldBeIgnored || (fileOrDir instanceof Directory))
        {
            return shouldRecurse;
        }

        const [numPathMatches, highlighedPath] = highlightMatches(
            path, config.pathRegex, styles.fileMatchStyle
        );

        if (numPathMatches === 0)
        {
            return shouldRecurse;
        }

        const fileText = styles.fileStyle(highlighedPath);
        let fileProducedOutput = false;

        // Read the file line by line and output lines that match the text regex.
        await fileOrDir.readLines((lineText, lineNum) =>
        {
            const [numMatches, highlightedText] = highlightMatches(
                lineText,
                config.textRegex.value!,
                styles.textMatchStyle
            );
            if (numMatches > 0)
            {
                const lineNumText = styles.lineStyle(`:${lineNum}`);
                console.log(fileText + lineNumText + " - " + highlightedText);
                fileProducedOutput = true;
            }
        });

        if (fileProducedOutput)
        {
            // The current file produced output.  Leave a blank line after it.
            console.log();
        }

        return shouldRecurse;
    });

    return 0;
}

async function doFilesystemSearch(config: IFindGrepConfig): Promise<number>
{
    const styles = {
        matchStyle: chalk.inverse
    };

    const cwd = new Directory(".");
    await cwd.walk((fileOrDir): boolean =>
    {
        const path = fileOrDir.toString();
        const shouldBeIgnored = matchesAny(path, config.pathIgnores);
        // If the current item has been explicitly ignored, do not recurse.
        // Otherwise, recurse as the user has specified.
        const shouldRecurse = shouldBeIgnored ? false : config.recurse;

        if (shouldBeIgnored)
        {
            return shouldRecurse;
        }

        const [numPathMatches, highlighted] = highlightMatches(
            path,
            config.pathRegex,
            styles.matchStyle
        );

        if (numPathMatches > 0)
        {
            console.log(highlighted);
        }

        return shouldRecurse;

    });

    return 0;
}
