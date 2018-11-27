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
 * @param {String} objectName =  file name of object to be uploaded 
 */
async function uploadToS3(objectName) {
    //Convert to stream object
    let fileStream = fs.createReadStream(objectName);
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
        Key: objectName,
        Body: fileStream
    };

    //Uploads the uploadParams object
    PAILogger.info('Upload to S3 bucket started...');
    s3.upload(uploadParams, function (err, data) {
        if (err) {
            PAILogger.info("Error during upload: ", err);
        }
        if (data) {
            PAILogger.info("Upload to S3 bucket successful");
        }
    });

    // const s3Promise = s3.putObject(uploadParams).promise();
    // s3Promise.then((data) => {
    //     if (data) {
    //         PAILogger.info('Upload to S3 bucket successful');
    //     }
    // }).catch((err) => {
    //     PAILogger.info(err);
    // });
    // await s3Promise;

}

/**
 *  Downloads an object from S3 with the identifier "objectKey", saved with the same
 *  file name/directory name.
 * @param {String} objectKey = S3 reference for the object to be downloaded
 * @param {String} downloadPath = local path to save the object to
 */
async function downloadFromS3(objectKey, downloadPath) {
    //Create S3 service object
    s3 = new AWS.S3({
        apiVersion: '2006-03-01'
    });

    const downloadParams = {
        Bucket: 'paibackupjs',
        Key: objectKey
    };

    //download object (sync)
    // s3.getObject(downloadParams, (err, data) => {
    //     if (err) PAILogger.error(err);
    //     await fs.writeFile(objectKey, data.Body.toString());
    //     PAILogger.info(`${objectKey} downloaded to ${downloadPath} successfully`);
    // });
    const file = fs.createWriteStream(downloadPath + '/' + objectKey);
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
 * @param {String} sourceDirectoryPath = path to the directory
 * @param {String} outputName = name of the archive to be output (without file extension)
 */
async function zipDirectory(sourceDirectoryPath, outputName) {
    PAILogger.info('Zipping directory "' + sourceDirectoryPath + '"');

    //Zips and outputs a .tgz of the directory at /sourceDirectoryPath/
    tar.c({
            gzip: true,
            C: sourceDirectoryPath,
            sync: true
        },
        fs.readdirSync(sourceDirectoryPath)
    ).pipe(fs.createWriteStream(outputName + '.tgz'));

    PAILogger.info('Finished zipping directory.');

}

/**
 * Zips a file into a .gz compressed file.
 * @param {String} sourceFile = name of file to be zipped
 */
async function zipFile(sourceFile) {
    PAILogger.info('Zipping file "' + sourceFile + '"');

    const input = fs.createReadStream(sourceFile);
    //Create the archive
    const gzip = zlib.createGzip();
    const output = fs.createWriteStream(sourceFile + '.gz');
    return new Promise(async (resolve, reject) => {
            input.pipe(gzip).pipe(output).on('finish', (err) => {
                if (err) return reject(err);
                else resolve();
            })
        })
        .then(PAILogger.info('Finished zipping file.'));
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
                "name": new PAIModuleCommandParamSchema("name", "name of backup", false, "file name"),
                "path": new PAIModuleCommandParamSchema("path", "path to file", true, "file path"),
            }
        }));

        this.loadCommandWithSchema(new PAIModuleCommandSchema({
            op: "backup-directory",
            func: "backupDirectory",
            params: {
                "name": new PAIModuleCommandParamSchema("name", "name of backup", false, "directory name"),
                "path": new PAIModuleCommandParamSchema("path", "path to directory", true, "directory path"),
                //delete local backup
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
            entity.type = BACKUP_TYPE.FILE;
            await this.data.dataSource.save(entity);

            //zip file, passing in name
            await zipFile(entity.name);

            //send to S3
            let result = await uploadToS3(entity.name + '.gz');
            entity.key = entity.name + '.gz';
            resolve(result);
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
            entity.type = BACKUP_TYPE.DIRECTORY;

            await this.data.dataSource.save(entity);

            //zip directory, passing in the path to the directory and the name
            await zipDirectory(entity.path, entity.name);

            //send to S3
            let result = await uploadToS3(entity.name + '.tgz');
            entity.key = entity.name + '.tgz';
            resolve(result);
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
            let result = await downloadFromS3(entity.key, entity.path);
            resolve(result);
        });
    }


}

module.exports = PCM_BACKUP;