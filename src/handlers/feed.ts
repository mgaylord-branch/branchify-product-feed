import { StringStream } from 'scramjet'
import { getStream, getFile, uploadPart, createMultiPartUpload, completeUploadPart, abortMultipartUpload } from '../utils/s3'
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
  await branchifyFeed(stream)
  console.debug(`Feed created successfully for file: ${filename}`)

  return {
    statusCode: 200,
    body: `File received: ${filename} successfully from bucket: ${bucket}`,
    isBase64Encoded: false
  }
}

export async function branchifyFeed(
  stream: NodeJS.ReadableStream
) {
  const feedConfig = await getFeedConfiguration()
  return Promise.all(feedConfig.map(async configuration => {
    return createFeed(stream, configuration)
    // return await StringStream.from(stream, { maxParallel: 10 })
    // .lines('\n')
    // .batch(500)
    // .map(async function(chunks: Array<string>) {
    //   var input = ''
    //   if (!header) {
    //     header = chunks[0]
    //     input = chunks.join('\n')
    //   } else {
    //     input = header + '\n' + chunks.join('\n')
    //   }
    //   const products = parseProducts(input)
    //   const branchified = convertProducts(products, configuration)
    //   counter = counter + products.length
    //   sequence++
    //   // convert products list back to csv and return...
    //   return unparse(branchified)
    // })
    // .toArray()
    // .catch((e: { stack: any }) => {
    //   console.error(`Error converting products: ${e.stack} counter: ${counter}`)
    //   throw e
    // })
  }))
}

export async function createFeed(stream: NodeJS.ReadableStream, configuration: FeedConfiguration) {
  const destinationKey = configuration.destinationKey
  const bucket = outputBucket

  const params = await createMultiPartUpload(destinationKey, bucket)
  let i = 1
  let header: string
  StringStream.from(stream, { maxParallel: 10 })
    .lines('\n')
    .batch(500)
    .map(async function(chunks: Array<string>) {
      var input = ''
      if (!header) {
        header = chunks[0]
        input = chunks.join('\n')
      } else {
        input = header + '\n' + chunks.join('\n')
      }
      const products = parseProducts(input)
      const branchified = convertProducts(products, configuration)
      // convert products list back to csv and return...
      return unparse(branchified)
    })
    .map(body => {
      console.debug(`Uploading part: ${i}`)
      return uploadPart(params, i++, body)
    })
    .toArray()
    .then(parts => {
      console.debug(`All parts uploaded, completing upload: ${JSON.stringify(parts)}`)
      return completeUploadPart(params, parts)
    })
    .catch((e) => {
      console.error(`Error, aborting upload due to: `, e)
      return abortMultipartUpload(params)
    })
}

export function convertProducts(products: Product[], configuration: FeedConfiguration) : Product[] {
  const result = transform(products, configuration)
  console.log(`Products: ${JSON.stringify(result)}`)
  return result
}

export function parseProducts(input: string): Product[] {
  const products: Product[] = parse(input, {
    delimiter: feedDelimiter,
    header: true,
    skipEmptyLines: true
  }).data
  return products
}

async function getFeedConfiguration(): Promise<FeedConfiguration[]> {
  const config = await getFile(configurationBucket, 'FeedConfig.json')
  const feedConfig = JSON.parse(config)
  console.log(`Feed config: ${JSON.stringify(feedConfig)}`)
  return loadFeedConfigurations(feedConfig)
}