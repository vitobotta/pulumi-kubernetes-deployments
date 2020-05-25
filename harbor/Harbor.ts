import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface HarborArgs {
  namespace?: pulumi.Input<string>,
  hostname: pulumi.Input<string>,
  exposeType?: pulumi.Input<string>,
  ingressClass?: pulumi.Input<string>,
  certManagerClusterIssuer?: pulumi.Input<string>,
  tlsSecretName?: pulumi.Input<string>,
  tlsEnabled?: pulumi.Input<boolean>,
  veleroBackupEnabled?: pulumi.Input<boolean>,
  clairEnabled?: pulumi.Input<boolean>,
  persistenceEnabled?: pulumi.Input<boolean>,
  storageClass?: pulumi.Input<string>,
  persistenceRegistrySize?: pulumi.Input<string>,
  persistenceChartMuseumSize?: pulumi.Input<string>,
  persistenceJobServiceSize?: pulumi.Input<string>,
  persistenceDatabaseSize?: pulumi.Input<string>,
  persistenceRedisSize?: pulumi.Input<string>,
  version?: pulumi.Input<string>,
  adminPassword?: pulumi.Input<string>,
  secretKey?: pulumi.Input<string>,
}

export class Harbor extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: HarborArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const adminPassword = args.adminPassword || config.requireSecret("adminPassword")
    const secretKey = args.secretKey || config.requireSecret("secretKey")
    const namespace = args.namespace || "harbor"
    const version = args.version || "1.3.1"
    const ingressClass = args.ingressClass || "nginx"
    const hostname = args.hostname
    const exposeType = args.exposeType || "ingress"
    const certManagerClusterIssuer = args.certManagerClusterIssuer || "letsencrypt-prod"
    const tlsSecretName = args.tlsSecretName || "harbor-ingress-cert"
    const tlsEnabled = args.tlsEnabled || true
    const veleroBackupEnabled = args.veleroBackupEnabled || false
    const clairEnabled = args.clairEnabled || true
    const persistenceEnabled = args.persistenceEnabled || true
    const storageClass = args.storageClass || ""
    const persistenceRegistrySize = args.persistenceRegistrySize || "50Gi"
    const persistenceChartMuseumSize = args.persistenceChartMuseumSize || "5Gi"
    const persistenceJobServiceSize = args.persistenceJobServiceSize || "1Gi"
    const persistenceDatabaseSize = args.persistenceDatabaseSize || "5Gi"
    const persistenceRedisSize = args.persistenceRedisSize || "1Gi"
    
    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )    

    let ingressSettings = {}

    if (exposeType == "ingress") {
      ingressSettings = {
        annotations: {
          "cert-manager.io/cluster-issuer": certManagerClusterIssuer,
          "kubernetes.io/tls-acme": "true",
          "kubernetes.io/ingress.class": ingressClass,
          "acme.cert-manager.io/http01-ingress-class": ingressClass,
        },
        hosts: {
          core: hostname
        }
      }  
    }

    let persistenceSettings = {}

    if (persistenceEnabled) {
      persistenceSettings = {
        persistentVolumeClaim: {
          registry: {
            storageClass: storageClass,
            size: persistenceRegistrySize
          },
          chartmuseum: {
            storageClass: storageClass,
            size: persistenceChartMuseumSize
          },
          jobservice: {
            storageClass: storageClass,
            size: persistenceJobServiceSize
          },
          database: {
            storageClass: storageClass,
            size: persistenceDatabaseSize
          },
          redis: {
            storageClass: storageClass,
            size: persistenceRedisSize
          },
        }
      }
    }

    const externalURL = (tlsEnabled ? `https://${hostname}` : `http://${hostname}`)

    let jobservicePodAnnotations = {};
    let registryPodAnnotations = {};
    let databasePodAnnotations = {};
    let redisPodAnnotations = {};

    if (veleroBackupEnabled) {
      jobservicePodAnnotations = {
        "backup.velero.io/backup-volumes": "job-logs"
      };

      registryPodAnnotations = {
        "backup.velero.io/backup-volumes": "registry-data"
      };

      databasePodAnnotations = {
        "backup.velero.io/backup-volumes": "database-data"
      };

      redisPodAnnotations = {
        "backup.velero.io/backup-volumes": "data"
      };
    }

    const Harbor = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "harbor",
        version: version,
        fetchOpts: {
          repo: 'https://helm.goharbor.io',
        },
        namespace: namespace,
        values: {
          expose: {
            type: exposeType,
            ingress: ingressSettings,
            tls: {
              enabled: tlsEnabled,
              secretName: tlsSecretName
            }
          },
          persistence: persistenceSettings,
          externalURL: externalURL,
          harborAdminPassword: adminPassword,
          secretkey: secretKey,
          clair: {
            enabled: clairEnabled
          },
          notary: {
            enabled: false
          },
          database: {
            type: "internal",
            podAnnotations: databasePodAnnotations
          },
          redis: {
            type: "internal",
            podAnnotations: redisPodAnnotations
          },
          jobservice: {
            podAnnotations: jobservicePodAnnotations
          },
          registry: {
            podAnnotations: registryPodAnnotations
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