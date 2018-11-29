const {
    PAICodeCommand,
    PAICodeCommandContext,
    PAICodeModule,
    PAICode,
    PAIModuleConfigParam,
    PAIModuleConfig,
    PAILogger,
    PAIModuleCommandSchema,
    PAIModuleCommandParamSchema
} = require('@pai-tech/pai-code');

const {
    BackupObject,
    BACKUP_TYPE
} = require('./src/model/backup-object');

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const tar = require('tar');

AWS.config.update({
    region: 'eu-central-1'
});

/**
 * Creates a file stream and then uploads it to S3. objectName could be a 
 * file.gz / directory.tar.gz / directory.tgz / etc
 * 
 * @param {BackupObject} object =  object to be uploaded 
 * @param {"true"/"false"} keepLocalCopy = whether to delete the object after upload or not
 * @requires object.key is a filename in the current directory
 */
async function uploadToS3(backupObject, keepLocalCopy) {
    const objectKey = backupObject.key;

    //Convert to stream object
    let fileStream = fs.createReadStream(objectKey);
    fileStream.on('error', (err) => {
        PAILogger.info('Error reading file/directory', err);
    });

    //Create S3 service object
    s3 = new AWS.S3({
        apiVersion: '2006-03-01'
    });

    //The object that is uploaded to S3
    let uploadParams = {
        Bucket: 'paibackupjs',
        Key: objectKey,
        Body: fileStream
    };

    //Uploads the uploadParams object, and deletes local copy if specified in backupObject
    PAILogger.info('Upload to S3 bucket started...');
    s3.upload(uploadParams, (err, data) => {
        if (err) PAILogger.info("Error during upload: " + err);
        if (data) {
            if (keepLocalCopy == "false") {
                deleteFromLocal(objectKey);
            }
            PAILogger.info("Upload to S3 bucket successful");
        }
    });
}

/**
 * Delete local object / file 
 * @param {String} fileName = file to be deleted
 */
function deleteFromLocal(fileName) {
    fs.unlink(fileName, (err) => {
        if (err) throw err;
        PAILogger.info('Local copy deleted');
    });
}

/**
 *  Downloads an object from S3 with the identifier "objectKey", saved with the same
 *  file name/directory name to a "downloadPath" location.
 * @param {BackupObject} backupObject = reference for the object to be downloaded, containing
 *  key (S3 key) and path (location to save to)
 */
async function downloadFromS3(backupObject) {
    const objectKey = backupObject.key;
    const downloadPath = backupObject.path;

    //Create S3 service object
    s3 = new AWS.S3({
        apiVersion: '2006-03-01'
    });

    const downloadParams = {
        Bucket: 'paibackupjs',
        Key: objectKey
    };

    const file = fs.createWriteStream(downloadPath + '/' + objectKey);
    PAILogger.info(`Downloading object ${objectKey}`);
    const s3Promise = s3.getObject(downloadParams).promise();

    s3Promise.then((data) => {
        file.write(data.Body, () => {
            file.end();
            PAILogger.info(`${objectKey} downloaded to ${downloadPath} successfully`);
        });
    }).catch((err) => {
        PAILogger.info(err);
    });
}

/**
 * Zips a directory into a .tgz archive
 * @param {BackupObject} entity = data object containing directory's path and name
 */
function zipDirectory(backupObject) {
    const sourceDirectoryPath = backupObject.path;
    const outputName = backupObject.key;
    PAILogger.info('Zipping directory "' + sourceDirectoryPath + '"');

    //Zips and outputs a .tgz of the directory at /sourceDirectoryPath/
    return new Promise(async (resolve, reject) => {
        try {
            tar.c({
                    gzip: true,
                    C: sourceDirectoryPath,
                    sync: true
                },
                fs.readdirSync(sourceDirectoryPath)
            ).pipe(fs.createWriteStream(outputName));
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Zips a file into a .gz compressed file.
 * @param {BackupObject} backupObject = data object containing file's path and name
 */
async function zipFile(backupObject) {
    const sourceFile = backupObject.path + "/" + backupObject.name;
    PAILogger.info('Zipping file "' + sourceFile + '"');

    return new Promise(async (resolve, reject) => {
        //check if file can be opened
        input = fs.createReadStream(sourceFile).on('error', (err) => {
            reject(err);
        }).on('open', _ => {
            //Create the archive
            const gzip = zlib.createGzip();
            const output = fs.createWriteStream(backupObject.key);
            input.pipe(gzip).pipe(output).on('finish', (err) => {
                if (err) return reject(err);
                else resolve();
            })
        });
    });
}

class PCM_BACKUP extends PAICodeModule {
    constructor() {

        let infoText = `
        Welcome to PAI Backup:
        This module allows a file/directory to be sent to the cloud for secure backup.
        `;

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            // TODO: add configuration parameters

            //security params ? i.e protecting keys for AWS 

        ];

        let entity = new BackupObject();
        this.data.entities[entity.setEntityName()] = BackupObject;
    }

    /**
     * load basic module commands from super
     * and load all the functions for this module
     */
    async load() {
        await super.load(this);

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "backup-file",
            func: "backupFile",
            params: {
                "name": new PAIModuleCommandParamSchema("name", "name of backup", true, "file name"),
                //path to parent directory
                "path": new PAIModuleCommandParamSchema("path", "path to file", false, "file path"),
                "keepLocalCopy": new PAIModuleCommandParamSchema("keepLocalCopy", "whether or not to keep a backup copy locally", false, "keep a local copy")
            }
        }));

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "backup-directory",
            func: "backupDirectory",
            params: {
                "name": new PAIModuleCommandParamSchema("name", "name of backup", false, "directory name"),
                //path to directory
                "path": new PAIModuleCommandParamSchema("path", "path to directory", true, "directory path"),
                "keepLocalCopy": new PAIModuleCommandParamSchema("keepLocalCopy", "whether or not to keep a backup copy locally", false, "keep a local copy")
            }
        }))

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "download-backup",
            func: "downloadBackup",
            params: {
                "key": new PAIModuleCommandParamSchema("key", "key of backup on S3", true, "key string"),
                "path": new PAIModuleCommandParamSchema("path", "path to store backup object", true, "path to download backup object to")
            }
        }))
    }

    setModuleName() {
        return 'pai-backup';
    }

    /**
     *
     * @param {PAICodeCommand} cmd
     */
    backupFile(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.name = cmd.params.name.value;
            entity.key = entity.name + '.gz';
            entity.type = BACKUP_TYPE.FILE;

            //assume relative path if path not given specifically
            entity.path = (cmd.params.path == null) ?
                "" :
                cmd.params.path.value;

            await this.data.dataSource.save(entity);

            //zip file, passing in a data object containing path to file and its name
            zipFile(entity).then(_ => {
                    PAILogger.info('Finished zipping file.')
                    //store a local backup or not
                    let keepLocalCopy = (cmd.params.keepLocalCopy == null) ?
                        "false" :
                        cmd.params.keepLocalCopy.value;
                    //send to S3
                    let result = uploadToS3(entity, keepLocalCopy);
                    resolve(result);
                })
                .catch((err) => {
                    PAILogger.info('Error while zipping file: ' + err);
                });;
        }).catch((err) => {
            PAILogger.info('Error during backup: ' + err);
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    backupDirectory(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.path = cmd.params.path.value;
            //if name wasn't given in the pai-code params, take it from the path param
            entity.name = (cmd.params.name == null) ?
                path.basename(entity.path) :
                cmd.params.name.value;
            entity.key = entity.name + '.tgz';
            entity.type = BACKUP_TYPE.DIRECTORY;

            await this.data.dataSource.save(entity);

            //zip directory, passing in the data object
            //containing path to the directory and the output name (entity.key)
            zipDirectory(entity).then(_ => {
                    PAILogger.info('Finished zipping directory.');
                    //store a local backup or not, false by default
                    let keepLocalCopy = (cmd.params.keepLocalCopy == null) ?
                        "false" :
                        cmd.params.keepLocalCopy.value;
                    //send to S3
                    let result = uploadToS3(entity, keepLocalCopy);
                    resolve(result);
                })
                .catch((err) => {
                    PAILogger.info('Error while zipping directory: ' + err);
                });
        }).catch((err) => {
            PAILogger.info('Error during backup: ' + err);
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    downloadBackup(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.key = cmd.params.key.value;
            // //if path wasn't given in the pai-code params, use this directory as a default
            // entity.path = (cmd.params.path == null) ?
            //     __dirname :
            //     cmd.params.path.value;
            entity.path = cmd.params.path.value;

            await this.data.dataSource.save(entity);

            //download object from S3
            let result = await downloadFromS3(entity);
            resolve(result);
        }).catch((err) => {
            PAILogger.info('Error during backup: ' + err);
        });
    }
}

module.exports = PCM_BACKUP;