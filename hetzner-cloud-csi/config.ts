import * as pulumi from '@pulumi/pulumi'

const config: pulumi.Config = new pulumi.Config('hetzner-cloud-csi')

export const namespace: string = config.get('namespace') || "kube-system"
export const token = config.requireSecret('token')