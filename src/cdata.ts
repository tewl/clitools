////////////////////////////////////////////////////////////////////////////////
//
// A script that analyzes CDATA
// Usage: cat ~/tmp/input.txt | node .\dist\src\cdata.js
//
////////////////////////////////////////////////////////////////////////////////

import { getCdata } from "./depot/cdataHelpers";
import { readableStreamToText } from "./depot/streamHelpers";


if (require.main === module) {
    main()
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


async function main(): Promise<number> {
    const text = await readableStreamToText(process.stdin);

    const charData = getCdata(text);
    if (!charData) {
        console.error("No CDATA found.");
        return -1;
    }

    console.log(`charData = ${charData}`);
    return 0;
}
