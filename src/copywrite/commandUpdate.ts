import {Argv, Arguments} from "yargs";
import {Directory} from "../depot/directory";
import {File} from "../depot/file";
import {CopyOperation} from "./copyOperation";
import table from "text-table";
import {promptToContinue} from "../depot/prompts";


export const command = "update <sourceDir> <destDir>";
export const describe = "Update the files in destDir with the version from sourceDir";
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

    // Get file maps for both the source and destination directories.
    const sourceDir: Directory = new Directory(args.sourceDir);
    const sourceMapPromise = getFileMap(sourceDir);

    const destDir: Directory = new Directory(args.destDir);
    const destMapPromise = getFileMap(destDir);

    Promise.all([sourceMapPromise, destMapPromise])
    .then(([srcMap, dstMap]) => {

        // Take all of the file names found in the destination directory, and
        // transform it into an array of file copy operations when there is a
        // source file with the same name.
        let copyOperations: Array<CopyOperation> = Array.from(dstMap.keys()).reduce<Array<CopyOperation>>(
            (acc, curDstFileName) => {
                // If the current destination file is also a source file, create
                // a copy operation for it.
                if (srcMap.has(curDstFileName)) {
                    const copyOperation = new CopyOperation(srcMap.get(curDstFileName)!, dstMap.get(curDstFileName)!);
                    acc.push(copyOperation);
                }
                return acc;
            },
            []
        );

        // For each copy operation, find out if the source and destination files
        // are identical.
        const areIdenticalPromises = copyOperations.map(
            (curCopyOperation) => curCopyOperation.filesAreIdentical()
        );

        return Promise.all(areIdenticalPromises)
        .then((areIdenticalResults) => {
            // Filter the array of copy operations to include only the ones
            // where the source and destination files are not identical.
            copyOperations = copyOperations.filter((curCopyOperation, index) => !areIdenticalResults[index]);

            return copyOperations;
        });
    })
    .then((copyOperations) => {
        // Print a preview of the operations that are about to happen.
        console.log("");
        if (copyOperations.length === 0) {
            console.log("No files need to be updated.");
            return copyOperations;
        }
        else {
            // Create tuples where the first value is the source file and the
            // second value is the destination file.
            const rows = copyOperations.map(
                (curCopyOperation) => [curCopyOperation.source.toString(), curCopyOperation.destination.toString()]
            );
            const previewTable = table(rows, {hsep: " ==> "});
            console.log(previewTable);
            return promptToContinue(
                `Proceed with copying ${copyOperations.length} files?`,
                true
            )
            .then((shouldContinue) => {
                return shouldContinue ? copyOperations : Promise.reject("Aborted by user.");
            });
        }
    })
    .then((copyOperations) => {
        const copyPromises = copyOperations.map((curCopyOperation) => curCopyOperation.execute());
        return Promise.all(copyPromises);
    })
    .then((dstFiles) => {
        console.log(`Copied ${dstFiles.length} files.`);
    });
}


/**
 * Maps a filename (with no preceding path) to a File instance with that name.
 */
export type FileNameMap = Map<string, File>;


/**
 *  Creates a map containing all files found (recursively) in the specified
 *  directory.
 *
 * @param dir - The directory to find files in
 * @return A Promise for a mapping of all found files
 */
function getFileMap(dir: Directory): Promise<FileNameMap> {
    // TODO: What should be done if the same filename is seen in multiple
    // directories?

    // Recursively get all files in the directory.
    return dir.contents(true)
    .then((directoryContents) => {
        // Reduce the array of files into an object where the file name (no
        // path) is the key and the File object is the value.
        return directoryContents.files.reduce(
            (acc, curFile) => acc.set(curFile.fileName, curFile),
            new Map<string, File>()
        );
    });
}
