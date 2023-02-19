import {File} from "../depot/file";
import {Directory} from "../depot/directory";


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
export function getFileMap(dir: Directory): Promise<FileNameMap> {
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
