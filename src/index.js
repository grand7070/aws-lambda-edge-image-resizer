'use strict';

const querystring = require('querystring');
const AWS = require('aws-sdk');
const Sharp = require('sharp');

const S3 = new AWS.S3({
    region: 'ap-northeast-2'
});
const BUCKET = 'BUCKET_NAME';
const DEFAULT_FORMAT = 'jpeg';

exports.handler = async (event, context, callback) => {
    if (BUCKET === 'BUCKET' + '_' + 'NAME') {
        console.error(`bucket name is not initialize`);
        return callback(null, response);
    }

    const { request, response } = event.Records[0].cf;
    if (Number(response.status) !== 200) {
        console.error(`response status is ${response.status}, not 200`);
        return callback(null, response);
    }

    const params = querystring.parse(request.querystring);
    console.log(`parmas: ${JSON.stringify(params)}`);

    // Required width or height value.
    if (!params.w || !params.h) {
        console.error(`query parameter is wrong. w,h,q : ${params.w},${params.h},${params.q}`);
        return callback(null, response);
    }

    // Extract name and format.
    const { uri } = request;
    const [, imageName, extension] = uri.match(/\/?(.*)\.(.*)/);
    console.log(`name: ${imageName}.${extension}`);

    // Init variables
    let width;
    let height;
    let quality;
    let s3Object;
    let resizedImage;

    // Init sizes.
    width = parseInt(params.w, 10) ? parseInt(params.w, 10) : null;
    height = parseInt(params.h, 10) ? parseInt(params.h, 10) : null;

    // Init quality.
    quality = parseInt(params.q, 10) ? parseInt(params.q, 10) : 95;
    if (quality > 95) {
        quality = 95;
    }
    if (quality < 10) {
        quality = 10;
    }

    try {
        s3Object = await S3.getObject({
            Bucket: BUCKET,
            Key: decodeURI(imageName + '.' + extension)
        }).promise();
    } catch (error) {
        console.error('S3.getObject: ', error);
        return callback(null, response);
    }

    try {
        resizedImage = await Sharp(s3Object.Body)
            .resize(width, height)
            .toFormat(DEFAULT_FORMAT, {
                quality
            })
            .toBuffer();
    } catch (error) {
        console.error('Sharp: ', error);
        return callback(null, response);
    }

    const resizedImageByteLength = Buffer.byteLength(resizedImage, 'base64');
    console.log('byteLength: ', resizedImageByteLength);

    // Lambda@Edge limit size : 1MB
    if (resizedImageByteLength >= 1 * 1000 * 1000) {
        // TODO : Resize under 1MB
        console.log(`image size ${resizedImageByteLength} is upper than 1MB`);
        return callback(null, response);
    }

    response.status = 200;
    response.body = resizedImage.toString('base64');
    response.bodyEncoding = 'base64';
    response.headers['content-type'] = [
        {
            key: 'Content-Type',
            value: `image/` + DEFAULT_FORMAT
        }
    ];
    return callback(null, response);
};