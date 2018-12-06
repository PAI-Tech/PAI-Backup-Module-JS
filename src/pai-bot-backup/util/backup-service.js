const AWS = require("aws-sdk");
const fs = require("fs");

const http = require("http");
const request = require("request");
const contentDisposition = require("content-disposition");

const {
    PAILogger
} = require('@pai-tech/pai-code');

AWS.config.update({
    region: "eu-central-1"
});

/**
 * Upload/Download and other functions used when interacting with a service provider (i.e AWS S3)
 */
class BackupService {
    
    /**
     * Creates a file stream and then uploads it to S3. objectName could be a
     * file.gz / directory.tar.gz / directory.tgz / etc
     *
     * @param {BackupObject} backupObject =  object to be uploaded
     * @param {String} bucketName =  name of bucket on S3
     * @param {String} credentialsPath =  path to load AWS credentials from
     */
    static uploadToS3(backupObject, bucketName, credentialsPath) {
        //Convert to stream object
        let fileStream = fs.createReadStream(backupObject.key);
        fileStream.on("error", err => {
            PAILogger.info("Error reading file/directory", err);
        });

        //Create S3 service object
        AWS.config.loadFromPath(credentialsPath);
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });
        //The object that is uploaded to S3
        let uploadParams = {
            Bucket: bucketName,
            Key: backupObject.key,
            Body: fileStream
        };

        //Uploads the uploadParams object, and deletes local copy if specified in backupObject
        PAILogger.info("Upload to S3 bucket started...");
        return s3.upload(uploadParams).promise();
    }

    /**
     *  Downloads an object from S3 with the identifier "objectKey", saved with the same
     *  file name/directory name to a "downloadPath" location.
     * @param {BackupObject} backupObject = reference for the object to be downloaded, containing
     *  key (S3 key) and path (location to save to)
     * @param {String} bucketName =  name of bucket on S3
     * @param {String} credentialsPath =  path to load AWS credentials from
     */
    static downloadFromS3(backupObject, bucketName, credentialsPath) {
        const objectKey = backupObject.key;
        const downloadPath = backupObject.path;

        //Create S3 service object
        AWS.config.loadFromPath(credentialsPath);
        let s3 = new AWS.S3({
            apiVersion: "2006-03-01"
        });

        const downloadParams = {
            Bucket: bucketName,
            Key: objectKey
        };

        PAILogger.info(`Downloading object ${objectKey}`);
        //Download
        const s3Promise = s3.getObject(downloadParams).promise();

        //Write to file
        const file = fs.createWriteStream(downloadPath + "/" + objectKey);
        s3Promise.then(data => {
            file.write(data.Body, () => {
                file.end();
                PAILogger.info(
                    `${objectKey} downloaded to ${downloadPath} successfully`
                );
            });
        })
        .catch(err => {
            PAILogger.info(err);
        });
        return s3Promise;
    }


    /**
     * 
     * @param {BackupObject} backupObject = object to be uploaded
     * @param {String} url = url (with endpoint) to send request incl. file
     */
    static postHTTP(backupObject, url) {
        let cdn_key = "";
        let fileStream = fs.createReadStream(backupObject.key);
        fileStream.on("error", err => {
            PAILogger.info("Error reading file/directory", err);
        });
        let formData = {
            'pai_file' : fileStream
        };
        let options = {
            preambleCRLF: true,
            postambleCRLF: true,        
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept-Charset':  'utf-8',
                'cache-control' : 'no-cache',
                'Accept-Encoding' : 'gzip, deflate',
                'Accept' : '*/*',
                'Connection' : 'keep-alive',
            }
        };
        console.log(JSON.stringify(options));

        return new Promise(async (resolve, reject) => {
            PAILogger.info(`Uploading object ${backupObject.key}`);
            request.post({url: url, formData : formData, options : options}, (err, httpResponse, body) => {
                if (err) {
                    PAILogger.info('Upload failed: ' + err);
                    reject(err);
                }
                PAILogger.info('Upload via HTTP POST successful');
                console.log(body);
                cdn_key = JSON.parse(body)["cdn_key"]; 
                resolve(cdn_key);
            });
        });
    }

    /**
     *
     * @param {BackupObject} backupObject = object to be downloaded (requires backupObject.key is a cdn key)
     * @param {String} url = url (with endpoint) to send request incl. cdn key
     */
    static getHTTP(backupObject, url) {
        const cdnKey = backupObject.key;
        const downloadPath = backupObject.path;
        return new Promise( async (resolve, reject) => {
            const req = request.get(url + '?cdn_key=' + cdnKey)
                .on('error', function(err) {
                    PAILogger.info(err);
                    reject(err);
                })
                .on('response', function (res) {
                    console.log(contentDisposition.parse(res.headers["content-disposition"]).parameters.filename);
                    if (res.statusCode === 200) {
                        req.pipe(fs.createWriteStream(
                            downloadPath + "/" + 
                            contentDisposition.parse(res.headers["content-disposition"]).parameters.filename));
                        PAILogger.info(`Object with cdn_key "${cdnKey}" downloaded to ${downloadPath} successfully`);
                        resolve("Object downloaded successfully.");
                    }
                });
        });
    }
}


module.exports = BackupService;