import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as fs from "fs";
import * as path from "path";
import * as nodepath from "path";
import * as shell from "shelljs";

declare var require: any;

export interface HetznerCloudFIPControllerArgs {
  addresses: pulumi.Input<pulumi.Input<string>[]>,
  apiToken?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  nodeAddressType?: pulumi.Input<string>,
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

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )        

    const repoDir = path.resolve(`/tmp/hetzner-cloud-fip-controller`);

    if (!fs.existsSync(nodepath.join(repoDir))) {
      shell.exec(`git clone https://github.com/vitobotta/helm-charts.git ${repoDir}`)
    }    

    const chart = new k8s.helm.v3.Chart(
      appName,
      {
        path: nodepath.join(repoDir, "charts", "hcloud-fip-controller"),
        namespace: namespace,
        values: {
          deploymentKind: "DaemonSet",
          configInline: {
            hcloud_floating_ips: addresses,
            node_address_type: nodeAddressType
          },
          hcloudAPIToken: apiToken
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