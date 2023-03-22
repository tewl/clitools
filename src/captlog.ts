import * as os from "os";
import { File } from "./depot/file";
import { FailedResult, Result, SucceededResult } from "./depot/result";
import { openInEmacs } from "./depot/editor";
import { dayOfWeek } from "./depot/dateHelpers";

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

    openInEmacs([res.value], false);

    return new SucceededResult(undefined);
}

/**
 * Locates and appends the daily template (if needed).
 *
 * @return If successful, the captlog file.  Otherwise, an error message.
 */
export async function appendToCaptlogIfNeeded(): Promise<Result<File, string>> {
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
    const str = `${now.toLocaleDateString()} (${dayOfWeek(now)})`;
    const delim = `* ${str}`;
    return delim;

}


/**
 * Helper function that determines whether the specified captain's log file has
 * an entry for today.
 *
 * @param captlogFile - The file to check
 * @return true if an entry for today was not found; false otherwise.
 */
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


/**
 * Locates the captain's log file.
 *
 * @returns A successful Result containing the captain's log file or an
 * descriptive error message.
 */
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


/**
 * Helper function that appends the daily template to the specified captain's
 * log file.
 *
 * @param captlogFile - The file to append to
 * @returns A Result indication operation success.
 */
async function appendDailyTemplate(captlogFile: File): Promise<Result<void, string>> {
    const delimLine = getDailyDelimiterLine();

    const template = [
        ``,
        delimLine,
        `** Time`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Pineapplefish                           |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | NG Profiles                             |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Training - internal                     |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Training - external                     |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Misc Meeting                            |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Misc                                    |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Floater                                 |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Vacation                                |`,
        `|---+-----+-----------------------------------------|`,
        `|   |     | Sick/Personal                           |`,
        `|---+-----+-----------------------------------------|`,
        `| # |     | TOTAL                                   |`,
        `| ^ | tot |                                         |`,
        `|---+-----+-----------------------------------------|`,
        `#+TBLFM: $tot=vsum(@1..@-1)`,
        ``
    ];

    const res = await captlogFile.append(template.join(os.EOL), false);
    if (res.failed) {
        return res;
    }

    return new SucceededResult(undefined);
}
