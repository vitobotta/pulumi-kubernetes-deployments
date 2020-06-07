import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as fs from "fs";
import * as path from "path";
import * as nodepath from "path";
import * as shell from "shelljs";


export interface RedisClusterProxyArgs {
  cluster_address: pulumi.Input<string>,
  port?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
}

export class RedisClusterProxy extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: RedisClusterProxyArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {

    super('RedisProxyCluster', appName, {}, opts)

    const cluster_address = args.cluster_address
    const port = args.port || "7777"
    const namespace = args.namespace || "redis-cluster-proxy"

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )

    const repoDir = path.resolve(`/tmp/redis-cluster-proxy`);

    if (!fs.existsSync(nodepath.join(repoDir))) {
      shell.exec(`git clone https://github.com/vitobotta/redis-cluster-proxy-helm.git ${repoDir}`)
    }    
  
    const chart = new k8s.helm.v3.Chart(
      appName,
      {
        path: nodepath.join(repoDir),
        namespace: namespace,
        values: {
          cluster_address: cluster_address,
          port: port
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
