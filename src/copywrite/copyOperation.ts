import {File} from "../depot/file";


export class CopyOperation {

    private readonly _src: File;
    private readonly _dst: File;


    constructor(src: File, dst: File) {
        this._src = src;
        this._dst = dst;
    }


    public get source(): File {
        return this._src;
    }


    public get destination(): File {
        return this._dst;
    }


    public execute(): Promise<File> {
        return this._src.copy(this._dst);
    }


    public filesAreIdentical(): Promise<boolean> {
        return Promise.all([
            this._src.getHash(),
            this._dst.getHash()
        ])
        .then(([srcHash, dstHash]) => {
            return srcHash === dstHash;
        });
    }
}
