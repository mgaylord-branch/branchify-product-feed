import { StringStream } from 'scramjet'
// import { getStream, getFile, uploadPart, createMultiPartUpload, completeUploadPart, abortMultipartUpload, uploadReadableStream } from '../utils/s3'
import {
  getStream,
  getFile,
  uploadReadableStream,
  getFileSize,
  createMultiPartUpload,
  uploadPart,
  completeUploadPart,
  abortMultipartUpload,
} from '../utils/s3'
import { parse, unparse } from 'papaparse'
import { Product } from '../models/Product'
import { feedDelimiter, configurationBucket, outputBucket } from '../utils/Config'
import { S3CreateEvent, Context, Callback } from 'aws-lambda'
import { FeedConfiguration, loadFeedConfigurations } from '../models/Mapping'
import { transform } from '../transformers/Transformer'

export const run = async (event: S3CreateEvent, _context: Context, _callback: Callback): Promise<any> => {
  console.info(`New file arrived: ${JSON.stringify(event.Records[0])}`)
  const bucket = event.Records[0].s3.bucket.name
  const filename = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
  const stream = getStream(bucket, filename)
  console.debug(`Creating Branchified feed for: ${bucket}/${filename}`)
  await branchifyFeed(stream, await useMultipart(bucket, filename))
  console.debug(`Feed created successfully for file: ${filename}`)
  return {
    statusCode: 200,
    body: `File received: ${filename} successfully from bucket: ${bucket}`,
    isBase64Encoded: false,
  }
}

export async function branchifyFeed(stream: NodeJS.ReadableStream, useMultipart: boolean) {
  const feedConfig = await getFeedConfiguration()
  await feedConfig.reduce(async (_previous, current, _index, _input) => {
    const destinationKey = current.destinationKey
      const bucket = outputBucket
      const stringStream = createStream(stream, current)
      if (useMultipart) {
        await createFeedInParts(destinationKey, bucket, stringStream)
      } else {
        await createFeedOnce(destinationKey, bucket, stringStream)
      }
  }, Promise.resolve())
}

export async function createFeedOnce(destinationKey: string, bucket: string, stream: StringStream) {
  console.info(`Creating stream in single part upload...`)
  return stream.toArray().then((values) => {
    return uploadReadableStream(values.join('\n'), bucket, destinationKey, bucket)
  })
}

export async function createFeedInParts(destinationKey: string, bucket: string, stream: StringStream) {
  console.info(`Creating stream using multipart upload...`)
  const params = await createMultiPartUpload(destinationKey, bucket)
  var counter = 1
  return stream
    .each(async (body) => {
      console.debug(`Uploading part: ${counter}`)
      return uploadPart(params, counter++, body)
    })
    .toArray()
    .then((parts) => {
      console.debug(`All parts uploaded, completing upload: ${JSON.stringify(parts)}`)
      return completeUploadPart(params, parts)
    })
    .catch((e) => {
      console.error(`Error, aborting upload for ${destinationKey} due to: `, e)
      return abortMultipartUpload(params)
    })
}

export function convertProducts(products: Product[], configuration: FeedConfiguration): Product[] {
  const result = transform(products, configuration)
  console.debug(`Products branchified: ${result.length}`)
  return result
}

export function parseProducts(input: string, delimiter: string): Product[] {
  const products: Product[] = parse(input, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  }).data
  console.debug(`Products parsed: ${products.length}`)
  return products
}

function createStream(stream: NodeJS.ReadableStream, configuration: FeedConfiguration) {
  let header: string
  var hasUsedHeader = false
  return StringStream.from(stream, { maxParallel: 2 })
    .lines('\n')
    .batch(20000)
    .map(async function (chunks: Array<string>) {
      var input = ''
      if (!header) {
        header = chunks[0]
        input = chunks.join('\n')
      } else {
        input = header + '\n' + chunks.join('\n')
      }
      const products = parseProducts(input, feedDelimiter)
      const branchified = convertProducts(products, configuration)
      // convert products list back to csv and return...
      const result = unparse(branchified, {
        delimiter: feedDelimiter,
        header: !hasUsedHeader,
        skipEmptyLines: true,
      })
      hasUsedHeader = true
      return result
    })
}

async function getFeedConfiguration(): Promise<FeedConfiguration[]> {
  const config = await getFile(configurationBucket, 'FeedConfig.json')
  const feedConfig = JSON.parse(config)
  console.log(`Feed config: ${JSON.stringify(feedConfig)}`)
  return loadFeedConfigurations(feedConfig)
}

async function useMultipart(bucket: string, filename: string): Promise<boolean> {
  const fileSize = await getFileSize(bucket, filename)
  console.debug(`File size of stream is: ${fileSize}`)
  return fileSize > 10000000
}
