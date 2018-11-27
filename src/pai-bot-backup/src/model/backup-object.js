const {
    PAIEntity
} = require('@pai-tech/pai-code');


class BackupObject extends PAIEntity {

    constructor() {
        super();

        //name of file/directory
        this.name = null;

        //key of file/directory on S3
        this.key = null;

        //path to file/directory
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