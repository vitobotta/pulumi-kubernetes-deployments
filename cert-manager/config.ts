import * as pulumi from '@pulumi/pulumi'

const config: pulumi.Config = new pulumi.Config('cert-manager')

export const version: string = config.get('version') || "v1.0.1"
export const namespace: string = config.get('namespace') || "cert-manager"
export const email: string = config.require('email')
export const cloudflareEmail: string = config.require('cloudflareEmail')
export const cloudflareAPIKey = config.requireSecret('cloudflareAPIKey')