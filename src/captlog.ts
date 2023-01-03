import * as os from "os";
import { File } from "./depot/file";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { launch } from "./depot/launch";

if (require.main === module) {
    // main() can return a failed result or reject.
    main()
    .then((res) => {
        if (res.failed) {
            console.error(res.error);
            process.exit(-1);
        }
    })
    .catch((err: Error) => {
        console.error(err.message);
        process.exit(-1);
    });
}


async function main(): Promise<Result<undefined, string>> {

    const res = await appendToCaptlogIfNeeded();
    if (res.failed) {
        return res;
    }

    openEmacs(res.value, false);

    return new SucceededResult(undefined);
}

/**
 * Locates and appends the daily template (if needed).
 *
 * @return If successful, the captlog file.  Otherwise, an error message.
 */
export async function appendToCaptlogIfNeeded(): Promise<Result<File, string>> {
    await 0;

    const fileRes = getCaptlogFile();
    if (fileRes.failed) {
        return fileRes;
    }
    const captlogFile = fileRes.value;
    console.log(`Successfully found captlog file: ${captlogFile.absPath()}.`);


    const needToAppend = await needToAppendDailyTemplate(captlogFile);
    if (needToAppend) {
        console.log(`Inserting daily template...`);
        const appendRes = await appendDailyTemplate(captlogFile);
        if (appendRes.failed) {
            return appendRes;
        }
    }
    else {
        console.log(`Today's entry already exists.`);
    }

    return new SucceededResult(captlogFile);
}


/**
 * Gets the line of text that separates daily entries.
 * @returns The separator text
 */
function getDailyDelimiterLine(): string {
    const now = new Date(Date.now());
    const str = `${now.toLocaleDateString()} (${dayNumToDayName(now.getDay())})`;
    const delim = `* ${str}`;
    return delim;

}



async function needToAppendDailyTemplate(captlogFile: File): Promise<boolean> {
    const delim = getDailyDelimiterLine();
    let delimFound = false;

    await captlogFile.readLines((lineText) => {
        if (lineText === delim) {
            delimFound = true;
        }
    });

    return !delimFound;
}


function dayNumToDayName(dayNum: number): string {
    switch (dayNum) {
        case 0:
            return "Sunday";
        case 1:
            return "Monday";
        case 2:
            return "Tuesday";
        case 3:
            return "Wednesday";
        case 4:
            return "Thursday";
        case 5:
            return "Friday";
        case 6:
            return "Saturday";
        default:
            throw new Error(`Invalid day number: ${dayNum}.`);
    }
}


function getCaptlogFile(): Result<File, string> {
    const cloudHomeStr = process.env.CLOUDHOME;
    if (!cloudHomeStr) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }
    const captlog = new File(cloudHomeStr, "data", "captlog.org");
    if (!captlog.existsSync()) {
        return new FailedResult(`File ${captlog.absPath()} does not exist.`);
    }
    return new SucceededResult(captlog);
}


async function appendDailyTemplate(captlogFile: File): Promise<Result<void, string>> {
    const delimLine = getDailyDelimiterLine();

    const template = [
        ``,
        delimLine,
        // `** Time`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Le Mans common services                 |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Training - internal          (SAP 1440) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Training - external          (SAP 1430) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Misc Meeting                 (SAP 1210) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Misc                         (SAP 1110) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Floater                       (SAP 360) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Vacation                      (SAP 200) |`,
        // `|---+-----+-----------------------------------------|`,
        // `|   |     | Sick/Personal                 (SAP 230) |`,
        // `|---+-----+-----------------------------------------|`,
        // `| # |     | TOTAL                                   |`,
        // `| ^ | tot |                                         |`,
        // `|---+-----+-----------------------------------------|`,
        // `#+TBLFM: $tot=vsum(@1..@-1)`,
        ``
    ];

    const res = await captlogFile.append(template.join(os.EOL), false);
    if (res.failed) {
        return res;
    }

    return new SucceededResult(undefined);
}


function openEmacs(file: File, openInExistingEditor = true): void {

    let cmd: string;
    const args: Array<string> = [];

    if (openInExistingEditor) {
        // Note: Must run M-x server-start in Emacs for this to work.
        cmd = "emacsclient";
        args.push("-n");
    }
    else {
        cmd = "emacs";
    }

    args.push(file.absPath());

    launch(cmd, args);
}
