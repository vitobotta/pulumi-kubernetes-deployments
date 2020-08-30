import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface MemcachedArgs {
  replicaCount?: pulumi.Input<number>,
  memory?: pulumi.Input<number>,
  namespace?: pulumi.Input<string>,
}

export class Memcached extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: MemcachedArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const replicaCount = args.replicaCount || 1
    const memory = args.memory || 512
    const namespace = args.namespace || appName

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )   
    
    const memcached = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "memcached",
        fetchOpts: {
          repo: 'https://kubernetes-charts.storage.googleapis.com',
        },
        namespace: namespace,
        values: {
          memcached: {
            maxItemMemory: memory
          },
          metrics: {
            enabled: true,
            serviceMonitor: {
              enabled: true
            }
          },
          replicaCount: replicaCount
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