import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface RedisClusterArgs {
  masterNodes?: pulumi.Input<number>,
  replicasPerMaster?: pulumi.Input<number>,
  namespace?: pulumi.Input<string>,
  persistenceEnabled?: pulumi.Input<boolean>,
  persistenceStorageClass?: pulumi.Input<string>,
  persistenceSize?: pulumi.Input<string>,
  memoryLimit?: pulumi.Input<string>,  
}

export class RedisCluster extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: RedisClusterArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const namespace = args.namespace || "redis-cluster"
    let persistenceEnabled = args.persistenceEnabled 
    const persistenceStorageClass = args.persistenceStorageClass || ""
    const persistenceSize = args.persistenceSize || "1Gi"
    let masterNodes = args.masterNodes
    let replicasPerMaster = args.replicasPerMaster
    const memoryLimit = args.memoryLimit || "1Gi"

    if (persistenceEnabled == null) {
      persistenceEnabled = true
    }

    if (masterNodes == null) {
      masterNodes = 3
    }

    if (replicasPerMaster == null) {
      replicasPerMaster = 0
    }

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )    
    
    
    const redisCluster = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "redis-cluster",
        fetchOpts: {
          repo: 'https://charts.bitnami.com/bitnami',
        },
        namespace: namespace,
        values: {
          usePassword: false,
          persistence: {
            enabled: persistenceEnabled,
            storageClass: persistenceStorageClass,
            size: persistenceSize
          },
          cluster: {
            nodes: masterNodes,
            replicas: replicasPerMaster
          },
          redis: {
            resources: {
              limits: {
                memory: memoryLimit
              }
            },
          }
        }
      },
      {
        parent: this,
        dependsOn: ns,
      },
    )      
  }
}