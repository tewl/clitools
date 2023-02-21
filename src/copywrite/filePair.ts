import {File} from "../depot/file";


export class FilePair {

    private readonly _fileA: File;
    private readonly _fileB: File;


    constructor(src: File, dst: File) {
        this._fileA = src;
        this._fileB = dst;
    }


    public get fileA(): File {
        return this._fileA;
    }


    public get fileB(): File {
        return this._fileB;
    }


    public copyAToB(): Promise<File> {
        return this._fileA.copy(this._fileB);
    }


    public filesAreIdentical(): Promise<boolean> {
        return Promise.all([
            this._fileA.getHash(),
            this._fileB.getHash()
        ])
        .then(([aHash, bHash]) => {
            return aHash === bHash;
        });
    }
}
