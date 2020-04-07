import * as AWS from 'aws-sdk'

export const s3 = new AWS.S3({
  region: process.env.REGION,
  accessKeyId: "AKIAV7QWTMUFZF5ECYNG",
  secretAccessKey: "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"
})

export const outputBucket = process.env.FEED_OUTPUT_BUCKET
export const feedDelimiter = process.env.FEED_DELIMITER
export const configurationBucket = process.env.CONFIG_BUCKET