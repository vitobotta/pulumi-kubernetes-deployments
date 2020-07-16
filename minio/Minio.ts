import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface MinioArgs {
  namespace?: pulumi.Input<string>,
  mode?: pulumi.Input<string>,
  replicas?: pulumi.Input<number>,
  drivesPerNode?: pulumi.Input<number>,
  zones?: pulumi.Input<number>,
  persistenceEnabled?: pulumi.Input<boolean>,
  persistenceStorageClass?: pulumi.Input<string>,
  persistenceSize?: pulumi.Input<string>,
  veleroBackupEnabled?: pulumi.Input<boolean>,
  memoryRequest?: pulumi.Input<string>,
}

export class Minio extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: MinioArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const accessKey = pulumi.output(config.requireSecret('accessKey'))
    const secretKey = pulumi.output(config.requireSecret('secretKey'))

    const namespace = args.namespace || "minio"
    const mode = args.mode || "standalone"
    const replicas = args.replicas || 4
    const drivesPerNode = args.drivesPerNode || 1
    const zones = args.zones || 1
    const persistenceEnabled = args.persistenceEnabled || true
    const persistenceStorageClass = args.persistenceStorageClass || ""
    const persistenceSize = args.persistenceSize || "1Gi"
    const memoryRequest = args.memoryRequest || "512Mi" 
    const veleroBackupEnabled = args.veleroBackupEnabled || false

    let podAnnotations = {}

    if (veleroBackupEnabled) {
      podAnnotations = {
        "backup.velero.io/backup-volumes": "export"
      }
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


    function fixApiVersions(o: any) {
      if (o !== undefined) {
        switch (o.apiVersion) {
          case "apps/v1beta2":
            o.apiVersion = "apps/v1";
            break;
        
          default:
            break;
        }
      }
    }     
    
    const Minio = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "minio",
        transformations: [fixApiVersions],
        fetchOpts: {
          repo: 'https://kubernetes-charts.storage.googleapis.com',
        },
        namespace: namespace,
        values: {
          mode: mode,
          accessKey: accessKey,
          secretKey: secretKey,
          drivesPerNode: drivesPerNode,
          replicas: replicas,
          zones: zones,
          persistence: {
            enabled: persistenceEnabled,
            storageClass: persistenceStorageClass,
            size: persistenceSize
          },
          service: {
            annotations: {
              "prometheus.io/scrape": 'true',
              "prometheus.io/path": '/minio/prometheus/metrics',
              "prometheus.io/port": '9000'              
            }
          },
          podAnnotations: podAnnotations,
          metrics: {
            serviceMonitor: {
              enabled: true
            }
          },
          resources: {
            requests: {
              memory: memoryRequest
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