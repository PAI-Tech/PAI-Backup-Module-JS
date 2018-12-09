Welcome to PAI Backup:
This module allows a file/directory to be sent to the cloud for secure backup.

Current available services: 
    -AWS (S3) cloud storage
    -PAI (HTTP) file service.


---AWS S3 CONFIG---
    1/ Configure the module to point to this service by running:
        'pai-backup config param_name:"BACKUP_SERVICE" param_value:"S3"'

    2/ Specify a JSON credentials file with the AWS keys to be used for accessing S3.
        'pai-backup config param_name:"S3_CREDENTIALS_PATH" param_value:"./aws_config.json"'
    The JSON file should follow this format:
        '{ "accessKeyId": "XXXXXXXXXXXXX", "secretAccessKey": "XXXXXXXXXXXXX", "region": "region-id" }'
    (See https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-json-file.html for more information)

    3/ Specify a bucket to be used for upload (with access permissions from the keys specified above)
        'pai-backup config param_name:"S3_BUCKET" param_value:"paibackupjs"'
    


---PAI HTTP CONFIG---
    1/ Configure the module to point to this serfvice by running:
        'pai-backup config param_name:"BACKUP_SERVICE" param_value:"PAI_HTTP"'

    2/ Specify the base URL for PAI's File Service. For example, 
        'pai-backup config param_name:"PAI_HTTP_URl" param_value:"http://localhost:3000"'


---USING THE MODULE---
    There are three available commands in the pai-backup module.

    1/ To backup a file, use the 'backup-file' command with the following parameters:
        'path' : An absolute or relative path to the file to be backed up. The file will be zipped into a .gz format
        (optional) 'name' : The output name of the zipped file. For example ('Backup31-01-2019'). The file's name by default.
        (optional) 'keepLocalCopy' ['true'/'false'] : Whether or not to save the zipped file locally (in addition to remotely). False by default.

    2/ To backup a directory, use the 'backup-directory' command with the following parameters:
        'path' : An absolute or relative path to the directory to be backed up. The directory will be zipped into a .tgz format
        (optional) 'name' : The output name of the zipped directory. For example ('Backup31-01-2019'). The directory's name by default.
        (optional) 'keepLocalCopy' ['true'/'false'] : Whether or not to save the zipped directory locally (in addition to remotely). False by default.

    3/ To download a backup, use the 'download-backup' command with the following parameters.
        'key' : For S3, use the name of the zipped file stored on S3, for example 'Backup31-01-2019.tgz' for a zipped directory with the name 'Backup31-01-2019'.
                For PAI HTTP, use the 'cdn_key' returned when the upload was originally done.
        (optional) 'path' : The download location for storing the backup object locally. Current directory by default. 