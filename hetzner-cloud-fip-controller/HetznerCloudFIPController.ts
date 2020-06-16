import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

declare var require: any;

export interface HetznerCloudFIPControllerArgs {
  addresses: pulumi.Input<pulumi.Input<string>[]>,
  apiToken?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  nodeAddressType?: pulumi.Input<string>,
  replicaCount?: pulumi.Input<number>,
}

export class HetznerCloudFIPController extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: HetznerCloudFIPControllerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const apiToken = pulumi.output(args.apiToken || config.getSecret('apiToken') || "blah")
    const namespace = args.namespace || config.get("namespace") || "hcloud-fip-controller"
    const addresses = args.addresses
    const nodeAddressType = args.nodeAddressType || "internal"
    const replicaCount = args.replicaCount || 3

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )        


    const token: pulumi.Output<string> = pulumi.interpolate `HCLOUD_API_TOKEN: '${apiToken}'`

    const chart = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "hcloud-fip-controller",
        fetchOpts: {
          repo: 'https://cbeneke.github.com/helm-charts',
        },        
        namespace: namespace,
        values: {
          replicaCount: replicaCount,
          configInline: {
            hcloud_floating_ips: addresses,
            node_address_type: nodeAddressType
          },
          secretInline: token
        }
      },
      {
        parent: this,
        dependsOn: [
          ns,
        ],
      },
    )       
  }
}