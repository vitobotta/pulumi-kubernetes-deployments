import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

declare var require: any;

export interface MetalLBArgs {
  addresses: pulumi.Input<pulumi.Input<string>[]>,
  secretKey?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  version?: pulumi.Input<string>,
}

export class MetalLB extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: MetalLBArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const version = args.version || "v0.9.3"
    const secretKey = pulumi.output(args.secretKey || config.getSecret('secretKey') || "blah")
    const namespace = args.namespace || config.get("namespace") || "metallb-system"
    const addresses = args.addresses

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )        

    function configMapData(): any {
      const json = {
        "address-pools": [
          {
            name: "default",
            protocol: "layer2",
            addresses: addresses
          }
        ]
      }

      return require("js-yaml").safeDump(json);      
    }
    const configMap = new k8s.core.v1.ConfigMap(`${appName}-config-map`, 
      {
        metadata: {
          name: "config",
          namespace: namespace
        },
        data: {
          config: configMapData()
        }
      },
      {
        parent: this,
        dependsOn: [
          ns
        ]
      }
    );   

    const secret = new k8s.core.v1.Secret(`${appName}-secret`, 
      {
        metadata: {
          name: "memberlist",
          namespace: namespace,
        },
        stringData: {
          secretkey: secretKey
        },
      },
      {
        parent: this,
        dependsOn: [
          ns
        ]        
      },      
    )    

    const manifest = new k8s.yaml.ConfigFile(
      `${appName}-manifest`,
      {
        file: `https://raw.githubusercontent.com/google/metallb/${version}/manifests/metallb.yaml`,
      },
      {
        parent: this,
        dependsOn: [
          secret,
        ],
      },
    )   
  }
}