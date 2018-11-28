const {
    PAIEntity
} = require('@pai-tech/pai-code');


class BackupObject extends PAIEntity {

    constructor() {
        super();

        //name of file/directory
        this.name = null;

        //archive name, and also the 'key' on the S3 bucket
        this.key = null;

        //path to parent directory (file) or path to directory (directory)
        this.path = null;

        //type (file or directory)
        this.type = BACKUP_TYPE.FILE;
    }

    setEntityName() {
        return 'backup_object';
    }
}


const BACKUP_TYPE = {
    FILE: "FILE",
    DIRECTORY: "DIRECTORY"
};


module.exports = {
    BackupObject,
    BACKUP_TYPE
};