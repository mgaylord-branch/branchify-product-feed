import * as AWS from 'aws-sdk'

export const s3 = new AWS.S3({
  region: process.env.REGION,
  accessKeyId: "",
  secretAccessKey: ""
})

export const outputBucket = process.env.OUTPUT_BUCKET
export const feedDelimiter = process.env.FEED_DELIMITER
export const configurationBucket = process.env.CONFIG_BUCKET