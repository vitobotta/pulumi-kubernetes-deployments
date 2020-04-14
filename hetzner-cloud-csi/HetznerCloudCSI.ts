import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

import * as config from './config'

export interface HetznerCloudCSIArgs {
  version?: pulumi.Input<string>,
  token?: pulumi.Input<string>,
}

export class HetznerCloudCSI extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: HetznerCloudCSIArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {

    super('HetznerCloudCSI', appName, {}, opts)

    const version = args.version || config.version
    const token = args.token || config.token;
    const manifestURL = `https://raw.githubusercontent.com/hetznercloud/csi-driver/v${version}/deploy/kubernetes/hcloud-csi.yml`;

    const secret = new k8s.core.v1.Secret(`${appName}-hetzner-cloud-token`, 
      {
        metadata: {
          name: "hcloud-csi",
          namespace: "kube-system",
        },
        stringData: {
          token: token
        },
      },
      {
        parent: this,
      },      
    )

    const manifest = new k8s.yaml.ConfigFile(
      `${appName}-manifest`,
      {
        file: manifestURL,
      },
      {
        parent: this,
        dependsOn: [
          secret,
        ],
      },
    )   
  }
}