import { s3 } from './Config'

export function getStream(bucket: string, filename: string): NodeJS.ReadableStream {
  console.debug(`Reading stream: ${bucket}/${filename}`)
  return s3.getObject({
    Bucket: bucket,
    Key: filename
  }).createReadStream()
}

export async function getFile(bucket: string, filename: string): Promise<string> {
  console.debug(`Reading file: ${bucket}/${filename}`)
  const object = await s3.getObject({
    Bucket: bucket,
    Key: filename
  }).promise()
  return object.Body.toString()
}

export async function uploadReadableStream(stream: NodeJS.ReadableStream, bucket: string, key: string, path: string) {
  const params = {
    Bucket: bucket, 
    Key: key, 
    Body: stream,
    Metadata: { downloadPath: path}
  }
  return s3.upload(params).promise()
}