import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

export interface haproxyIngressArgs {
  namespace?: pulumi.Input<string>,
  controllerImageTag?: pulumi.Input<string>,
  configMapData?: pulumi.Input<{ [key: string]: pulumi.Input<string>; }>,
  useHostNetwork?: pulumi.Input<boolean>,
  controllerKind?: pulumi.Input<string>,
  daemonsetUseHostPort?: pulumi.Input<boolean>,
  daemonsetHttpHostPort?: pulumi.Input<string>,
  daemonsetHttpsHostPort?: pulumi.Input<string>,
  deploymentReplicaCount?: pulumi.Input<number>,
  serviceAnnotations?: pulumi.Input<object>,
  serviceExternalTrafficPolicy?: pulumi.Input<string>,
  serviceType?: pulumi.Input<string>,
  useProxyProtocol?: pulumi.Input<boolean>,
  ingressClass?: pulumi.Input<string>,
}

export class haproxyIngress extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: haproxyIngressArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const namespace = args.namespace || "haproxy-ingress"
    const controllerImageTag = args.controllerImageTag || "v0.10-snapshot.5"
    let configMapData = args.configMapData || {}
    const useHostNetwork = args.useHostNetwork || false
    const controllerKind = args.controllerKind || "Deployment"
    const daemonsetUseHostPort = args.daemonsetUseHostPort || true
    const daemonsetHttpHostPort = args.daemonsetHttpHostPort || "80"
    const daemonsetHttpsHostPort = args.daemonsetHttpsHostPort || "443"
    const deploymentReplicaCount = args.deploymentReplicaCount || 1
    const serviceAnnotations = args.serviceAnnotations || {}
    const serviceExternalTrafficPolicy = args.serviceExternalTrafficPolicy || "Local"
    const serviceType = args.serviceType || "LoadBalancer"
    const useProxyProtocol = args.useProxyProtocol || false
    const ingressClass = args.ingressClass || "haproxy"

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )    

    const haproxyIngress = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "haproxy-ingress",
        fetchOpts: {
          repo: 'https://kubernetes-charts-incubator.storage.googleapis.com',
        },
        namespace: namespace,
        values: {
          controller: {
            image: {
              tag: controllerImageTag
            },
            ingressClass: ingressClass,
            configMapData: configMapData,
            hostNetwork: useHostNetwork,
            kind: controllerKind,
            daemonset: {
              useHostPort: daemonsetUseHostPort,
              hostPorts: {
                http: daemonsetHttpHostPort,
                https: daemonsetHttpsHostPort,
              }
            },
            replicaCount: deploymentReplicaCount,
            service: {
              annotations: serviceAnnotations,
              externalTrafficPolicy: serviceExternalTrafficPolicy,
              type: serviceType,
            },
            metrics: {
              enabled: true
            },
            logs: {
              enabled: true
            }
          },
          stats: {
            enabled: true,
            service: {
              type: "ClusterIP"
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

    if (Object.keys(configMapData).length == 0) {
      configMapData = {
        "healthz-port": "10253",
        "syslog-endpoint": "127.0.0.1:514",
        "ssl-redirect": "true",
        "ssl-redirect-code": "301",
        "forwardfor": "ifmissing", 
        "max-connections": "10000",
        "proxy-body-size": "50m",
        "use-proxy-protocol": useProxyProtocol.toString()
      }
    }

    const configMap = new k8s.core.v1.ConfigMap(`${appName}-config-map`, {
      metadata: {
        namespace: namespace,
        name: `${appName}-controller`
      },      
      data: {
        "healthz-port": "10253",
        "syslog-endpoint": "127.0.0.1:514",
        "ssl-redirect": "true",
        "ssl-redirect-code": "301",
        "forwardfor": "ifmissing", 
        "max-connections": "10000",
        "proxy-body-size": "50m",
        "use-proxy-protocol": useProxyProtocol.toString()
      }
    },
    {
      parent: this,
      dependsOn: [
        haproxyIngress,
      ],
    })
  }
}