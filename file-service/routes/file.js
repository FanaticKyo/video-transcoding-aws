const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { PutCommand, QueryCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const auth = require('../middleware/auth');
const { s3Client, dynamoDB } = require('../config/db');
const { getSecret, getParameter } = require("../middleware/aws");

const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() });

require('dotenv').config();
// const TABLE_NAME = process.env.FILE_TABLE_NAME;
// const QUT_USERNAME = process.env.QUT_USERNAME;

// List of video file extensions and their corresponding MIME types
const videoFormats = {
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm'
};

// Route to get a pre-signed URL for uploading files
router.post('/generate-upload-url', auth, async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    const fileId = uuidv4();
    const s3Key = `${fileId}-${fileName}`;
    const S3_BUCKET_NAME = await getParameter(process.env.S3_BUCKET);
    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    };

    // Generate the pre-signed URL for uploading the file
    const uploadUrl = await getSignedUrl(s3Client, new PutObjectCommand(params), { expiresIn: 3600 });

    // Send the pre-signed URL to the client
    res.status(200).send({ uploadUrl, s3Key });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).send({ error: 'An error occurred while generating the upload URL' });
  }
});

router.post('/save-metadata', auth, async (req, res) => {
  try {
    const { fileName, s3Key } = req.body;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const fileId = uuidv4();
    // Get file extension from original filename
    const fileExtension = '.' + fileName.split('.').pop().toLowerCase();
    // Check if the file is a video based on MIME type or file extension
    const isVideo = Object.keys(videoFormats).includes(fileExtension);

    const dbParams = {
      TableName: TABLE_NAME,
      Item: {
        'qut-username': QUT_USERNAME,
        fileId: fileId,
        userId: req.user.id,
        fileName: fileName,
        s3Key: s3Key,
        uploadDate: new Date().toISOString(),
        isVideo: isVideo
      }
    };

    await dynamoDB.send(new PutCommand(dbParams));

    res.status(200).send({ message: 'File metadata saved successfully' });
  } catch (error) {
    console.error('Error saving file metadata:', error);
    res.status(500).send({ error: 'An error occurred while saving file metadata' });
  }
});

// router.post('/upload', auth, upload.single('file'), async (req, res) => {
//   try {
//     const { file } = req;
//     const fileId = uuidv4();
//     const fileName = `${fileId}-${file.originalname}`;
//     // Get file extension from original filename
//     const fileExtension = '.' + file.originalname.split('.').pop().toLowerCase();
//     // Check if the file is a video based on MIME type or file extension
//     const isVideo = Object.values(videoFormats).includes(file.mimetype) ||
//       Object.keys(videoFormats).includes(fileExtension);

//     const s3Params = {
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: fileName,
//       Body: file.buffer
//     };

//     await s3Client.send(new PutObjectCommand(s3Params));

//     const dbParams = {
//       TableName: TABLE_NAME,
//       Item: {
//         'qut-username': QUT_USERNAME,
//         fileId: fileId,
//         userId: req.user.id,
//         fileName: file.originalname,
//         s3Key: fileName,
//         uploadDate: new Date().toISOString(),
//         isVideo: isVideo
//       }
//     };

//     await dynamoDB.send(new PutCommand(dbParams));

//     res.status(200).send({ message: 'File uploaded successfully', fileId, isVideo });
//   } catch (error) {
//     console.error('File upload error:', error);
//     res.status(400).send({ error: 'An error occurred during file upload' });
//   }
// });

router.get('/files', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const S3_BUCKET_NAME = await getParameter(process.env.S3_BUCKET);
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#qut = :qut',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeNames: {
        '#qut': 'qut-username'
      },
      ExpressionAttributeValues: {
        ':qut': QUT_USERNAME,
        ':userId': userId
      }
    };

    const result = await dynamoDB.send(new QueryCommand(params));
    const items = result.Items;

    const fileMap = new Map();

    for (const item of items) {
      if (item.fileId.includes('#')) {
        // This is a transcoding job or transcoded version
        const [originalFileId, type, id] = item.fileId.split('#');
        if (!fileMap.has(originalFileId)) {
          fileMap.set(originalFileId, { file: null, transcodingJobs: [], transcodedVersions: [] });
        }
        if (type === 'transcoding') {
          fileMap.get(originalFileId).transcodingJobs.push(item);
        } else if (type === 'version') {
          fileMap.get(originalFileId).transcodedVersions.push(item);
        }
      } else {
        // This is an original file
        if (!fileMap.has(item.fileId)) {
          fileMap.set(item.fileId, { file: item, transcodingJobs: [], transcodedVersions: [] });
        } else {
          fileMap.get(item.fileId).file = item;
        }
      }
    }

    // Generate presigned URLs for each file
    for (const [fileId, fileData] of fileMap) {
      if (fileData.file && fileData.file.s3Key) {
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: fileData.file.s3Key,
        });
        fileData.file.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      }
      for (const version of fileData.transcodedVersions) {
        if (version.s3Key) {
          const command = new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: version.s3Key,
          });
          version.downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }
      }
    }

    res.status(200).send(Array.from(fileMap.values()));
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(400).send({ error: 'An error occurred while fetching files' });
  }
});

router.delete('/files/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const S3_BUCKET_NAME = await getParameter(process.env.S3_BUCKET);
    // Get the file details from DynamoDB
    const getParams = {
      TableName: TABLE_NAME,
      Key: {
        'qut-username': QUT_USERNAME,
        fileId: fileId
      }
    };

    const fileResult = await dynamoDB.send(new GetCommand(getParams));
    const file = fileResult.Item;

    if (!file || file.userId !== req.user.id) {
      return res.status(404).send({ error: 'File not found or you do not have permission to delete it' });
    }

    // Delete original file from S3
    await s3Client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: file.s3Key,
    }));

    // Query for all transcoded versions and ongoing transcoding jobs
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#qut = :qut and begins_with(fileId, :fileIdPrefix)',
      ExpressionAttributeNames: {
        '#qut': 'qut-username'
      },
      ExpressionAttributeValues: {
        ':qut': QUT_USERNAME,
        ':fileIdPrefix': `${fileId}#`
      }
    };

    const queryResult = await dynamoDB.send(new QueryCommand(queryParams));

    // Delete all transcoded versions and their S3 objects
    for (const item of queryResult.Items) {
      if (item.s3Key) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: item.s3Key,
        }));
      }

      await dynamoDB.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          'qut-username': QUT_USERNAME,
          fileId: item.fileId
        }
      }));
    }

    // Delete the original file entry from DynamoDB
    await dynamoDB.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        'qut-username': QUT_USERNAME,
        fileId: fileId
      }
    }));

    res.status(200).send({ message: 'File and all its transcoded versions deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(400).send({ error: 'An error occurred while deleting the file' });
  }
});

router.get('/stream/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const S3_BUCKET_NAME = await getParameter(process.env.S3_BUCKET);
    // Fetch file details from DynamoDB
    const getParams = {
      TableName: TABLE_NAME,
      Key: {
        'qut-username': QUT_USERNAME,
        fileId: fileId,
      },
    };

    const fileResult = await dynamoDB.send(new GetCommand(getParams));
    const file = fileResult.Item;

    if (!file || file.userId !== req.user.id) {
      return res.status(404).send({ error: 'File not found or you do not have permission to access it' });
    }

    // Generate a pre-signed URL for the video file
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: file.s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour

    res.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL for video:', error);
    res.status(500).send({ error: 'An error occurred while preparing the video stream' });
  }
});

module.exports = router;