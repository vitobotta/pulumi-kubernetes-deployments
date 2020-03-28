import * as pulumi from '@pulumi/pulumi'

const config: pulumi.Config = new pulumi.Config('velero')

export const version: string = config.require('version')
export const namespace: string = config.get('namespace') || "velero"
export const s3Bucket: string = config.require('s3Bucket')
export const s3Region: string = config.require('s3Region')
export const s3Url: string = config.require('s3Url')
export const prefix: string = config.get('prefix') || "velero"
export const awsPluginVersion: string = config.get('awsPluginVersion') || "v1.0.0"
export const awsSecretAccessKey = config.requireSecret('awsSecretAccessKey')
export const awsAccessKeyId = config.requireSecret('awsAccessKeyId')
export const deployRestic: boolean = (config.get('deployRestic') == "true") || true