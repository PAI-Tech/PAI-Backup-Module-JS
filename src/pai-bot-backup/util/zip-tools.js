const zlib = require("zlib");
const tar = require("tar");
const fs = require("fs");

const util = require("util");

const {
    PAILogger
} = require('@pai-tech/pai-code');

/**
 * Various helper functions for preparing files pre-backup 
 * (compressing/zipping/deleting).
 *
 * Author: Benedict Gattas (@P0ntiff)
 */
class ZipTools {

    /**
     * Zips a file into a .gz compressed file.
     * @param {BackupObject} backupObject = data object containing file's path and name
     */
    static zipFile(backupObject) {
        return new Promise(async (resolve, reject) => {
            const sourceFile = backupObject.path;
            const outputName = backupObject.key;
            PAILogger.info('Zipping file "' + sourceFile + '"');

            //check if file can be opened
            let input = fs
                .createReadStream(sourceFile)
                .on("error", err => {
                    reject(err);
                })
                .on("open", _ => {
                    //Create the archive
                    const gzip = zlib.createGzip();
                    const output = fs.createWriteStream(outputName);
                    input.pipe(gzip)
                        .pipe(output)
                        .on("finish", err => {
                            if (err) return reject(err);
                            else resolve();
                        });
                });
        });
    }

    /**
     * Zips a directory into a .tgz archive
     * @param {BackupObject} backupObject = data object containing directory's path and name
     */
    static zipDirectory(backupObject) {
        return new Promise(async (resolve, reject) => {
            const sourceDirectoryPath = backupObject.path;
            const outputName = backupObject.key;
            PAILogger.info('Zipping directory "' + sourceDirectoryPath + '"');
 
            //Zips and outputs a .tgz of the directory at /sourceDirectoryPath/
            try {
                tar.c({
                    gzip: true,
                    C: sourceDirectoryPath,
                    sync: true
                },
                    fs.readdirSync(sourceDirectoryPath)
                )
                .pipe(fs.createWriteStream(outputName));
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Delete local object / file
     * @param {String} fileName = file to be deleted
     */
    static deleteFromLocal(fileName) {
        return util.promisify(fs.unlink)(fileName);
    }
}

module.exports = ZipTools;