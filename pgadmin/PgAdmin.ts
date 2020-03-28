import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface PgAdminArgs {
  namespace: pulumi.Input<string>,
  email?: pulumi.Input<string>,
  password?: pulumi.Input<string>,
  persistenceEnabled?: pulumi.Input<boolean>,
  persistenceStorageClass?: pulumi.Input<string>,
  persistenceSize?: pulumi.Input<string>,
}

export class PgAdmin extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: PgAdminArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const namespace = args.namespace || config.get('namespace') || "pgadmin"
    const email = args.email || config.get('email')
    const password = pulumi.output(args.password || config.getSecret('password'))
    const persistenceEnabled = args.persistenceEnabled || false
    const persistenceStorageClass = args.persistenceStorageClass || ""
    const persistenceSize = args.persistenceSize || "1Gi"

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )    

    const pgAdmin = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "pgadmin4",
        fetchOpts: {
          repo: 'https://helm.runix.net',
        },
        namespace: namespace,
        values: {
          env: {
            email: email,
            password: password
          },
          persistentVolume: {
            enabled: persistenceEnabled,
            storageClass: persistenceStorageClass,
            size: persistenceSize
          },
          service: {
            type: "ClusterIP"
          },
          ingress: {
            enabled: false
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
