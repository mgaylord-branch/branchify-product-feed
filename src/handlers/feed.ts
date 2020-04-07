import { StringStream } from 'scramjet'
import { getStream, getFile } from '../utils/s3'
import { parse, unparse } from 'papaparse'
import { Product } from '../models/Product'
import { feedDelimiter, configurationBucket } from '../utils/Config'
import { S3CreateEvent, Context, Callback } from 'aws-lambda'
import { FeedConfiguration, loadFeedConfigurations } from '../models/Mapping'
import { transform } from '../transformers/Transformer'

export const run = async (event: S3CreateEvent, _context: Context, _callback: Callback): Promise<any> => {
  console.info(`New file arrived: ${JSON.stringify(event.Records[0])}`)
  const bucket = event.Records[0].s3.bucket.name
  const filename = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
  const stream = getStream(bucket, filename)
  console.debug(`Creating Branchified feed for: ${bucket}/${filename}`)
  await branchifyFeed(stream, filename)
  console.debug(`Feed created successfully`)

  return {
    statusCode: 200,
    body: `File received: ${filename} successfully from bucket: ${bucket}`,
    isBase64Encoded: false
  }
}

export async function branchifyFeed(
  stream: NodeJS.ReadableStream,
  filename: string
): Promise<{batchCount: number, eventCount: number}> {
  let counter = 0
  let sequence = 0
  var header: string

  const feedConfig = await getFeedConfiguration()
  
  const feeds = await Promise.all(feedConfig.map(async configuration => {
    return await StringStream.from(stream, { maxParallel: 10 })
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
      counter = counter + products.length
      sequence++
      // convert products list back to csv and return...
      return unparse(branchified)
    })
    .toArray()
    .catch((e: { stack: any }) => {
      console.error(`Error converting products: ${e.stack} counter: ${counter}`)
      throw e
    })
  }))
  
  console.debug(`Result: ${JSON.stringify(feeds)}`)
  console.debug(`Products returned: ${feeds.length} for filename: ${filename}`)
  console.debug(`Total products processed: ${counter} - Total sequences: ${sequence}`)
  return { batchCount: sequence, eventCount: counter}
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