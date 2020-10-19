import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as config from './config'


export interface NginxIngressArgs {
  version?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  serviceType?: pulumi.Input<string>,
  ingressClass?: pulumi.Input<string>,
  nodePortHTTP?: pulumi.Input<number>,
  nodePortHTTPS?: pulumi.Input<number>,
  replicaCount?: pulumi.Input<number>,
  useProxyProtocol?: pulumi.Input<string>,
  useForwardedHeaders?: pulumi.Input<string>,
  clientMaxBodySize?: pulumi.Input<string>,
  deploymentKind?: pulumi.Input<string>,
  serviceAnnotations?: pulumi.Input<object>,
  realIpFromCloudflare?: pulumi.Input<boolean>,
  enableServiceMonitor?: pulumi.Input<boolean>,
  serviceMonitorNamespace?: pulumi.Input<string>,
  loadBalancerIp?: pulumi.Input<string>,
}

export class NginxIngress extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: NginxIngressArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    
    super(appName, appName, {}, opts)

    const version = args.version || config.version
    const namespace = args.namespace || config.namespace
    const serviceType = args.serviceType || config.serviceType
    const ingressClass = args.ingressClass || config.ingressClass
    const nodePortHTTP = args.nodePortHTTP || config.nodePortHTTP
    const nodePortHTTPS = args.nodePortHTTPS || config.nodePortHTTPS
    const replicaCount = args.replicaCount || config.replicaCount || 1
    const useProxyProtocol = args.useProxyProtocol || config.useProxyProtocol || "false"
    const useForwardedHeaders = args.useForwardedHeaders || config.useForwardedHeaders || "true"
    const clientMaxBodySize = args.clientMaxBodySize || config.clientMaxBodySize
    const deploymentKind = args.deploymentKind || "DaemonSet"
    const serviceAnnotations = args.serviceAnnotations || {}
    const realIpFromCloudflare = args.realIpFromCloudflare || false
    const enableServiceMonitor = args.enableServiceMonitor || false
    const serviceMonitorNamespace = args.serviceMonitorNamespace || "cattle-prometheus"

    let loadBalancerIp = args.loadBalancerIp || ""
    let server_snippet = "";
    let proxies_cidr = "";

    if (loadBalancerIp != "") {
      loadBalancerIp = `,${loadBalancerIp}`;
    }

    if (realIpFromCloudflare) {
      server_snippet = "real_ip_header CF-Connecting-IP;"
      proxies_cidr = `173.245.48.0/20,103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,141.101.64.0/18,108.162.192.0/18,190.93.240.0/20,188.114.96.0/20,197.234.240.0/22,198.41.128.0/17,162.158.0.0/15,104.16.0.0/12,172.64.0.0/13,131.0.72.0/22,2400:cb00::/32,2606:4700::/32,2803:f800::/32,2405:b500::/32,2405:8100::/32,2a06:98c0::/29,2c0f:f248::/32${loadBalancerIp}`
    } else {
      server_snippet = "real_ip_header X-Forwarded-For;"
      proxies_cidr = loadBalancerIp;
    }

    let useHostPort: boolean = true
    let hostNetwork: boolean = true
    let externalTrafficPolicy: string = ""
    let nodePorts;

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )    

    let dependsOn = [ns]
    
    // if (enableServiceMonitor) {
    //   const serviceMonitorNs = new k8s.core.v1.Namespace(
    //     `${appName}-serviceMonitorNamespace`,
    //     {
    //       metadata: {
    //         name: serviceMonitorNamespace,
    //       },
    //     },
    //     { parent: this },
    //   )        

    //   dependsOn = [
    //     ns,
    //     serviceMonitorNs
    //   ]
    // }

    

    switch (serviceType) {
      case "ClusterIP":
        
        break;

      case "NodePort":
        useHostPort = false
        hostNetwork = false
        externalTrafficPolicy = "Local"
        nodePorts = {
          http: nodePortHTTP,
          https: nodePortHTTPS
        }

        break;
      
      case "LoadBalancer":
        useHostPort = false
        hostNetwork = false
        externalTrafficPolicy = "Local"
          
        break;        
    
      default:
        break;
    }

    const nginxIngress = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "ingress-nginx",
        version: version,
        fetchOpts: {
          repo: 'https://kubernetes.github.io/ingress-nginx',
        },
        namespace: namespace,
        values: {
          controller: {
            kind: deploymentKind,
            replicaCount: replicaCount,
            service: {
              type: serviceType,
              externalTrafficPolicy: externalTrafficPolicy,
              nodePorts: nodePorts,
              annotations: serviceAnnotations,
            },
            ingressClass: ingressClass,
            admissionWebhooks: {
              enabled: false
            },
            hostNetwork: hostNetwork,
            metrics: {
              enabled: true,
              service: {
                type: "ClusterIP",
                annotations: {
                  "prometheus.io/scrape": "true",
                  "prometheus.io/port": "10254"
                }
              },
              serviceMonitor: {
                enabled: enableServiceMonitor,
                scrapeInterval: "10s",
                namespaceSelector: {
                  any: true
                },
                namespace: serviceMonitorNamespace,
                additionalLabels: {
                  release: "prometheus-operator"
                }
              }
            },            
          }
        },
      },
      {
        parent: this,
        dependsOn: dependsOn,
      },
    )    

    // const configMap = new k8s.core.v1.ConfigMap(`${appName}-config-map`, {
    //   metadata: {
    //     namespace: namespace,
    //     name: `${appName}-ingress-nginx-controller`
    //   },      
    //   data: {
    //     "use-proxy-protocol": useProxyProtocol,
    //     "use-forwarded-headers": useForwardedHeaders,
    //     "client-max-body-size": clientMaxBodySize,
    //     "http-redirect-code": "301",
    //     "map-hash-bucket-size": "128", 
    //     "proxy-buffer-size": "8k",
    //     "proxy-buffers": "4 8k",
    //     "enable-brotli": "true",
    //     "ssl-protocols": "TLSv1.3 TLSv1.2",
    //     "enable-ocsp": "true",
    //     "no-tls-redirect-locations": "/.well-known/acme-challenge,/verification",
    //     "server-snippet": server_snippet,
    //     "proxy-real-ip-cidr": proxies_cidr
    //   }
    // },
    // {
    //   parent: this,
    //   dependsOn: [
    //     nginxIngress,
    //   ],
    // })
  }
}