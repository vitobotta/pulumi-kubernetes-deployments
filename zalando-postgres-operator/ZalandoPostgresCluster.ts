import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface ZalandoPostgresClusterArgs {
  namespace: pulumi.Input<string>,
  teamId: pulumi.Input<string>,
  storageClass: pulumi.Input<string>,
  storageSize: pulumi.Input<string>,
  numberOfInstances?: pulumi.Input<number>,
  podConfigMapName?: pulumi.Input<string>,
  s3Region?: pulumi.Input<string>,
  s3Endpoint?: pulumi.Input<string>,
  s3Bucket?: pulumi.Input<string>,
  s3AccessKeyId?: pulumi.Input<string>,
  s3SecretAccessKey?: pulumi.Input<string>,
  s3ForcePathStyle?: pulumi.Input<boolean>,
  version?: pulumi.Input<string>,
  sharedBuffers?: pulumi.Input<string>,
  maxConnections?: pulumi.Input<number>,
  cpuRequest?: pulumi.Input<string>,
  memoryRequest?: pulumi.Input<string>,
  cpuLimit?: pulumi.Input<string>,
  memoryLimit?: pulumi.Input<string>,
  enableLogicalBackups?: pulumi.Input<boolean>,
  enableWalBackups?: pulumi.Input<boolean>,
  logicalBackupSchedule?: pulumi.Input<string>,
  walBackupsToRetain?: pulumi.Input<string>,
  walBackupSchedule?: pulumi.Input<string>,
  clone?: pulumi.Input<boolean>,
  cloneClusterID?: pulumi.Input<string>,
  cloneClusterName?: pulumi.Input<string>,
  cloneTargetTime?: pulumi.Input<string>,
  maxPoolConnections?: pulumi.Input<number>,
  poolUser?: pulumi.Input<string>,
  users?: {
    [key: string]: Array<string>,
  },
  databases?: {
    [key: string]: string;
  }
}

export class ZalandoPostgresCluster extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: ZalandoPostgresClusterArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {

    super('ZalandoPostgresCluster', appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const namespace = args.namespace
    const teamId = args.teamId
    const storageClass = args.storageClass
    const storageSize = args.storageSize

    const s3Region: string = String(args.s3Region || config.get('s3Region'))
    const s3Endpoint: string = String(args.s3Endpoint || config.get('s3Endpoint'))
    const s3Bucket: string = String(args.s3Bucket || config.get('s3Bucket'))
    const s3AccessKeyId = pulumi.output(args.s3AccessKeyId || config.getSecret('s3AccessKeyId'))
    const s3SecretAccessKey = pulumi.output(args.s3SecretAccessKey || config.getSecret('s3SecretAccessKey'))
    const s3ForcePathStyle = pulumi.output(args.s3ForcePathStyle || config.getSecret('s3ForcePathStyle') || false).toString()

    const podConfigMapName = args.podConfigMapName || "postgres-pod-config"
    const numberOfInstances = args.numberOfInstances || 1
    const version = args.version || "12"
    const sharedBuffers = args.sharedBuffers || "32MB"
    const maxConnections = args.maxConnections || "500"
    const cpuRequest = args.cpuRequest || "10m"
    const memoryRequest = args.memoryRequest || "100Mi"
    const cpuLimit = args.cpuLimit || "500m"
    const memoryLimit = args.memoryLimit || "500Mi"
    const enableLogicalBackups = args.enableLogicalBackups || false
    const logicalBackupSchedule = args.logicalBackupSchedule || "00 05 * * *"
    const enableWalBackups = args.enableWalBackups || false
    const walBackupsToRetain = args.walBackupsToRetain || "14"
    const walBackupSchedule = args.walBackupSchedule || "0 */12 * * *"
    const clone = args.clone || false
    const cloneClusterID = args.cloneClusterID || ""
    const cloneTargetTime = args.cloneTargetTime || "2050-02-04T12:49:03+00:00"
    const cloneClusterName = args.cloneClusterName || ""
    const users = args.users || {}
    const databases = args.databases || {}
    const maxPoolConnections = args.databases || 200
    const poolUser = args.poolUser || "pooler"

    let configMapData = {}

    if (clone) {
      configMapData = {
        "BACKUP_SCHEDULE": walBackupSchedule,
        "USE_WALG_BACKUP": String(enableWalBackups),
        "BACKUP_NUM_TO_RETAIN": walBackupsToRetain,
        "WAL_S3_BUCKET": s3Bucket,
        "AWS_ACCESS_KEY_ID": s3AccessKeyId,
        "AWS_SECRET_ACCESS_KEY": s3SecretAccessKey,
        "AWS_ENDPOINT": s3Endpoint,
        "AWS_REGION": s3Region,
        "AWS_S3_FORCE_PATH_STYLE": s3ForcePathStyle,
        "WALG_DISABLE_S3_SSE": "true",
        "USEWALG_RESTORE": "true",
        "CLONE_METHOD": "CLONE_WITH_WALE",
        "CLONE_AWS_ACCESS_KEY_ID": s3AccessKeyId,
        "CLONE_AWS_SECRET_ACCESS_KEY": s3SecretAccessKey,
        "CLONE_AWS_ENDPOINT": s3Endpoint,
        "CLONE_AWS_REGION": s3Region,
        "CLONE_WAL_S3_BUCKET": s3Bucket,
        "CLONE_WAL_BUCKET_SCOPE_SUFFIX": `/${cloneClusterID}`,
        "CLONE_TARGET_TIME": cloneTargetTime,
        "CLONE_SCOPE": cloneClusterName
      }
    } else {
      configMapData = {
        "BACKUP_SCHEDULE": walBackupSchedule,
        "USE_WALG_BACKUP": String(enableWalBackups),
        "BACKUP_NUM_TO_RETAIN": walBackupsToRetain,
        "WAL_S3_BUCKET": s3Bucket,
        "AWS_ACCESS_KEY_ID": s3AccessKeyId,
        "AWS_SECRET_ACCESS_KEY": s3SecretAccessKey,
        "AWS_ENDPOINT": s3Endpoint,
        "AWS_REGION": s3Region,
        "WALG_DISABLE_S3_SSE": "true",
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
    
    const configMap = new k8s.core.v1.ConfigMap(`${appName}-config-map`, 
      {
        metadata: {
          name: podConfigMapName,
          namespace: namespace
        },
        data: configMapData
      },
      {
        parent: this,
        dependsOn: [
          ns
        ]
      }
    );    

    const cluster = new k8s.apiextensions.CustomResource(appName, 
      {
        kind: "postgresql",
        apiVersion: "acid.zalan.do/v1",
        metadata: {
          name: appName,
          namespace: namespace,
        },
        spec: {
          teamId: teamId,
          volume: {
            size: storageSize,
            storageClass: storageClass
          },
          numberOfInstances: numberOfInstances,
          users: users,
          databases: databases,
          postgresql: {
            version: version,
            parameters: {
              shared_buffers: sharedBuffers,
              max_connections: maxConnections
            }
          },
          enableConnectionPooler: false,
          // connectionPooler: {
          //   user: poolUser
          // },
          resources: {
            requests: {
              cpu: cpuRequest,
              memory: memoryRequest
            },
            limits: {
              cpu: cpuLimit,
              memory: memoryLimit
            }
          },
          enableLogicalBackup: enableLogicalBackups,
          logicalBackupSchedule: logicalBackupSchedule,
          initContainers: [],
          sidecars: []
        }
      }, 
      {
        parent: this,
        dependsOn: [
          ns,
          configMap
        ]
      }
    )    
  }
}