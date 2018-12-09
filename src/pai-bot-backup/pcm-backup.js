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

const { BackupObject, BackupType } = require("./src/model/backup-object");
const ZipTools = require("./util/zip-tools.js");
const BackupService = require("./util/backup-service.js");

const path = require("path");
const fs = require("fs");

//enum for branching based on service type
const ServiceType = {
    S3 : "S3",
    PAI_HTTP : "PAI_HTTP"
}

//service param: "PAI_HTTP" / "S3"
let CONFIG_BACKUP_SERVICE = "BACKUP_SERVICE";

//S3 params
let CONFIG_S3_BUCKET = "S3_BUCKET",
    CONFIG_CREDENTIALS_PATH = "S3_CREDENTIALS_PATH";

//PAI HTTP params
let CONFIG_PAI_HTTP_URl = "PAI_HTTP_URl";

class PCM_BACKUP extends PAICodeModule {
    constructor() {
        let infoText = fs.readFileSync('README.md', 'utf8');

        super(infoText);

        this.config.schema = [
            //PAIModuleConfigParam(label, description, paramName, defaultValue)
            new PAIModuleConfigParam("backup service", "enter the service to be used for backup", CONFIG_BACKUP_SERVICE),

            //S3
            new PAIModuleConfigParam("s3 bucket name", "enter your s3 bucket", CONFIG_S3_BUCKET),
            new PAIModuleConfigParam("aws credentials file", "enter the path to your aws credentials", CONFIG_CREDENTIALS_PATH),

            //PAI HTTP
            new PAIModuleConfigParam("PAI file service base URL", "enter the base URL for PAI file service", CONFIG_PAI_HTTP_URl),
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
                        false,
                        "name of backup object"
                    ),
                    path: new PAIModuleCommandParamSchema(
                        "path",
                        "path to file",
                        true,
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
                        "name of backup object"
                    ),
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
    }

    setModuleName() {
        return "pai-backup";
    }

    /**
     * Performs the backup operation on a file.  
     * @param {PAICodeCommand} cmd
     */
    backupFile(cmd) {
        return this.backupObject(cmd, BackupType.FILE);
    }

    /**
     * Performs the backup operation on a directory.  
     * @param {PAICodeCommand} cmd
     */
    backupDirectory(cmd) {
        return this.backupObject(cmd, BackupType.DIRECTORY);
    }

    /**
     * From a command's parameters, performs a compression on the file / directory 
     * specified in the 'path' parameter and then uploads it to the chosen service.
     * @param {PAICodeCommand} cmd
     * @param {BackupType} type = FILE / DIRECTORY (enum)
     */
    backupObject(cmd, type) {
        return new Promise ( async (resolve, reject) => { 
            let entity = new BackupObject();
            entity.path = cmd.params.path.value;
            //if name wasn't given in the pai-code params, take it from the path param
            entity.name =
                cmd.params.name == null ?
                path.basename(entity.path) :
                cmd.params.name.value;

            //choose output (zip) name, based on whether it's a file or a directory
            entity.key = 
                type === BackupType.FILE ?
                entity.name + ".gz" : 
                entity.name + ".tgz";

            await this.data.dataSource.save(entity);

            try { 
                //zip object, passing in object containing path (entity.path) and output name (entity.key)
                if (type === BackupType.FILE) {
                    await ZipTools.zipFile(entity);
                    PAILogger.info("Finished zipping file.");
                } else if (type === BackupType.DIRECTORY) { 
                    await ZipTools.zipDirectory(entity);
                    PAILogger.info("Finished zipping directory.");
                }

                //branch based on the chosen backup service
                let backupService = await this.config.getConfigParam(CONFIG_BACKUP_SERVICE);
                if (backupService === ServiceType.S3) {
                    //upload to S3
                    let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                    let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                    await BackupService.uploadToS3(entity, bucketName, credentialsPath);
                    PAILogger.info("Upload to S3 bucket successful. Key: " + entity.key);
                } else if (backupService === ServiceType.PAI_HTTP) {
                    //POST to PAI
                    let url = await this.config.getConfigParam(CONFIG_PAI_HTTP_URl) 
                        + "/add-file";
                    let response = await BackupService.postHTTP(entity, url);
                    PAILogger.info("Upload to PAI File Service successful. CDN Key: '" + response + "'");
                }

                //keep a local copy or not
                let keepLocalCopy =
                    (cmd.params.keepLocalCopy == null) ?
                    "false" :
                    cmd.params.keepLocalCopy.value;
                if (keepLocalCopy == "false") {
                    await ZipTools.deleteFromLocal(entity.key);
                    PAILogger.info("Local copy deleted");
                }

                resolve("Backup complete.");
            } catch (e) {
                PAILogger.info("Error during backup: " + e);
                reject(e)
            }
        });
    }

    /**
     * Downloads a backup object from a chosen service, using the key of the object
     * as the query parameter.
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

            try {
                //branch based on the chosen backup service
                let backupService = await this.config.getConfigParam(CONFIG_BACKUP_SERVICE);
                if (backupService === ServiceType.S3) {                
                    //download object from S3
                    let bucketName = await this.config.getConfigParam(CONFIG_S3_BUCKET);
                    let credentialsPath = await this.config.getConfigParam(CONFIG_CREDENTIALS_PATH);
                    await BackupService.downloadFromS3(entity, bucketName, credentialsPath);
                } else if (backupService === ServiceType.PAI_HTTP) {
                    //GET from PAI
                    let url = await this.config.getConfigParam(CONFIG_PAI_HTTP_URl) 
                        + "/get-file"
                        + "?cdn_key="  
                        + entity.key;
                    await BackupService.getHTTP(entity, url);
                    PAILogger.info("Download from PAI File Service successful");
                }
                resolve("Download complete.");
            } catch (e) {
                PAILogger.info("Error during download: " + e);
                reject(e);
            }
        });
    }
}

module.exports = PCM_BACKUP;