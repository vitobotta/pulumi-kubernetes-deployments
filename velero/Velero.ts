import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as fs from "fs";
import * as path from "path";
import * as nodepath from "path";
import * as config from './config';
import * as rp from "request-promise";
import * as tar from "tar";
import * as shell from "shelljs";


export interface VeleroArgs {
  imageTag?: pulumi.Input<string>,
  chartVersion?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  s3Bucket?: pulumi.Input<string>,
  s3Region?: pulumi.Input<string>,
  s3Url?: pulumi.Input<string>,
  prefix?: pulumi.Input<string>,
  awsAccessKeyId?: pulumi.Input<string>,
  awsSecretAccessKey?: pulumi.Input<string>,
  awsPluginVersion?: pulumi.Input<string>,
  deployRestic?: pulumi.Input<boolean>,
}

export class Velero extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: VeleroArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('Velero', appName, {}, opts)
    this.install(appName, args);
  }

  async install(appName: string, args: VeleroArgs) {
    const imageTag = args.imageTag || config.imageTag
    const chartVersion = args.chartVersion || config.chartVersion
    const namespace = args.namespace || config.namespace
    const s3Bucket = args.s3Bucket || config.s3Bucket
    const s3Region = args.s3Region || config.s3Region
    const s3Url = args.s3Url || config.s3Url
    const prefix = args.prefix || config.prefix
    const awsPluginVersion = args.awsPluginVersion || config.awsPluginVersion
    const deployRestic = args.deployRestic || config.deployRestic
    const awsAccessKeyId = args.awsAccessKeyId || config.awsAccessKeyId
    const awsSecretAccessKey = args.awsSecretAccessKey || config.awsSecretAccessKey

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )

    const awsCredentialsSecret = new k8s.core.v1.Secret(`${appName}-cloud-credentials`, {
      metadata: { 
        namespace: namespace,
        name: "cloud-credentials"
       },
      stringData: {
          "cloud": pulumi.all([awsAccessKeyId, awsSecretAccessKey]).
            apply(([id, secret]) => `[default]\naws_access_key_id=${id}\naws_secret_access_key=${secret}`),
      },
    },
    {
      parent: this,
      dependsOn: [
        ns,
      ],
    });


    const chartDir = path.resolve(`/tmp/${appName}`);

    if (fs.existsSync(nodepath.join(chartDir))) {
      shell.rm("-rf", nodepath.join(chartDir));
    } 
    
    fs.mkdirSync(chartDir, { recursive: true });

    const url = `https://github.com/vmware-tanzu/helm-charts/releases/download/velero-${chartVersion}/velero-${chartVersion}.tgz`;
    const arcName = nodepath.join(chartDir, `velero-${chartVersion}.tgz`);
    const response = await rp.get({ uri: url, encoding: null });
    fs.writeFileSync(arcName, response, { encoding: null });
    tar.x({ file: arcName, cwd: chartDir, sync: true });        

    const Velero = new k8s.helm.v3.Chart(
      appName,
      {
        path: nodepath.join(chartDir, "velero"),
        namespace: namespace,
        values: {
          image: {
            tag: imageTag
          },
          configuration: {
            provider: "aws",
            backupStorageLocation: {
              name: "default",
              bucket: s3Bucket,
              config: {
                region: s3Region,
                s3Url: s3Url
              },
              prefix: prefix
            },
          },
          snapshotsEnabled: false,
          deployRestic: deployRestic,
          metrics: {
            enabled: true
          },
          credentials: {
            existingSecret: "cloud-credentials"
          },
          initContainers: [
            {
              name: "velero-plugin-for-aws",
              image: `velero/velero-plugin-for-aws:${awsPluginVersion}`,
              volumeMounts: [
                { 
                  mountPath: "/target",
                  name: "plugins"
                }
              ]
            }
          ]
        }
      },
      {
        parent: this,
        dependsOn: [
          ns,
          awsCredentialsSecret,
        ],
      },
    )    
  }
}