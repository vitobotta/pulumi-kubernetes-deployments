import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface RedisClusterArgs {
  masterNodes: pulumi.Input<string>,
  replicasPerMaster: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  persistenceEnabled?: pulumi.Input<boolean>,
  persistenceStorageClass?: pulumi.Input<string>,
  persistenceSize?: pulumi.Input<string>,
  maxmemoryPolicy?: pulumi.Input<string>,
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
    const persistenceEnabled = args.persistenceEnabled || true
    const persistenceStorageClass = args.persistenceStorageClass || ""
    const persistenceSize = args.persistenceSize || "1Gi"
    const masterNodes = args.masterNodes || 3
    const replicasPerMaster = args.replicasPerMaster || 1
    const maxmemoryPolicy = args.maxmemoryPolicy || "noeviction"
    const memoryLimit = args.memoryLimit || "1Gi"

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
          cluster: {
            nodes: masterNodes,
            replicas: replicasPerMaster
          },
          persistence: {
            enabled: persistenceEnabled,
            storageClass: persistenceStorageClass,
            size: persistenceSize
          },
          extraFlags: [
            `--maxmemory-policy ${maxmemoryPolicy}`
          ],
          resources: {
            limits: {
              memory: memoryLimit
            }
          }
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