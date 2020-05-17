import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'

import * as config from './config'

export interface CertManagerArgs {
  version?: pulumi.Input<string>,
  namespace?: pulumi.Input<string>,
  email?: pulumi.Input<string>,
  cloudflareEmail?: pulumi.Input<string>,
  cloudflareAPIKey?: pulumi.Input<string>,
  ingressClass?: pulumi.Input<string>,
}

export class CertManager extends pulumi.ComponentResource  {
  constructor(
    appName: string,
    args: CertManagerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {

    super('CertManager', appName, {}, opts)

    const version = args.version || config.version
    const namespace = args.namespace || config.namespace
    const email = args.email ||   config.email;
    const cloudflareEmail = args.cloudflareEmail || config.cloudflareEmail;
    const cloudflareAPIKey = args.cloudflareAPIKey || config.cloudflareAPIKey;
    const crdsManifest = `https://github.com/jetstack/cert-manager/releases/download/${version}/cert-manager.crds.yaml`;
    const ingressClass = args.ingressClass || "nginx"

    const ns = new k8s.core.v1.Namespace(
      `${appName}-ns`,
      {
        metadata: {
          name: namespace,
        },
      },
      { parent: this },
    )
  
    const crds = new k8s.yaml.ConfigFile(
      `${appName}-crds`,
      {
        file: crdsManifest,
      },
      {
        parent: this,
        dependsOn: [
          ns,
        ],
      },
    )

    const certManager = new k8s.helm.v3.Chart(
      appName,
      {
        chart: "cert-manager",
        version: version,
        fetchOpts: {
          repo: 'https://charts.jetstack.io',
        },
        namespace: namespace,
        values: {
          extraArgs: [
            "--dns01-recursive-nameservers-only",
            "--dns01-recursive-nameservers=1.1.1.1:53,1.0.0.1:53"
          ]
        }
      },
      {
        parent: this,
        dependsOn: [
          ns,
          crds,
        ],
      },
    )

    const cloudflareSecret = new k8s.core.v1.Secret(`${appName}-cloudflare-api-key`, 
      {
        metadata: {
          name: "cloudflare-api-key",
          namespace: namespace,
        },
        stringData: {
          "api-key": cloudflareAPIKey
        },
      },
      {
        parent: this,
        dependsOn: [
          certManager
        ],
      },      
    )

    const prodClusterIssuer = new k8s.apiextensions.CustomResource(`${appName}-letsencrypt-prod`, 
      {
        kind: "ClusterIssuer",
        apiVersion: "cert-manager.io/v1alpha2",
        metadata: {
          name: "letsencrypt-prod",
          namespace: namespace,
        },
        spec: {
          acme: {
            server: "https://acme-v02.api.letsencrypt.org/directory",
            email: email,
            privateKeySecretRef: {
              name: "letsencrypt-prod-account-key",
            },
            solvers: [
              {
                http01: {
                  ingress: { class: ingressClass }
                } 
              },
              {
                dns01: {
                  cloudflare: {
                    email: cloudflareEmail,
                    apiKeySecretRef: {
                      name: "cloudflare-api-key",
                      key: "api-key"
                    }
                  }
                } 
              }
            ]
          },
        }
      }, 
      {
        dependsOn: [
          certManager,
          cloudflareSecret,
          certManager.getResource("apps/v1/Deployment", `${namespace}/${appName}-webhook`)
        ]
      }
    )    

    const stagingClusterIssuer = new k8s.apiextensions.CustomResource(`${appName}-letsencrypt-staging`, 
      {
        kind: "ClusterIssuer",
        apiVersion: "cert-manager.io/v1alpha2",
        metadata: {
          name: "letsencrypt-staging",
          namespace: namespace,
        },
        spec: {
          acme: {
            server: "https://acme-staging-v02.api.letsencrypt.org/directory",
            email: email,
            privateKeySecretRef: {
              name: "letsencrypt-staging-account-key",
            },
            solvers: [
              {
                http01: {
                  ingress: { class: ingressClass }
                } 
              },
              {
                dns01: {
                  cloudflare: {
                    email: cloudflareEmail,
                    apiKeySecretRef: {
                      name: "cloudflare-api-key",
                      key: "api-key"
                    }
                  }
                } 
              }
            ]
          },
        }
      }, 
      {
        dependsOn: [
          certManager,
          cloudflareSecret,
          certManager.getResource("apps/v1/Deployment", `${namespace}/${appName}-webhook`)
        ]
      }
    )     
  }
}