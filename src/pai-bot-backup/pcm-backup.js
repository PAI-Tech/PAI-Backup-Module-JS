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
} = require("@pai-tech/pai-code");

const {
    BackupObject,
    BACKUP_TYPE
} = require("./src/model/backup-object");

const ZipTools = require("./util/zip-tools.js");
const S3Tools = require("./util/S3-tools.js");

let CONFIG_S3_BUCKET = "S3_BUCKET",
    CONFIG_CREDENTIALS_PATH = "S3_KEY";
const path = require("path");

class PCM_BACKUP extends PAICodeModule {
    constructor() {
        let infoText = `
        Welcome to PAI Backup:
        This module allows a file/directory to be sent to the cloud for secure backup.
        `;

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            new PAIModuleConfigParam("s3 bucket name", "enter your s3 bucket", CONFIG_S3_BUCKET),
            new PAIModuleConfigParam("aws credentials file", "enter the path to your aws credentials", CONFIG_CREDENTIALS_PATH)
        ];

    }

    /**
     * load basic module commands from super
     * and load all the functions for this module
     */
    async load() {
        await super.load(this);

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "backup-file",
                func: "backupFile",
                params: {
                    name: new PAIModuleCommandParamSchema(
                        "name",
                        "name of backup",
                        true,
                        "file name"
                    ),
                    //path to parent directory
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to file",
                        false,
                        "file path",
                        ""
                    ),
                    keepLocalCopy: new PAIModuleCommandParamSchema(
                        "keepLocalCopy",
                        "whether or not to keep a backup copy locally",
                        false,
                        "keep a local copy"
                    )
                }
            })
        );

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "backup-directory",
                func: "backupDirectory",
                params: {
                    name: new PAIModuleCommandParamSchema(
                        "name",
                        "name of backup",
                        false,
                        "directory name"
                    ),
                    //path to directory
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to directory",
                        true,
                        "directory path",
                    ),
                    keepLocalCopy: new PAIModuleCommandParamSchema(
                        "keepLocalCopy",
                        "whether or not to keep a backup copy locally",
                        false,
                        "keep a local copy"
                    )
                }
            })
        );

        this.loadCommandWithSchema(
            new PAIModuleCommandSchema({
                op: "download-backup",
                func: "downloadBackup",
                params: {
                    key: new PAIModuleCommandParamSchema(
                        "key",
                        "key of backup on S3",
                        true,
                        "key string"
                    ),
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to store backup object",
                        false,
                        "path to download backup object to"
                    )
                }
            })
        );

        await this.config.setConfigParam(CONFIG_S3_BUCKET, 'paibackupjs');
        await this.config.setConfigParam(CONFIG_CREDENTIALS_PATH, './aws_config.json');

    }

    setModuleName() {
        return "pai-backup";
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    backupFile(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.name = cmd.params.name.value;
            entity.key = entity.name + ".gz";
            entity.type = BACKUP_TYPE.FILE;

            //assume relative path if path not given specifically
            entity.path = (cmd.params.path == null) ? "" : cmd.params.path.value;

            await this.data.dataSource.save(entity);

            try {
                //zip file, passing in a data object containing path to file and its name
                await ZipTools.zipFile(entity);
                PAILogger.info("Finished zipping file.");

                //upload to S3
                let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                await S3Tools.uploadToS3(entity, bucketName, credentialsPath);
                PAILogger.info("Upload to S3 bucket successful. Key: " + entity.key);

                //keep a local copy or not
                let keepLocalCopy =
                    (cmd.params.keepLocalCopy == null) ?
                    "false" :
                    cmd.params.keepLocalCopy.value;
                if (keepLocalCopy == "false") {
                    await ZipTools.deleteFromLocal(entity.key);
                    PAILogger.info("Local copy deleted");
                }
                resolve();
            } catch (e) {
                PAILogger.info("Error during backup: " + e);
                reject(e)
            }
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
            entity.name =
                cmd.params.name == null ?
                path.basename(entity.path) :
                cmd.params.name.value;
            entity.key = entity.name + ".tgz";
            entity.type = BACKUP_TYPE.DIRECTORY;

            await this.data.dataSource.save(entity);

            try {
                //zip directory, passing in the data object
                //containing path to the directory and the output name (entity.key)
                await ZipTools.zipDirectory(entity);
                PAILogger.info("Finished zipping directory.");

                //upload to S3
                let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                await S3Tools.uploadToS3(entity, bucketName, credentialsPath);
                PAILogger.info("Upload to S3 bucket successful. Key: " + entity.key);

                //store a local backup or not, false by default
                let keepLocalCopy =
                    (cmd.params.keepLocalCopy == null) ?
                    "false" :
                    cmd.params.keepLocalCopy.value;
                if (keepLocalCopy == "false") {
                    await ZipTools.deleteFromLocal(entity.key);
                    PAILogger.info("Local copy deleted");
                }
                resolve();
            } catch (err) {
                PAILogger.info("Error during backup: " + err);
                reject(err);
            };
        });
    }

    /**
     * @param {PAICodeCommand} cmd
     */
    downloadBackup(cmd) {
        return new Promise(async (resolve, reject) => {
            let entity = new BackupObject();
            entity.key = cmd.params.key.value;
            //if path wasn't given in the pai-code params, use this directory as a default
            entity.path = (cmd.params.path == null) ?
                "./" :
                cmd.params.path.value;

            await this.data.dataSource.save(entity);

            //download object from S3
            let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
            let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);

            try {
                await S3Tools.downloadFromS3(entity, bucketName, credentialsPath);
                resolve();
            } catch (e) {
                PAILogger.info("Error during download: " + e);
                reject(e);
            }
        });
    }

}

module.exports = PCM_BACKUP;