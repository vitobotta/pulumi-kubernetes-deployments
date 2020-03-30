import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as fs from "fs";
import * as path from "path";
import * as nodepath from "path";
import * as shell from "shelljs";


export interface ZalandoPostgresOperatorArgs {
  version?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  s3Region?: pulumi.Input<string>,
  s3Endpoint?: pulumi.Input<string>,
  s3Bucket?: pulumi.Input<string>,
  logicalBackupS3SSE?: pulumi.Input<string>,
  logicalBackupDefaultSchedule?: pulumi.Input<string>,
  spiloImage?: pulumi.Input<string>,
  logicalBackupsImage?: pulumi.Input<string>,
}

export class ZalandoPostgresOperator extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: ZalandoPostgresOperatorArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {

    super('ZalandoPostgres', appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const version = args.version || config.get('version') || "1.4.0"
    const namespace = args.namespace || config.get('namespace') || "postgres-operator"
    const s3Region = args.s3Region || config.get('s3Region')
    const s3Endpoint = args.s3Endpoint || config.get('s3Endpoint')
    const s3Bucket = args.s3Bucket || config.get('s3Bucket')
    const logicalBackupS3SSE = args.logicalBackupS3SSE || config.get('logicalBackupS3SSE') || ""
    const logicalBackupDefaultSchedule = args.logicalBackupDefaultSchedule || config.get('logicalBackupDefaultSchedule') || "00 05 * * *"
    const s3AccessKeyId = config.requireSecret('s3AccessKeyId')
    const s3SecretAccessKey = config.requireSecret('s3SecretAccessKey')
    const spiloImage = args.spiloImage || "registry.opensource.zalan.do/acid/spilo-12:1.6-p2"
    const logicalBackupsImage = args.logicalBackupsImage || "vitobotta/postgres-logical-backup:0.0.13"

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )

    const chartDir = path.resolve(`/tmp/${appName}`);

    if (!fs.existsSync(nodepath.join(chartDir, "postgres-operator"))) {
      k8s.helm.v3.fetch(`https://opensource.zalando.com/postgres-operator/charts/postgres-operator/postgres-operator-${version}.tgz`,
        {
          destination: chartDir,
          untar: true,
        });

      // Pulumi always loads values.yaml in the current version, which causes 
      // problems to the operator when installing in CRD mode -recommended- instead of 
      // ConfigMap mode. So we are overwriting values.yaml with the contents of values-crd.yaml
      shell.cp(nodepath.join(chartDir, "postgres-operator/values-crd.yaml"), nodepath.join(chartDir, "postgres-operator/values.yaml"));
    }    

    const crds = new k8s.yaml.ConfigGroup(`${appName}-crds`, {
      files: [ path.join(nodepath.join(chartDir, "postgres-operator/crds", "*.yaml")) ],
    });   

    function crdValues(): any {
      let fileContents = fs.readFileSync(nodepath.join(chartDir,
          "postgres-operator/values-crd.yaml"));
      return require("js-yaml").safeLoad(fileContents);
    }

    const customValues = {
      configTarget: "OperatorConfigurationCRD",
      configKubernetes: {
        enable_pod_antiaffinity: true,
        pod_environment_configmap: "postgres-pod-config",
        watched_namespace: "*",
        enable_init_containers: true,
        enable_pod_disruption_budget: true,
        enable_sidecars: true,
        spilo_privileged: false
      },
      configAwsOrGcp: {
        aws_region: s3Region,
        aws_endpoint: s3Endpoint,
        wal_s3_bucket: s3Bucket
      },
      configLoadBalancer: {
        enable_master_load_balancer: false,
        enable_replica_load_balancer: false
      },
      configDebug: {
        debug_logging: true,
        enable_database_access: true
      },
      configLogicalBackup: {
        logical_backup_docker_image: logicalBackupsImage,
        logical_backup_s3_access_key_id: s3AccessKeyId,
        logical_backup_s3_bucket: s3Bucket,
        logical_backup_s3_region: s3Region,
        logical_backup_s3_endpoint: s3Endpoint,
        logical_backup_s3_secret_access_key: s3SecretAccessKey,
        logical_backup_s3_sse: logicalBackupS3SSE,
        logical_backup_schedule: logicalBackupDefaultSchedule
      },
      configGeneral: {
        enable_crd_validation: true,
        enable_shm_volume: true,
        workers: 4,
        min_instances: -1,
        max_instances: -1,
        docker_image: spiloImage
      },
      configTeamsApi: {
        enable_team_superuser: false,
        enable_teams_api: false
      }
    }
  
    const zalandoPostgresOperator = new k8s.helm.v3.Chart(
      appName,
      {
        path: nodepath.join(chartDir, "postgres-operator"),
        namespace: namespace,
        values: {...crdValues(), ...customValues}
      },
      {
        parent: this,
        dependsOn: [
          ns,
          crds
        ],
      },
    )          
  }
}
