////////////////////////////////////////////////////////////////////////////////
//
// A script that reads standard input and removes duplicates.
// Usage: cat ~/tmp/input.txt | node .\dist\src\unique.js
//
////////////////////////////////////////////////////////////////////////////////

import { EOL} from "os";
import * as _ from "lodash";
import { readableStreamToText } from "./depot/streamHelpers";
import { splitLinesOsIndependent } from "./depot/stringHelpers";


if (require.main === module) {
    uniqueMain()
    .then((exitCode) => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    })
    .catch((err: Error) => {
        console.error(err.message);
        process.exit(-1);
    });
}


async function uniqueMain(): Promise<number> {


    const text = await readableStreamToText(process.stdin);
    let lines = splitLinesOsIndependent(text);
    lines = lines.filter((curLine) => curLine.trim().length > 0);
    const numNonEmptyLines = lines.length;
    lines = _.uniq(lines);
    const numUniqueLines = lines.length;

    console.log(`Number of non-empty input lines: ${numNonEmptyLines}`);
    console.log(`Number of unique lines:          ${numUniqueLines}`);
    console.log("Unique lines:");
    console.log(lines.join(EOL));
    return 0;
}
