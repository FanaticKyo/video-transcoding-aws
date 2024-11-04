const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { PutCommand, ScanCommand, GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const auth = require('../middleware/auth');
const { s3Client, dynamoDB } = require('../config/db');
const { getSecret, getParameter } = require("../middleware/aws");

ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

require('dotenv').config();
// const TABLE_NAME = process.env.FILE_TABLE_NAME;
// const QUT_USERNAME = process.env.QUT_USERNAME;

// Use DynamoDB to store transcoding progress
async function updateTranscodingProgress(userId, fileId, transcodingId, format, quality, progress) {
  if (typeof (progress) == 'undefined' || isNaN(progress)) {
    progress = 0;
  }
  console.log(`Processing: ${progress}% done`);
  const SSM = await getSecret(process.env.SECRET_NAME);
  const TABLE_NAME = await getParameter(process.env.DYNAMODB);
  const QUT_USERNAME = SSM.QUT_USERNAME;
  await dynamoDB.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      'qut-username': QUT_USERNAME,
      'fileId': `${fileId}#transcoding#${transcodingId}`,
      'userId': userId,
      'transcodingId': transcodingId,
      'format': format,
      'quality': quality,
      'progress': progress
    }
  }));
}

async function removeIncompleteJobs() {
  try {
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const result = await dynamoDB.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'progress < :progress',
      ExpressionAttributeValues: {
        ':progress': 100
      }
    }));

    const jobsToDelete = result.Items || [];

    for (const job of jobsToDelete) {
      console.log(`Removing incomplete job: ${job.fileId}`);
      await dynamoDB.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          'qut-username': job['qut-username'],
          'fileId': job.fileId
        }
      }));
    }
    console.log(`Removed ${jobsToDelete.length} incomplete jobs.`);
  } catch (error) {
    console.error('Error removing incomplete jobs:', error);
  }
}

async function getTranscodingProgress(fileId, transcodingId) {
  const SSM = await getSecret(process.env.SECRET_NAME);
  const TABLE_NAME = await getParameter(process.env.DYNAMODB);
  const QUT_USERNAME = SSM.QUT_USERNAME;
  const result = await dynamoDB.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      'qut-username': QUT_USERNAME,
      'fileId': `${fileId}#transcoding#${transcodingId}`
    }
  }));

  // Ensure the function always returns a numeric progress or a default value
  return result.Item ? result.Item.progress : 0;
}

router.post('/start', auth, async (req, res) => {
  try {
    const { fileId, format, quality } = req.body;
    const userId = req.user.id;
    console.log(`Received transcoding request for fileId: ${fileId}, format: ${format}, quality: ${quality}`);
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const getParams = {
      TableName: TABLE_NAME,
      Key: {
        'qut-username': QUT_USERNAME,
        'fileId': fileId
      }
    };

    const fileResult = await dynamoDB.send(new GetCommand(getParams));
    const file = fileResult.Item;

    if (!file || file.userId !== userId) {
      console.log(`File not found or permission denied for fileId: ${fileId}`);
      return res.status(404).send({ error: 'File not found or you do not have permission to transcode it' });
    }

    const transcodingId = uuidv4();

    await updateTranscodingProgress(userId, fileId, transcodingId, format, quality, 0);

    startTranscoding(userId, file, format, quality, transcodingId).catch(error => {
      console.error(`Transcoding error for fileId: ${fileId}, transcodingId: ${transcodingId}`, error);
      updateTranscodingProgress(userId, fileId, transcodingId, format, quality, -1);
    });

    res.status(200).send({ message: 'Transcoding started', fileId, transcodingId });
  } catch (error) {
    console.error('Error in /transcode/start route:', error);
    res.status(400).send({ error: 'An error occurred while starting transcoding: ' + error.message });
  }
});

router.get('/progress/:fileId/:transcodingId', auth, async (req, res) => {
  try {
    const { fileId, transcodingId } = req.params;
    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const result = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        'qut-username': QUT_USERNAME,
        'fileId': `${fileId}#transcoding#${transcodingId}`
      }
    }));

    if (!result.Item) {
      // If the job is not found, it's likely completed and removed
      return res.status(404).send({ message: 'Transcoding job not found' });
    }

    const progress = result.Item.progress;
    res.status(200).send({ progress });
  } catch (error) {
    console.error('Error fetching transcoding progress:', error);
    res.status(400).send({ error: 'An error occurred while fetching progress' });
  }
});

async function startTranscoding(userId, file, format, quality, transcodingId) {
  try {
    console.log(`Starting transcoding for file: ${file.fileName}, transcodingId: ${transcodingId}`);
    console.log(`Format: ${format}, Quality: ${quality}`);

    const SSM = await getSecret(process.env.SECRET_NAME);
    const TABLE_NAME = await getParameter(process.env.DYNAMODB);
    const QUT_USERNAME = SSM.QUT_USERNAME;
    const S3_BUCKET_NAME = await getParameter(process.env.S3_BUCKET);
    const { Body } = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: file.s3Key
    }));

    const inputPath = `/tmp/${file.fileId}-${transcodingId}-input`;
    await require('fs').promises.writeFile(inputPath, await Body.transformToByteArray());

    const outputPath = `/tmp/${file.fileId}-${transcodingId}-output.${format}`;

    console.log(`Input path: ${inputPath}`);
    console.log(`Output path: ${outputPath}`);

    let lastProgress = 0;
    const ffmpegOptions = getFFmpegOptions(format, quality);
    console.log('FFmpeg options:', ffmpegOptions);

    const ffmpegCommand = ffmpeg(inputPath)
      .outputOptions(ffmpegOptions)
      .output(outputPath);

    ffmpegCommand.on('start', (commandLine) => {
      console.log('Spawned FFmpeg with command: ' + commandLine);
    });

    ffmpegCommand
      .on('progress', (progress) => {
        let currentProgress;
        if (progress.percent) {
          currentProgress = progress.percent;
        } else if (progress.frames && progress.currentFps && progress.currentKbps) {
          // If percent is not available, estimate progress based on frame count
          const totalFrames = file.duration * progress.currentFps;
          currentProgress = (progress.frames / totalFrames) * 100;
        } else {
          // If we can't calculate progress, use a simple incremental approach
          // currentProgress = Math.min(lastProgress + 1, 99);
        }

        currentProgress = Math.round(currentProgress);
        if (currentProgress > lastProgress) {
          lastProgress = currentProgress;
          // console.log(`Processing: ${currentProgress}% done`);
          updateTranscodingProgress(userId, file.fileId, transcodingId, format, quality, currentProgress)
            .catch(err => console.error('Error updating progress:', err));
        }
      })
      .on('end', async () => {
        console.log('Transcoding completed successfully');
        const fileContent = await require('fs').promises.readFile(outputPath);
        const newS3Key = `transcoded-${file.fileId}-${transcodingId}.${format}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: newS3Key,
          Body: fileContent
        }));

        await dynamoDB.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            'qut-username': QUT_USERNAME,
            'fileId': `${file.fileId}#version#${transcodingId}`,
            'userId': userId,
            'transcodingId': transcodingId,
            's3Key': newS3Key,
            'format': format,
            'quality': quality
          }
        }));

        await updateTranscodingProgress(userId, file.fileId, transcodingId, format, quality, 100);
        setTimeout(async () => {
          await dynamoDB.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              'qut-username': QUT_USERNAME,
              'fileId': `${file.fileId}#transcoding#${transcodingId}`
            }
          }));
        }, 1000); // 1 second delay
        await require('fs').promises.unlink(inputPath);
        await require('fs').promises.unlink(outputPath);
      })
      .on('error', async (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        await updateTranscodingProgress(userId, file.fileId, transcodingId, format, quality, -1); // Use -1 to indicate error
      });

    console.log('Starting FFmpeg process...');
    await new Promise((resolve, reject) => {
      ffmpegCommand.run();
      ffmpegCommand.on('end', resolve);
      ffmpegCommand.on('error', reject);
    });
    console.log('FFmpeg process completed');

  } catch (error) {
    console.error('Error in startTranscoding:', error);
    await updateTranscodingProgress(userId, file.fileId, transcodingId, format, quality, -1); // Use -1 to indicate error
  }
}

function getFFmpegOptions(format, quality) {
  const options = [];
  switch (format) {
    case 'mp4':
      options.push('-c:v libx264');
      break;
    case 'webm':
      options.push('-c:v libvpx-vp9');
      options.push('-row-mt 1');  // Enable row-based multithreading
      break;
  }

  let crf, bitrate;
  switch (quality) {
    case 'low':
      crf = 33;
      bitrate = '500k';
      break;
    case 'medium':
      crf = 28;
      bitrate = '1000k';
      break;
    case 'high':
      crf = 23;
      bitrate = '2000k';
      break;
  }

  if (format === 'webm') {
    options.push(`-crf ${crf}`, `-b:v ${bitrate}`, '-deadline good');
    options.push('-c:a libopus', '-b:a 128k');
  } else {
    options.push(`-crf ${crf}`, `-maxrate ${bitrate}`);
    options.push('-c:a aac', '-b:a 128k');
  }

  return options;
}

(async () => {
  await removeIncompleteJobs();
})();

module.exports = router;