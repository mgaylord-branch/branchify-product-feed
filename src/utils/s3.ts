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

export async function getFileSize(bucket: string, filename: string): Promise<number> {
    const result = await s3.headObject({ Key: filename, Bucket: bucket })
        .promise()
    return result.ContentLength
}

export async function uploadReadableStream(body: String | NodeJS.ReadableStream, bucket: string, key: string, path: string) {
  const params = {
    Bucket: bucket, 
    Key: key, 
    Body: body,
    Metadata: { downloadPath: path}
  }
  return s3.upload(params).promise()
}

export async function createMultiPartUpload(Key: string, Bucket: string): Promise<S3UploadParams> {
  const upload = await s3.createMultipartUpload({Key, Bucket}).promise();
  return { UploadId: upload.UploadId, Key, Bucket}
}

export async function uploadPart(params: S3UploadParams, partNumber: number, body: string) {
  return s3.uploadPart({
    ...params,
    Body: Buffer.from(body, 'utf-8'),
    PartNumber: partNumber,
  }).promise()
}

export async function completeUploadPart(params: S3UploadParams, parts: any) {
  return s3.completeMultipartUpload({
    ...params,
    MultipartUpload: {
      Parts: parts.map(({ ETag }, i) => ({ ETag, PartNumber: i + 1 }))
    }
  }).promise()
}

export async function abortMultipartUpload(params: S3UploadParams) {
  return s3.abortMultipartUpload(params).promise()
}

export interface S3UploadParams {
  Key:string, 
  Bucket: string, 
  UploadId: string
}