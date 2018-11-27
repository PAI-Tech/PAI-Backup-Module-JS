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
 * Makes a file stream and uploads to S3. objectName could be a 
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
    PAILogger.info('Upload to S3 started...');
    s3.upload(uploadParams, function (err, data) {
        if (err) {
            PAILogger.info("Error during upload: ", err);
        }
        if (data) {
            PAILogger.info("Upload to S3 bucket successful");
        }
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
    // .then(_ => {
    //     PAILogger.info("Successfully created .tgz")
    // }).catch((err) => {
    //     PAILogger.info(err);
    // })
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
            resolve(result);
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    backupDirectory(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.name = cmd.params.name.value;
            entity.path = cmd.params.path.value;
            entity.type = BACKUP_TYPE.DIRECTORY;
            await this.data.dataSource.save(entity);

            //if name wasn't given in the pai-code params, take it from the path param
            if (entity.name == null) {
                entity.name = path.basename(entity.path);
            }

            //zip directory, passing in the path to the directory and the name
            await zipDirectory(entity.path, entity.name);

            //send to S3
            let result = await uploadToS3(entity.name + '.tgz');
            resolve(result);
        });
    }
}

module.exports = PCM_BACKUP;