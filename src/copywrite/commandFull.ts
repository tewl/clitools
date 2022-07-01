import {Argv, Arguments} from "yargs";
import {Directory} from "../depot/directory";

export const command = "full <sourceDir> <destDir>";
export const describe = "Empty destDir and copy all contents of sourceDir into it";
export function builder(argv: Argv): Argv {
    return argv
    .positional("sourceDir", {
        describe: "The source directory",
        type:     "string"
    })
    .positional("destDir", {
        describe: "The destination directory",
        type:     "string"
    })
    .check(
        (argv: Arguments) => {
            const sourceDir = new Directory(argv.sourceDir);
            const destDir = new Directory(argv.destDir);

            if (!sourceDir.existsSync()) {
                throw new Error(`The source directory "${sourceDir.toString()}" does not exist.`);
            }

            if (!destDir.existsSync()) {
                throw new Error(`The destination directory "${destDir.toString()}" does not exist.`);
            }

            // If we got this far, everything is valid.
            return true;
        },
        false
    );
}

export function handler(args: Arguments): void {

    const sourceDir = new Directory(args.sourceDir);
    const destDir = new Directory(args.destDir);

    destDir.empty()
    .then(() => {
        return sourceDir.copy(destDir, false);
    });
}
