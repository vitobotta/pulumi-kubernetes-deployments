import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface AnyCableArgs {
  hostname: pulumi.Input<string>,
  redisChannel: pulumi.Input<string>,
  rpcHost: pulumi.Input<string>,
  namespace: pulumi.Input<string>,
  ingressEnabled?: pulumi.Input<boolean>
  redisUrl?: pulumi.Input<string>,
  logLevel?: pulumi.Input<string>,
  imageTag?: pulumi.Input<string>,
  replicaCount?: pulumi.Input<number>,
  certManagerClusterIssuer?: pulumi.Input<string>,
  ingressClass?: pulumi.Input<string>,
  cpu?: pulumi.Input<string>,
  memory?: pulumi.Input<string>,
}

export class AnyCable extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: AnyCableArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const config: pulumi.Config = new pulumi.Config(appName)

    const redisUrl = config.requireSecret('redisUrl')

    const hostname = args.hostname
    const redisChannel = args.redisChannel
    const rpcHost = args.rpcHost
    const namespace = args.namespace
    const ingressEnabled = args.ingressEnabled || true
    const logLevel = args.logLevel || "info"
    const imageTag = args.imageTag || "1.0.0.preview1"
    const replicaCount = args.replicaCount || 1
    const certManagerClusterIssuer = args.certManagerClusterIssuer || "letsencrypt-prod"
    const ingressClass = args.ingressClass || "nginx"
    const cpu = args.cpu || "350m"
    const memory = args.memory || "400Mi"


    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )        


    const anyCable = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "anycable-go",
        fetchOpts: {
          repo: 'https://helm.anycable.io',
        },
        namespace: namespace,
        values: {
          image: {
            tag: imageTag
          },
          replicas: replicaCount,
          ingress: {
            enable: ingressEnabled,
            path: "/cable",
            annotations: {
              "cert-manager.io/cluster-issuer": certManagerClusterIssuer,
              "kubernetes.io/ingress.class": ingressClass,
              "acme.cert-manager.io/http01-ingress-class": ingressClass
            },
            acme: {
              hosts: [
                hostname
              ]
            },
            resources: {
              limits: {
                cpu: cpu,
                memory: memory
              },
              requests: {
                cpu: cpu,
                memory: memory
              }
            }
          },
          env: {
            anycableHost: "0.0.0.0",
            anycablePort: "8080",
            anycablePath: "/cable",
            anycableSslCert: "",
            anycableRedisUrl: redisUrl,
            anycableRedisChannel: redisChannel,
            anycableRpcHost: rpcHost,
            anycableHeaders: "cookie,origin,x-forwarded-for,cf-connecting-ip",
            anycableDisconnectRate: "100",
            anycableLogLevel: logLevel,
            anycableLogFormat: "text",
            anycableDebug: ""
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